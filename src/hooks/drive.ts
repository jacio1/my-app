"use client";

import { getToken } from "./auth";

const FILE_NAME = "diary.json";

type DriveFile = { id: string; data: any };

async function authHeaders(): Promise<HeadersInit> {
  const t = await getToken();
  return { Authorization: `Bearer ${t}` };
}

/** Находит файл diary.json на Диске, если он есть. */
async function findFile(): Promise<{ id: string } | null> {
  const headers = await authHeaders();
  const q = encodeURIComponent(
    `name='${FILE_NAME}' and trashed=false and mimeType='application/json'`
  );
  const url = `https://www.googleapis.com/drive/v3/files?q=${q}&spaces=drive&fields=files(id,name)`;
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`Drive list failed: ${res.status}`);
  const json = (await res.json()) as { files: { id: string; name: string }[] };
  const file = json.files?.[0];
  return file ? { id: file.id } : null;
}

export async function loadFromDrive<T>(): Promise<DriveFile | null> {
  const file = await findFile();
  if (!file) return null;

  const headers = await authHeaders();
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`,
    { headers }
  );
  if (!res.ok) throw new Error(`Drive download failed: ${res.status}`);
  const data = (await res.json()) as T;
  return { id: file.id, data };
}

export async function saveToDrive<T>(
  data: T,
  existingId: string | null
): Promise<string> {
  const headers = await authHeaders();

  if (!existingId) {
    // Мультипарт-загрузка: метаданные + содержимое
    const boundary = "-------314159265358979323846";
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelimiter = `\r\n--${boundary}--`;

    const metadata = {
      name: FILE_NAME,
      mimeType: "application/json",
    };

    const body =
      delimiter +
      "Content-Type: application/json; charset=UTF-8\r\n\r\n" +
      JSON.stringify(metadata) +
      delimiter +
      "Content-Type: application/json; charset=UTF-8\r\n\r\n" +
      JSON.stringify(data) +
      closeDelimiter;

    const res = await fetch(
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id",
      {
        method: "POST",
        headers: {
          ...headers,
          "Content-Type": `multipart/related; boundary=${boundary}`,
        },
        body,
      }
    );
    if (!res.ok) throw new Error(`Drive upload failed: ${res.status}`);
    const json = (await res.json()) as { id: string };
    return json.id;
  }

  // Обновление содержимого существующего файла
  const res = await fetch(
    `https://www.googleapis.com/upload/drive/v3/files/${existingId}?uploadType=media`,
    {
      method: "PATCH",
      headers: {
        ...headers,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    }
  );
  if (!res.ok) throw new Error(`Drive update failed: ${res.status}`);
  return existingId;
}