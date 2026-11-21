import { z } from "zod";
import { isCalendarDate, sections } from "@/lib/local-data";

export const sectionSchema = z.enum(sections);
export const recordIdSchema = z.string().min(1).max(128).regex(/^[a-zA-Z0-9_-]+$/);
export const recordInputSchema = z.object({
  section: sectionSchema,
  title: z.string().trim().min(1).max(500),
  text: z.string().max(100_000).optional(),
  date: z.string().refine((value) => value === "" || isCalendarDate(value), "Используйте реальную дату YYYY-MM-DD").optional(),
  completed: z.boolean().optional(),
  idempotencyKey: recordIdSchema.optional(),
}).strict().superRefine((value, context) => {
  if (value.section === "tasks" && value.text !== undefined) context.addIssue({ code: z.ZodIssueCode.custom, path: ["text"], message: "У задачи есть только заголовок. Шаги сохраните отдельным планом." });
  if (value.section !== "tasks" && !value.text?.trim()) context.addIssue({ code: z.ZodIssueCode.custom, path: ["text"], message: "Текст обязателен" });
  if (value.date !== undefined && value.section !== "plans") context.addIssue({ code: z.ZodIssueCode.custom, path: ["date"], message: "Дата доступна только для плана" });
  if (value.completed !== undefined && !["tasks", "goals"].includes(value.section)) context.addIssue({ code: z.ZodIssueCode.custom, path: ["completed"], message: "Статус доступен только для задач и целей" });
});
export type RecordInput = z.infer<typeof recordInputSchema>;

export function buildRecord(input: RecordInput, id: string, now = new Date().toISOString()) {
  return {
    id, section: input.section, title: input.title, createdAt: now, updatedAt: now, deleted: false,
    ...(input.section !== "tasks" ? { text: input.text!.trim() } : {}),
    ...(input.section === "plans" ? { date: input.date ?? "" } : {}),
    ...(["tasks", "goals"].includes(input.section) ? { completed: input.completed ?? false } : {}),
  };
}
