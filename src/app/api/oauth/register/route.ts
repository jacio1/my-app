import { rateLimit } from "@/lib/server/rate-limit";
import { z } from "zod";
import { apiError, ApiError, readJson } from "@/lib/server/firebase-admin";
import { registerClient } from "@/lib/server/oauth";

export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    rateLimit(request, "register", 10);
    const input = z.object({ client_name: z.string().max(100).optional(), redirect_uris: z.array(z.string().url().max(2048)).min(1).max(5), token_endpoint_auth_method: z.literal("none").optional(), grant_types: z.array(z.enum(["authorization_code", "refresh_token"])).optional(), response_types: z.array(z.literal("code")).optional() }).passthrough().safeParse(await readJson(request, 16000));
    if (!input.success) throw new ApiError(400, "invalid_client_metadata");
    const clientId = await registerClient(input.data);
    return Response.json({ client_id: clientId, client_name: input.data.client_name, redirect_uris: input.data.redirect_uris, token_endpoint_auth_method: "none", grant_types: ["authorization_code", "refresh_token"], response_types: ["code"] }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiError(error); }
}
