import { appOrigin, apiError } from "@/lib/server/firebase-admin";

export function GET() {
  try { const origin = appOrigin(); return Response.json({ resource: `${origin}/api/mcp`, authorization_servers: [origin], scopes_supported: ["records:read", "records:write"], bearer_methods_supported: ["header"] }); }
  catch (error) { return apiError(error); }
}
