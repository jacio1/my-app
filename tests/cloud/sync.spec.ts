import { expect, test, type Page } from "@playwright/test";
import { initializeTestEnvironment, assertFails, assertSucceeds, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { readFileSync } from "node:fs";
import { randomUUID, randomBytes, createHash } from "node:crypto";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

let environment: RulesTestEnvironment;
test.beforeAll(async () => {
  environment = await initializeTestEnvironment({ projectId: "demo-my-diary", firestore: { host: "127.0.0.1", port: 8080, rules: readFileSync("firestore.rules", "utf8") } });
});
test.afterAll(async () => { await environment?.cleanup(); });

test("two devices synchronize and rules isolate users and integration secrets", async () => {
  const uid = randomUUID();
  const first = environment.authenticatedContext(uid).firestore();
  const second = environment.authenticatedContext(uid).firestore();
  const other = environment.authenticatedContext(randomUUID()).firestore();
  const path = `users/${uid}/records/tasks_test`;
  const now = new Date().toISOString();
  await assertSucceeds(first.doc(path).set({ id: "test", section: "tasks", title: "С телефона", completed: false, deleted: false, createdAt: now, updatedAt: now }));
  expect((await second.doc(path).get()).data()?.title).toBe("С телефона");
  await assertSucceeds(second.doc(path).update({ completed: true }));
  expect((await first.doc(path).get()).data()?.completed).toBe(true);
  await assertFails(other.doc(path).get());
  await assertFails(other.doc(path).update({ title: "Чужая запись" }));
  await assertFails(environment.unauthenticatedContext().firestore().doc(path).get());
  await assertFails(first.doc("integrationTokens/secret").get());
  await assertFails(first.doc("oauthClients/client").set({ uid }));
  await assertFails(first.doc(path).update({ section: "diary" }));
  await assertFails(first.doc(path).delete());
  await assertSucceeds(first.doc(path).update({ deleted: true }));
  expect((await second.doc(path).get()).data()?.deleted).toBe(true);
});

async function account() {
  const response = await fetch("http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-key", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ returnSecureToken: true }) });
  const data = await response.json();
  if (!response.ok) throw new Error("Auth emulator failed");
  return { uid: data.localId as string, headers: { Authorization: `Bearer ${data.idToken}` } };
}

test("API writes reach devices, retries are idempotent, conflicts and revocation are enforced", async ({ request }) => {
  const owner = await account();
  const created = await request.post("/api/connections", { headers: owner.headers, data: { name: "Integration test" } });
  expect(created.status()).toBe(201);
  const connection = await created.json();
  const headers = { Authorization: `Bearer ${connection.token}` };
  const payload = { section: "plans", title: "План из чата", text: "Два важных дела", date: "2026-11-22", idempotencyKey: randomUUID() };
  const first = await request.post("/api/v1/records", { headers, data: payload });
  expect(first.status()).toBe(201);
  const { record } = await first.json();
  const retried = await (await request.post("/api/v1/records", { headers, data: payload })).json();
  expect(retried.record.id).toBe(record.id);
  const device = environment.authenticatedContext(owner.uid).firestore();
  expect((await device.doc(`users/${owner.uid}/records/plans_${record.id}`).get()).data()?.title).toBe("План из чата");
  const route = `/api/v1/records/plans/${record.id}`;
  const updated = await request.patch(route, { headers, data: { title: "Новое название", expectedUpdatedAt: record.updatedAt } });
  expect(updated.status()).toBe(200);
  const conflict = await request.patch(route, { headers, data: { title: "Устаревшая правка", expectedUpdatedAt: record.updatedAt } });
  expect(conflict.status()).toBe(409);
  const viewer = await (await request.post("/api/connections", { headers: owner.headers, data: { name: "Read only", readOnly: true } })).json();
  const viewerHeaders = { Authorization: `Bearer ${viewer.token}` };
  expect((await request.get("/api/v1/records", { headers: viewerHeaders })).status()).toBe(200);
  expect((await request.post("/api/v1/records", { headers: viewerHeaders, data: payload })).status()).toBe(403);
  expect((await request.delete("/api/connections", { headers: (await account()).headers, data: { id: connection.id } })).status()).toBe(404);
  expect((await request.delete("/api/connections", { headers: owner.headers, data: { id: connection.id } })).status()).toBe(204);
  expect((await request.get("/api/v1/records", { headers })).status()).toBe(401);
});

test("OAuth PKCE, token rotation and MCP tools work through a real client", async ({ request }) => {
  const owner = await account();
  const redirectUri = "http://127.0.0.1:45678/callback";
  const clientResponse = await request.post("/api/oauth/register", { data: { client_name: "MCP test", redirect_uris: [redirectUri], token_endpoint_auth_method: "none" } });
  expect(clientResponse.status()).toBe(201);
  const { client_id } = await clientResponse.json();
  const verifier = randomBytes(32).toString("base64url");
  const authorization = { response_type: "code", client_id, redirect_uri: redirectUri, code_challenge: createHash("sha256").update(verifier).digest("base64url"), code_challenge_method: "S256", state: randomUUID(), scope: "records:read records:write", resource: "http://localhost:3101/api/mcp" };
  const consent = await request.post("/api/oauth/authorize", { headers: owner.headers, data: authorization });
  expect(consent.status()).toBe(200);
  const callback = new URL((await consent.json()).redirect);
  expect(callback.searchParams.get("state")).toBe(authorization.state);
  const form = { grant_type: "authorization_code", client_id, code: callback.searchParams.get("code")!, code_verifier: verifier, redirect_uri: redirectUri, resource: authorization.resource };
  const wrongVerifier = await request.post("/api/oauth/token", { form: { ...form, code_verifier: "b".repeat(43) } });
  expect(wrongVerifier.status()).toBe(400);
  const tokenResponse = await request.post("/api/oauth/token", { form });
  expect(tokenResponse.status()).toBe(200);
  const tokens = await tokenResponse.json();
  expect((await request.post("/api/oauth/token", { form })).status()).toBe(400);
  const refreshed = await request.post("/api/oauth/token", { form: { grant_type: "refresh_token", refresh_token: tokens.refresh_token, client_id, resource: authorization.resource } });
  expect(refreshed.status()).toBe(200);
  expect((await request.post("/api/oauth/token", { form: { grant_type: "refresh_token", refresh_token: tokens.refresh_token, client_id } })).status()).toBe(400);
  const transport = new StreamableHTTPClientTransport(new URL("http://127.0.0.1:3101/api/mcp"), { requestInit: { headers: { Authorization: `Bearer ${(await refreshed.json()).access_token}` } } });
  const client = new Client({ name: "diary-test", version: "1.0.0" });
  try {
    await client.connect(transport);
    expect((await client.listTools()).tools.map((tool) => tool.name)).toEqual(expect.arrayContaining(["list_records", "create_record", "update_record", "delete_record"]));
    const saved = await client.callTool({ name: "create_record", arguments: { section: "goals", title: "Цель из нового чата", text: "Первый шаг", idempotencyKey: randomUUID() } });
    expect(saved.isError).not.toBe(true);
    const listed = await client.callTool({ name: "list_records", arguments: { section: "goals" } });
    expect(JSON.stringify(listed)).toContain("Цель из нового чата");
  } finally { await client.close(); }
});

async function googleLogin(page: Page, email: string) {
  await page.goto("http://127.0.0.1:3101/profile");
  const opening = page.waitForEvent("popup");
  await page.getByRole("button", { name: "Войти через Google" }).click();
  const popup = await opening;
  await popup.getByRole("button", { name: "Add new account" }).click();
  await popup.locator("#email-input").fill(email);
  await popup.locator("#display-name-input").fill("Тестовый аккаунт");
  await popup.getByRole("button", { name: "Sign in with Google" }).click();
  await expect(page.getByText("Синхронизировано", { exact: true })).toBeVisible({ timeout: 15000 });
}

test("browser accounts synchronize offline edits and preserve guest data", async ({ browser }) => {
  test.setTimeout(90000);
  const first = await browser.newContext();
  const second = await browser.newContext();
  try {
    // The emulator widget works without downloading its optional fonts/styles.
    for (const context of [first, second]) await context.route(/https:\/\/(unpkg\.com|fonts\.googleapis\.com|fonts\.gstatic\.com)\//, (route) => route.abort());
    const one = await first.newPage();
    const two = await second.newPage();
    const email = `${randomUUID()}@example.test`;
    await one.goto("http://127.0.0.1:3101/notes?new=1");
    await one.getByRole("dialog").getByLabel("Заголовок").fill("Локальная запись");
    await one.getByRole("dialog").getByLabel("Текст заметки").fill("Сохранить до входа");
    await one.getByRole("dialog").getByRole("button", { name: "Сохранить", exact: true }).click();
    await googleLogin(one, email);
    await one.getByRole("button", { name: "Перенести локальные записи" }).click();
    await expect(one.getByText("Синхронизировано", { exact: true })).toBeVisible();
    await googleLogin(two, email);
    await two.goto("http://127.0.0.1:3101/notes");
    await expect(two.getByRole("heading", { name: "Локальная запись" })).toBeVisible();
    await one.goto("http://127.0.0.1:3101/notes");
    await expect(one.getByRole("heading", { name: "Локальная запись" })).toBeVisible();
    await first.setOffline(true);
    await one.getByRole("button", { name: "Новая заметка", exact: true }).click();
    await one.getByRole("dialog").getByLabel("Заголовок").fill("Записано без сети");
    await one.getByRole("dialog").getByLabel("Текст заметки").fill("Очередь синхронизации");
    await one.getByRole("dialog").getByRole("button", { name: "Сохранить", exact: true }).click();
    await expect(one.getByRole("heading", { name: "Записано без сети" })).toBeVisible();
    await expect(two.getByRole("heading", { name: "Записано без сети" })).toHaveCount(0);
    await first.setOffline(false);
    await expect(two.getByRole("heading", { name: "Записано без сети" })).toBeVisible({ timeout: 20000 });
    await one.goto("http://127.0.0.1:3101/profile");
    await expect(one.getByText("Синхронизировано", { exact: true })).toBeVisible();
    await one.getByRole("button", { name: "Выйти", exact: true }).click();
    await expect(one.getByText("Локальный режим", { exact: true })).toBeVisible();
    await one.goto("http://127.0.0.1:3101/notes");
    await expect(one.getByRole("heading", { name: "Локальная запись" })).toBeVisible();
    await expect(one.getByRole("heading", { name: "Записано без сети" })).toHaveCount(0);
  } finally { await first.close(); await second.close(); }
});
