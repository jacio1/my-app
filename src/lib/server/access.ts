import "server-only";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { adminServices, ApiError } from "./firebase-admin";

export const hash = (value: string) => createHash("sha256").update(value).digest("hex");
export const secret = () => randomBytes(32).toString("base64url");
export const SCOPES = ["records:read", "records:write"] as const;
export type Access = { uid: string; scopes: string[]; tokenId: string };

export async function issueToken(uid: string, name: string, scopes: string[], lifetimeSeconds = 90 * 86400) {
  const token = `diary_${secret()}`;
  const tokenId = hash(token);
  const connectionId = randomUUID();
  const now = Date.now();
  const db = adminServices().db;
  const batch = db.batch();
  batch.create(db.collection("integrationConnections").doc(connectionId), { uid, name, scopes, createdAt: now, revoked: false, expiresAt: now + lifetimeSeconds * 1000 });
  batch.create(db.collection("integrationTokens").doc(tokenId), { uid, connectionId, scopes, expiresAt: now + lifetimeSeconds * 1000 });
  await batch.commit();
  return { token, id: connectionId, expiresAt: now + lifetimeSeconds * 1000 };
}

export async function requireAccess(request: Request, scope?: typeof SCOPES[number]): Promise<Access> {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer diary_") || header.length > 256) throw new ApiError(401, "Подключите приложение и предоставьте действующий токен доступа.");
  const tokenId = hash(header.slice(7));
  const snapshot = await adminServices().db.collection("integrationTokens").doc(tokenId).get();
  const token = snapshot.data();
  if (!token || token.expiresAt <= Date.now()) throw new ApiError(401, "Доступ истёк или отозван. Подключите приложение заново.");
  const connection = (await adminServices().db.collection("integrationConnections").doc(token.connectionId).get()).data();
  if (!connection || connection.revoked || connection.expiresAt <= Date.now()) throw new ApiError(401, "Доступ отозван или истёк.");
  if (scope && !token.scopes.includes(scope)) throw new ApiError(403, "У подключения нет разрешения на это действие.");
  return { uid: token.uid, scopes: token.scopes, tokenId };
}
