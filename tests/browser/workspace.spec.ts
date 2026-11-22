import { expect, test } from "@playwright/test";

test("completed tasks stay crossed out until leaving the page and keep their subtasks", async ({ page }) => {
  await page.goto("/tasks?new=1");
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("textbox").fill("Собрать вещи");
  await dialog.getByRole("button", { name: "Добавить", exact: true }).click();
  await page.getByRole("button", { name: "Подзадача", exact: true }).click();
  await page.getByRole("textbox", { name: "Название подзадачи" }).fill("Взять зарядку");
  await page.getByRole("button", { name: "Добавить", exact: true }).click();
  await page.getByRole("checkbox", { name: "Взять зарядку" }).click();
  await page.getByText("Взять зарядку", { exact: true }).click();
  await expect(page.getByRole("checkbox", { name: "Взять зарядку" })).not.toBeChecked();
  await page.getByText("Взять зарядку", { exact: true }).click();
  await expect(page.getByRole("checkbox", { name: "Взять зарядку" })).toBeChecked();
  await expect(page.getByRole("checkbox", { name: "Собрать вещи" })).not.toBeChecked();
  await page.getByRole("heading", { name: "Собрать вещи" }).click();
  await expect(page.getByRole("heading", { name: "Собрать вещи" })).toHaveCSS("text-decoration-line", "line-through");
  await page.getByRole("link", { name: "Заметки", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Заметки", exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Задачи", exact: true }).click();
  await expect(page).toHaveURL(/\/tasks$/);
  await expect(page.getByRole("heading", { name: "Собрать вещи" })).toHaveCount(0);
  await page.getByRole("button", { name: /Выполненные.*1/ }).click();
  await expect(page.getByRole("checkbox", { name: "Собрать вещи" })).toBeChecked();
  await expect(page.getByRole("checkbox", { name: "Взять зарядку" })).toBeChecked();
});

test("plans and goals survive reload, editing and deletion", async ({ page }) => {
  const failures: string[] = [];
  page.on("pageerror", (error) => failures.push(error.message));
  await page.goto("/plans?new=1");
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("Заголовок").fill("План на завтра");
  await dialog.getByLabel("Дата плана").fill("2026-11-22");
  await dialog.getByLabel("Текст заметки").fill("Закончить проект\nПрогуляться");
  await dialog.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "План на завтра" })).toBeVisible();
  await page.getByRole("button", { name: "Редактировать", exact: true }).click();
  await dialog.getByLabel("Заголовок").fill("Обновлённый план");
  await dialog.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Обновлённый план" })).toBeVisible();
  await page.goto("/goals?new=1");
  await dialog.getByLabel("Заголовок").fill("Прочитать книгу");
  await dialog.getByLabel("Текст заметки").fill("Читать по главе каждый день");
  await dialog.getByRole("button", { name: "Сохранить", exact: true }).click();
  await page.getByRole("button", { name: "Цель достигнута", exact: true }).click();
  await page.reload();
  await expect(page.getByRole("button", { name: "Вернуть в работу" })).toBeVisible();
  await page.getByRole("button", { name: "Удалить", exact: true }).click();
  await expect(dialog.getByRole("heading", { name: "Удалить запись?" })).toBeVisible();
  await dialog.getByRole("button", { name: "Удалить", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Прочитать книгу" })).toHaveCount(0);
  expect(failures).toEqual([]);
});

test("old browser data is preserved during schema migration", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.setItem("my-diary-app:v1", JSON.stringify({ schemaVersion: 1, tasks: [], notes: [{ id: "old", title: "Старая заметка", text: "Не потерять", createdAt: "2026-01-01T12:00:00Z", updatedAt: "2026-01-01T12:00:00Z" }], diary: [] })));
  await page.goto("/notes");
  await expect(page.getByRole("heading", { name: "Старая заметка" })).toBeVisible();
  await page.getByRole("button", { name: "Новая заметка", exact: true }).click();
  await page.getByRole("dialog").getByLabel("Текст заметки").fill("Новая мысль");
  await page.getByRole("dialog").getByRole("button", { name: "Сохранить", exact: true }).click();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("my-diary-app:v1")!));
  expect(saved.schemaVersion).toBe(2);
  expect(saved.notes).toHaveLength(2);
});

test("profile and navigation fit a phone and expose a valid install manifest", async ({ page, request }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/profile");
  await expect(page.getByRole("heading", { name: "Ваше пространство" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Войти через Google" })).toBeDisabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole("link", { name: "Цели", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Цели", exact: true })).toBeVisible();
  const manifest = await (await request.get("/manifest.webmanifest")).json();
  expect(manifest).toMatchObject({ id: "/", display: "standalone", start_url: "/" });
  for (const icon of manifest.icons) expect((await request.get(icon.src)).ok()).toBe(true);
  await page.screenshot({ path: "test-results/mobile-goals.png", fullPage: true });
  await expect(page.getByRole("link", { name: "Профиль", exact: true })).toBeInViewport();
});

test("cloud APIs fail closed without server configuration", async ({ request }) => {
  for (const path of ["/api/v1/records", "/api/connections"]) {
    const response = await request.get(path);
    expect([401, 503]).toContain(response.status());
    const body = await response.json();
    expect(body.records).toBeUndefined();
    expect(body.error).toBeTruthy();
  }
  const metadata = await (await request.get("/.well-known/oauth-authorization-server")).json();
  expect(metadata.code_challenge_methods_supported).toEqual(["S256"]);
  const blocked = await request.post("/api/mcp", { headers: { Origin: "https://attacker.example" }, data: {} });
  expect(blocked.status()).toBe(403);
  const invalidToken = await request.post("/api/mcp", { data: {} });
  expect(invalidToken.status()).toBe(401);
  expect(invalidToken.headers()["www-authenticate"]).toContain("oauth-protected-resource");
});
