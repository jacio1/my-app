"use client";

const CLIENT_ID = process.env.NEXT_PUBLIC_CLIENT_ID as string;
const SCOPE = "https://www.googleapis.com/auth/drive.file";
const FLAG = "drive-signed-in";

let token: { value: string; expiresAt: number } | null = null;
let scriptPromise: Promise<void> | null = null;

declare global {
  interface Window {
    google?: any;
  }
}

const isBrowser = typeof window !== "undefined";

function loadScript(): Promise<void> {
  if (!isBrowser) {
    return Promise.reject(new Error("Google Identity Services доступен только в браузере"));
  }
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "https://accounts.google.com/gsi/client";
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () =>
        reject(new Error("Не удалось загрузить Google Identity Services"));
      document.head.appendChild(s);
    });
  }
  return scriptPromise;
}

export async function signIn(): Promise<string> {
  if (!CLIENT_ID) {
    throw new Error("NEXT_PUBLIC_CLIENT_ID не задан в .env.local");
  }
  await loadScript();
  return new Promise((resolve, reject) => {
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPE,
      callback: (resp: any) => {
        if (resp.error) return reject(new Error(resp.error));
        token = {
          value: resp.access_token,
          // минус минута запас
          expiresAt: Date.now() + Number(resp.expires_in) * 1000 - 60_000,
        };
        try {
          localStorage.setItem(FLAG, "1");
        } catch {}
        resolve(resp.access_token);
      },
      error_callback: (err: any) => reject(new Error(err?.type ?? "auth error")),
    });
    client.requestAccessToken();
  });
}

/** Возвращает живой токен, при необходимости запрашивает новый. */
export async function getToken(): Promise<string> {
  if (token && Date.now() < token.expiresAt) return token.value;
  return signIn();
}

export function hasSignedInBefore(): boolean {
  if (!isBrowser) return false;
  try {
    return localStorage.getItem(FLAG) === "1";
  } catch {
    return false;
  }
}

export function signOut(): void {
  if (isBrowser && token && window.google?.accounts?.oauth2) {
    window.google.accounts.oauth2.revoke(token.value, () => {});
  }
  token = null;
  if (isBrowser) {
    try {
      localStorage.removeItem(FLAG);
    } catch {}
  }
}