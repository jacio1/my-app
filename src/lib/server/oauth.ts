import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { oauthRequestSchema, validRedirect } from "@/lib/oauth-schema";
import { adminServices, appOrigin, ApiError } from "./firebase-admin";
import { hash, secret, SCOPES } from "./access";

export async function validateAuthorization(input: unknown) {
  const parsed = oauthRequestSchema.safeParse(input);
  if (!parsed.success) throw new ApiError(400, "Некорректный запрос подключения. Требуются authorization code и PKCE S256.");
  const request = parsed.data;
  if (request.resource && request.resource !== `${appOrigin()}/api/mcp`) throw new ApiError(400, "Неверный resource.");
  const scopes = [...new Set(request.scope.split(" ").filter(Boolean))];
  if (!scopes.length || scopes.some((scope) => !SCOPES.includes(scope as typeof SCOPES[number]))) throw new ApiError(400, "Неизвестные разрешения.");
  const client = (await adminServices().db.collection("oauthClients").doc(hash(request.client_id)).get()).data();
  if (!client || client.expiresAt <= Date.now() || !client.redirectUris.includes(request.redirect_uri)) throw new ApiError(400, "Клиент не зарегистрирован или адрес возврата не разрешён.");
  return { request, scopes, client };
}

export async function registerClient(input: { client_name?: string; redirect_uris: string[] }) {
  const allowed = (process.env.OAUTH_ALLOWED_REDIRECT_ORIGINS ?? "").split(",").map((value) => value.trim()).filter(Boolean);
  if (!input.redirect_uris.every((uri) => validRedirect(uri, allowed))) throw new ApiError(400, "Адрес возврата не разрешён. Владелец приложения может добавить его origin в OAUTH_ALLOWED_REDIRECT_ORIGINS.");
  const id = secret();
  await adminServices().db.collection("oauthClients").doc(hash(id)).create({ name: input.client_name ?? "Помощник", redirectUris: input.redirect_uris, expiresAt: Date.now() + 365 * 86400000 });
  return id;
}

export async function authorize(uid: string, input: unknown) {
  const { request, scopes, client } = await validateAuthorization(input);
  const code = secret();
  await adminServices().db.collection("oauthCodes").doc(hash(code)).create({ uid, clientId: request.client_id, redirectUri: request.redirect_uri, challenge: request.code_challenge, scopes, name: client.name, expiresAt: Date.now() + 300000, used: false });
  const redirect = new URL(request.redirect_uri);
  redirect.searchParams.set("code", code);
  redirect.searchParams.set("state", request.state);
  return redirect.toString();
}

export async function exchangeToken(form: URLSearchParams) {
  const grant = form.get("grant_type");
  const clientId = form.get("client_id");
  const resource = form.get("resource");
  if (!clientId || (resource && resource !== `${appOrigin()}/api/mcp`)) throw new ApiError(400, "invalid_request");
  const code = form.get(grant === "refresh_token" ? "refresh_token" : "code");
  if (!code || code.length > 128 || !["authorization_code", "refresh_token"].includes(grant ?? "")) throw new ApiError(400, "invalid_grant");
  const db = adminServices().db;
  const ref = db.collection(grant === "refresh_token" ? "oauthRefresh" : "oauthCodes").doc(hash(code));
  const accessToken = `diary_${secret()}`;
  const refreshToken = secret();
  const now = Date.now();
  const connectionId = randomUUID();
  return db.runTransaction(async (transaction) => {
    const saved = (await transaction.get(ref)).data();
    if (!saved || saved.used || saved.expiresAt <= now || saved.clientId !== clientId) throw new ApiError(400, "invalid_grant");
    let groupId = connectionId;
    if (grant === "authorization_code") {
      const verifier = form.get("code_verifier") ?? "";
      if (!/^[A-Za-z0-9._~-]{43,128}$/.test(verifier) || createHash("sha256").update(verifier).digest("base64url") !== saved.challenge || form.get("redirect_uri") !== saved.redirectUri) throw new ApiError(400, "invalid_grant");
    } else {
      groupId = saved.connectionId;
      const group = (await transaction.get(db.collection("integrationConnections").doc(groupId))).data();
      if (!group || group.revoked || group.expiresAt <= now) throw new ApiError(400, "invalid_grant");
    }
    transaction.update(ref, { used: true });
    if (grant === "authorization_code") transaction.create(db.collection("integrationConnections").doc(groupId), { uid: saved.uid, name: saved.name, scopes: saved.scopes, createdAt: now, expiresAt: now + 90 * 86400000, revoked: false });
    transaction.create(db.collection("integrationTokens").doc(hash(accessToken)), { uid: saved.uid, connectionId: groupId, scopes: saved.scopes, expiresAt: now + 3600000 });
    transaction.create(db.collection("oauthRefresh").doc(hash(refreshToken)), { uid: saved.uid, connectionId: groupId, clientId, scopes: saved.scopes, expiresAt: now + 90 * 86400000, used: false });
    return { access_token: accessToken, token_type: "Bearer", expires_in: 3600, refresh_token: refreshToken, scope: saved.scopes.join(" ") };
  });
}
