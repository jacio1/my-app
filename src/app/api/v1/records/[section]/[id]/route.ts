import { z } from "zod";
import { requireAccess } from "@/lib/server/access";
import { ApiError, apiError, readJson } from "@/lib/server/firebase-admin";
import { updateRecord, updateSchema } from "@/lib/server/records";
import { sectionSchema } from "@/lib/record-schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ section: string; id: string }> };
async function mutate(request: Request, context: Context, remove: boolean) {
  try {
    const access = await requireAccess(request, "records:write");
    const params = await context.params;
    const section = sectionSchema.safeParse(params.section);
    if (!section.success || !params.id || params.id.length > 128) throw new ApiError(400, "Некорректный адрес записи.");
    const body = await readJson(request);
    const parsed = remove ? z.object({ expectedUpdatedAt: z.string().datetime() }).strict().safeParse(body) : updateSchema.safeParse(body);
    if (!parsed.success) throw new ApiError(400, "Укажите корректные поля и expectedUpdatedAt из последнего чтения записи.");
    const record = await updateRecord(access.uid, section.data, params.id, remove ? null : parsed.data, parsed.data.expectedUpdatedAt);
    return Response.json({ record }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { if (error instanceof z.ZodError) return apiError(new ApiError(400, error.issues.map((issue) => issue.message).join("; "))); return apiError(error); }
}
export const PATCH = (request: Request, context: Context) => mutate(request, context, false);
export const DELETE = (request: Request, context: Context) => mutate(request, context, true);
