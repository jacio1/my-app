import { rateLimit } from "@/lib/server/rate-limit";
import { apiError, readJson, requireAccount } from "@/lib/server/firebase-admin";
import { authorize, validateAuthorization } from "@/lib/server/oauth";

export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    rateLimit(request, "oauth-consent", 30); const { client, scopes } = await validateAuthorization(Object.fromEntries(new URL(request.url).searchParams)); return Response.json({ name: client.name, scopes }, { headers: { "Cache-Control": "no-store" } }); }
  catch (error) { return apiError(error); }
}
export async function POST(request: Request) {
  try {
    rateLimit(request, "oauth-consent", 30); const account = await requireAccount(request); const redirect = await authorize(account.uid, await readJson(request, 16000)); return Response.json({ redirect }, { headers: { "Cache-Control": "no-store" } }); }
  catch (error) { return apiError(error); }
}
