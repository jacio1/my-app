import { rateLimit } from "@/lib/server/rate-limit";
import { z } from "zod";
import { requireAccess } from "@/lib/server/access";
import { ApiError, apiError, readJson } from "@/lib/server/firebase-admin";
import { createRecord, listRecords } from "@/lib/server/records";
import { recordInputSchema, sectionSchema } from "@/lib/record-schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    rateLimit(request, "records", 120);
    const access = await requireAccess(request, "records:read");
    const options = z.object({ section: sectionSchema.optional(), query: z.string().max(500).optional(), date: z.string().optional(), limit: z.coerce.number().int().min(1).max(200).optional() }).safeParse(Object.fromEntries(new URL(request.url).searchParams));
    if (!options.success) throw new ApiError(400, "Некорректные параметры поиска.");
    return Response.json({ records: await listRecords(access.uid, options.data) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiError(error); }
}
export async function POST(request: Request) {
  try {
    rateLimit(request, "records", 120);
    const access = await requireAccess(request, "records:write");
    const parsed = recordInputSchema.safeParse(await readJson(request));
    if (!parsed.success) throw new ApiError(400, parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; "));
    return Response.json({ record: await createRecord(access.uid, parsed.data) }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiError(error); }
}
