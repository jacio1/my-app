import { rateLimit } from "@/lib/server/rate-limit";
import { apiError, ApiError } from "@/lib/server/firebase-admin";
import { exchangeToken } from "@/lib/server/oauth";

export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    rateLimit(request, "oauth-token", 60);
    if (!request.headers.get("content-type")?.includes("application/x-www-form-urlencoded")) throw new ApiError(400, "invalid_request");
    const raw = await request.text();
    if (raw.length > 16000) throw new ApiError(413, "invalid_request");
    return Response.json(await exchangeToken(new URLSearchParams(raw)), { headers: { "Cache-Control": "no-store", Pragma: "no-cache" } });
  } catch (error) {
    const response = apiError(error);
    if (error instanceof ApiError && error.status === 400) return Response.json({ error: error.message }, { status: 400, headers: { "Cache-Control": "no-store" } });
    return response;
  }
}
