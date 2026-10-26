"use client";


import { getToken, clearToken, GoogleAuthError } from "./auth";

const FILE_NAME = "diary.json";
const MIME_TYPE = "application/json";
const FILE_ID_KEY = "diary.google.fileId";

export class DriveError extends Error {
  readonly status: number;

  constructor(message: string, status = 0) {
    super(message);
    this.name = "DriveError";
    this.status = status;
  }
}

let rememberedFileId: string | null = null;
let fileIdRestored = false;

function restoreFileId(): void {
  if (fileIdRestored || typeof window === "undefined") return;
  fileIdRestored = true;
  try {
    rememberedFileId = localStorage.getItem(FILE_ID_KEY);
  } catch {
    rememberedFileId = null;
  }
}

export function getRememberedFileId(): string | null {
  restoreFileId();
  return rememberedFileId;
}

export function forgetFileId(): void {
  rememberedFileId = null;
  fileIdRestored = true;
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(FILE_ID_KEY);
  } catch {
  }
}

function rememberFileId(fileId: string | null): void {
  rememberedFileId = fileId;
  fileIdRestored = true;
  if (typeof window === "undefined") return;
  try {
    if (fileId) localStorage.setItem(FILE_ID_KEY, fileId);
    else localStorage.removeItem(FILE_ID_KEY);
  } catch {
  }
}

async function authorizedFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const token = await getToken();
  const response = await fetch(url, {
    ...init,
    headers: { ...(init.headers ?? {}), Authorization: `Bearer ${token}` },
  });

  if (response.status === 401) {
    clearToken();
    throw new GoogleAuthError("expired", "Google отклонил токен (401) — войдите заново.");
  }
  return response;
}

async function driveFailure(response: Response, what: string): Promise<DriveError> {
  let detail = "";
  try {
    const json = (await response.json()) as { error?: { message?: string } };
    detail = json.error?.message ?? "";
  } catch {
  }

  const hint =
    response.status === 403
      ? " Проверьте, что у OAuth-клиента включён Google Drive API и что аккаунт добавлен в тестовые пользователи."
      : "";

  return new DriveError(
    `${what}: HTTP ${response.status}${detail ? ` — ${detail}` : ""}.${hint}`,
    response.status,
  );
}

function escapeQueryValue(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

async function findFile(): Promise<{ id: string } | null> {
  const query = [
    `name='${escapeQueryValue(FILE_NAME)}'`,
    "trashed=false",
    `mimeType='${MIME_TYPE}'`,
  ].join(" and ");

  const url =
    "https://www.googleapis.com/drive/v3/files" +
    `?q=${encodeURIComponent(query)}` +
    "&spaces=drive&orderBy=modifiedTime desc&fields=files(id,name,modifiedTime)";

  const response = await authorizedFetch(url);
  if (!response.ok) throw await driveFailure(response, "Не удалось найти diary.json");

  const json = (await response.json()) as { files?: { id: string }[] };
  return json.files?.[0] ? { id: json.files[0].id } : null;
}

export async function loadFromDrive(): Promise<{ fileId: string; data: unknown } | null> {
  const cachedId = getRememberedFileId();

  if (cachedId) {
    const response = await authorizedFetch(
      `https://www.googleapis.com/drive/v3/files/${cachedId}?alt=media`,
    );
    if (response.ok) {
      return { fileId: cachedId, data: await parseJson(response) };
    }
    if (response.status !== 404) throw await driveFailure(response, "Не удалось скачать diary.json");
    forgetFileId(); 
  }

  const found = await findFile();
  if (!found) return null;

  const response = await authorizedFetch(
    `https://www.googleapis.com/drive/v3/files/${found.id}?alt=media`,
  );
  if (!response.ok) throw await driveFailure(response, "Не удалось скачать diary.json");

  rememberFileId(found.id);
  return { fileId: found.id, data: await parseJson(response) };
}

async function parseJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text.trim()) return null; 
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new DriveError("Файл diary.json на Диске повреждён: внутри не JSON.");
  }
}

export async function saveToDrive(data: unknown, fileId: string | null): Promise<string> {
  const payload = JSON.stringify(data, null, 2);

  if (!fileId) {
    const boundary = `diary-${Math.random().toString(36).slice(2)}`;

    const body =
      `--${boundary}\r\n` +
      "Content-Type: application/json; charset=UTF-8\r\n\r\n" +
      JSON.stringify({ name: FILE_NAME, mimeType: MIME_TYPE }) +
      "\r\n" +
      `--${boundary}\r\n` +
      "Content-Type: application/json; charset=UTF-8\r\n\r\n" +
      payload +
      "\r\n" +
      `--${boundary}--`;

    const response = await authorizedFetch(
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id",
      {
        method: "POST",
        headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
        body,
      },
    );
    if (!response.ok) throw await driveFailure(response, "Не удалось создать diary.json");

    const json = (await response.json()) as { id: string };
    rememberFileId(json.id);
    return json.id;
  }

  const response = await authorizedFetch(
    `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`,
    {
      method: "PATCH",
      headers: { "Content-Type": MIME_TYPE },
      body: payload,
    },
  );

  if (response.status === 404) {
    forgetFileId();
    return saveToDrive(data, null);
  }
  if (!response.ok) throw await driveFailure(response, "Не удалось обновить diary.json");

  rememberFileId(fileId);
  return fileId;
}

export function driveFileUrl(fileId: string): string {
  return `https://drive.google.com/file/d/${fileId}/view`;
}
