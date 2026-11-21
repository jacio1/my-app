import "server-only";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export function adminServices() {
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (!projectId) throw new ApiError(503, "Облако не настроено: укажите Firebase Project ID.");
  let app = getApps().find((candidate) => candidate.name === "diary-server");
  if (!app) {
    if (process.env.FIRESTORE_EMULATOR_HOST && process.env.FIREBASE_AUTH_EMULATOR_HOST) {
      app = initializeApp({ projectId }, "diary-server");
    } else {
      const credentials = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
      if (!credentials) throw new ApiError(503, "Подключение помощника ещё не настроено на сервере. Добавьте FIREBASE_SERVICE_ACCOUNT_KEY по инструкции README.");
      let serviceAccount;
      try { serviceAccount = JSON.parse(credentials); } catch { throw new ApiError(503, "Некорректная серверная конфигурация Firebase."); }
      if (serviceAccount.project_id !== projectId) throw new ApiError(503, "Сервер и приложение используют разные проекты Firebase.");
      app = initializeApp({ credential: cert(serviceAccount), projectId }, "diary-server");
    }
  }
  return { auth: getAuth(app), db: getFirestore(app) };
}

export async function requireAccount(request: Request) {
  const { auth } = adminServices();
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) throw new ApiError(401, "Войдите в аккаунт.");
  try { return await auth.verifyIdToken(header.slice(7), true); }
  catch { throw new ApiError(401, "Сессия истекла. Войдите ещё раз."); }
}

export function apiError(error: unknown) {
  const known = error instanceof ApiError;
  return Response.json({ error: known ? error.message : "Не удалось выполнить запрос. Повторите попытку." }, { status: known ? error.status : 500, headers: { "Cache-Control": "no-store" } });
}

export function appOrigin() {
  const configured = process.env.APP_URL ?? (process.env.NODE_ENV === "development" ? "http://localhost:1001" : "");
  try {
    const url = new URL(configured);
    if (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname))) throw new Error();
    return url.origin;
  } catch { throw new ApiError(503, "Задайте публичный HTTPS-адрес приложения в APP_URL."); }
}

export async function readJson(request: Request, maxBytes = 256_000): Promise<unknown> {
  if (Number(request.headers.get("content-length")) > maxBytes) throw new ApiError(413, "Слишком большой запрос.");
  const reader = request.body?.getReader();
  if (!reader) throw new ApiError(400, "Отсутствует тело запроса.");
  const chunks: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > maxBytes) { await reader.cancel(); throw new ApiError(413, "Слишком большой запрос."); }
    chunks.push(value);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); }
  catch { throw new ApiError(400, "Некорректный JSON."); }
}
