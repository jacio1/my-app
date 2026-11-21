import assert from "node:assert/strict";
import test from "node:test";
import { changedRecords, EMPTY, isCalendarDate, loadSnapshot, mergeRecovery, parseSnapshot, recordDocumentId } from "../src/lib/local-data";
import { buildRecord, recordInputSchema } from "../src/lib/record-schema";
import { oauthRequestSchema, validRedirect } from "../src/lib/oauth-schema";

const fields = { id: "old-1", title: "Запись", createdAt: "2026-11-21T08:00:00.000Z", updatedAt: "2026-11-21T08:00:00.000Z" };
test("v1 backup migration preserves every existing record and initializes new sections", () => {
  const legacy = { schemaVersion: 1, tasks: [{ ...fields, completed: false }], notes: [{ ...fields, text: "Идея" }], diary: [{ ...fields, text: "Мой день" }] };
  const migrated = parseSnapshot(JSON.stringify(legacy));
  assert.deepEqual(migrated, { ...legacy, schemaVersion: 2, plans: [], goals: [] });
  assert.deepEqual(parseSnapshot(JSON.stringify(migrated)), migrated);
});
test("invalid or duplicate backup records cannot replace data", () => {
  assert.throws(() => parseSnapshot(JSON.stringify({ ...EMPTY, notes: [{ ...fields, text: "" }, { ...fields, text: "duplicate" }] })));
  assert.throws(() => parseSnapshot(JSON.stringify({ ...EMPTY, plans: [{ ...fields, text: "План", date: "2026-02-30" }] })));
  assert.throws(() => parseSnapshot('{"schemaVersion": 99}'));
});
test("legacy local storage remains readable without mutating the original", () => {
  const source = JSON.stringify({ schemaVersion: 1, tasks: [], notes: [], diary: [{ ...fields, text: "Дневник" }] });
  const storage = { getItem: (key: string) => key === "my-diary-app:v1" ? source : null } as Storage;
  assert.equal(loadSnapshot(storage).diary[0].text, "Дневник");
});
test("sync differences include additions, changes and tombstones, not untouched records", () => {
  const before = { ...EMPTY, tasks: [{ ...fields, completed: false }], notes: [{ ...fields, text: "Идея" }] };
  const after = { ...before, tasks: [{ ...fields, completed: true }], notes: [], goals: [{ ...fields, id: "goal", text: "Шаги", completed: false }] };
  const diff = changedRecords(before, after);
  assert.equal(diff.length, 3);
  assert.equal(diff.find((item) => item.section === "notes")?.record, null);
  assert.deepEqual(changedRecords(after, after), []);
  assert.notEqual(recordDocumentId("diary", "same"), recordDocumentId("notes", "same"));
  assert(!recordDocumentId("notes", "legacy/id").includes("/"));
});
test("API validates plans, goals and task payloads", () => {
  const input = recordInputSchema.parse({ section: "plans", title: "  Завтра  ", text: "Прогулка", date: "2026-11-22" });
  assert.deepEqual(buildRecord(input, "id", fields.createdAt), { ...fields, id: "id", title: "Завтра", section: "plans", text: "Прогулка", date: "2026-11-22", deleted: false });
  for (const payload of [
    { section: "plans", title: "План", text: "Шаги", date: "2026-02-30" },
    { section: "diary", title: "День", text: " " },
    { section: "notes", title: "Идея", text: "Текст", completed: true },
    { section: "tasks", title: " ", uid: "other-account" },
    { section: "tasks", title: "Задача", text: "Этот текст нельзя молча отбросить" },
    { section: "goals", title: "Цель", text: "Текст", idempotencyKey: "../escape" },
  ]) assert.equal(recordInputSchema.safeParse(payload).success, false);
  assert.equal(buildRecord(recordInputSchema.parse({ section: "goals", title: "Цель", text: "Шаги" }), "goal").completed, false);
  assert.equal(buildRecord(recordInputSchema.parse({ section: "plans", title: "План задачи", text: "Шаги" }), "plan").date, "");
});
test("calendar dates validate leap years without timezone shifts", () => {
  assert(isCalendarDate("2024-02-29"));
  for (const date of ["2025-02-29", "2026-13-01", "2026-11-21T00:00:00Z", "2026-1-1"]) assert(!isCalendarDate(date));
});
test("recovery copies retain failed edits across successive rejections", () => {
  const first = { ...EMPTY, notes: [{ ...fields, text: "Не потерять" }] };
  const second = { ...EMPTY, goals: [{ ...fields, id: "goal", text: "Шаги", completed: false }] };
  const recovered = mergeRecovery(first, second);
  assert.equal(recovered.notes[0].text, "Не потерять");
  assert.equal(recovered.goals[0].text, "Шаги");
  assert.deepEqual(parseSnapshot(JSON.stringify(recovered)), recovered);
});
test("OAuth redirects reject lookalike hosts, embedded credentials, fragments and remote HTTP", () => {
  for (const uri of ["https://chatgpt.com/aip/callback", "http://localhost:12345/callback", "http://127.0.0.1:12345/callback"]) assert(validRedirect(uri));
  for (const uri of ["https://chatgpt.com.attacker.example/callback", "http://chatgpt.com/callback", "https://user:pass@chatgpt.com/callback", "https://chatgpt.com/callback#x", "javascript:alert(1)", "http://192.168.1.3/callback"]) assert(!validRedirect(uri));
  assert(validRedirect("https://custom.example/callback", ["https://custom.example"]));
});
test("OAuth only accepts PKCE S256 authorization code flow with state", () => {
  const request = { response_type: "code", client_id: "client", redirect_uri: "http://localhost:1234/callback", code_challenge: "a".repeat(43), code_challenge_method: "S256", state: "state" };
  assert(oauthRequestSchema.safeParse(request).success);
  assert(!oauthRequestSchema.safeParse({ ...request, code_challenge_method: "plain" }).success);
  assert(!oauthRequestSchema.safeParse({ ...request, state: "" }).success);
  assert(!oauthRequestSchema.safeParse({ ...request, response_type: "token" }).success);
});
