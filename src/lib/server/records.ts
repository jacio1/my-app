import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { recordDocumentId, type Section } from "@/lib/local-data";
import { buildRecord, recordInputSchema, type RecordInput } from "@/lib/record-schema";
import { adminServices, ApiError } from "./firebase-admin";

export async function listRecords(uid: string, options: { section?: Section; query?: string; date?: string; limit?: number } = {}) {
  // Bound retrieval; return a cursor in REST for larger accounts in a future version.
  const result = await adminServices().db.collection("users").doc(uid).collection("records").limit(2001).get();
  if (result.size > 2000) throw new ApiError(422, "В аккаунте больше 2000 записей. Для этого объёма требуется пагинация API.");
  return result.docs.map((document) => document.data()).filter((record) => !record.deleted && (!options.section || record.section === options.section) && (!options.date || record.date === options.date) && (!options.query || `${record.title}\n${record.text ?? ""}`.toLocaleLowerCase().includes(options.query.toLocaleLowerCase()))).sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt))).slice(0, options.limit ?? 100);
}

export async function createRecord(uid: string, input: RecordInput) {
  const parsed = recordInputSchema.parse(input);
  const id = parsed.idempotencyKey ?? randomUUID();
  const reference = adminServices().db.collection("users").doc(uid).collection("records").doc(recordDocumentId(parsed.section, id));
  const record = buildRecord(parsed, id);
  return adminServices().db.runTransaction(async (transaction) => {
    const existing = await transaction.get(reference);
    if (existing.exists) {
      const previous = existing.data()!;
      if (previous.deleted || previous.title !== record.title || previous.text !== record.text || previous.date !== record.date || previous.completed !== record.completed) throw new ApiError(409, "Этот idempotencyKey уже использован для другой записи.");
      return previous;
    }
    transaction.create(reference, record);
    return record;
  });
}

export const updateSchema = z.object({
  title: z.string().trim().min(1).max(500).optional(), text: z.string().trim().min(1).max(100_000).optional(),
  completed: z.boolean().optional(), date: z.string().optional(),
  expectedUpdatedAt: z.string().datetime(),
}).strict();

export async function updateRecord(uid: string, section: Section, id: string, patch: z.infer<typeof updateSchema> | null, expectedUpdatedAt?: string) {
  const reference = adminServices().db.collection("users").doc(uid).collection("records").doc(recordDocumentId(section, id));
  return adminServices().db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(reference);
    const previous = snapshot.data();
    if (!previous || previous.deleted) throw new ApiError(404, "Запись не найдена.");
    if (previous.updatedAt !== (patch?.expectedUpdatedAt ?? expectedUpdatedAt)) throw new ApiError(409, "Запись уже изменена на другом устройстве. Прочитайте её заново перед обновлением.");
    const { expectedUpdatedAt: _expected, ...fields } = patch ?? { expectedUpdatedAt: "" };
    void _expected;
    if (patch) recordInputSchema.parse({ section, title: fields.title ?? previous.title, text: fields.text ?? previous.text, date: fields.date ?? previous.date, completed: fields.completed ?? previous.completed });
    const next = { ...previous, ...fields, updatedAt: new Date(Math.max(Date.now(), Date.parse(previous.updatedAt) + 1)).toISOString(), deleted: !patch };
    transaction.set(reference, next);
    return next;
  });
}
