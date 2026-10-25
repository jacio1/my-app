"use client";

const CLIENT_ID = process.env.NEXT_PUBLIC_CLIENT_ID as string;
const SCOPE =
  "https://www.googleapis.com/auth/drive.file " +
  "https://www.googleapis.com/auth/userinfo.email";

const TOKEN_KEY = "g-token";
const EMAIL_KEY = "g-email";
const FLAG = "drive-signed-in";

type StoredToken = { value: string; expiresAt: number };

let token: StoredToken | null = null;
let email: string | null = null;
let scriptPromise: Promise<void> | null = null;

declare global { interface Window { google?: any } }
const isBrowser = typeof window !== "undefined";

// ── восстановление из localStorage при импорте модуля ──
function restore(): void {
  if (!isBrowser || token) return;
  try {
    const raw = localStorage.getItem(TOKEN_KEY);
    if (raw) {
      const t = JSON.parse(raw) as StoredToken;
      if (t.expiresAt > Date.now()) token = t;
    }
    email = localStorage.getItem(EMAIL_KEY);
  } catch {}
}
restore();

function loadScript(): Promise<void> {
  if (!isBrowser) {
    return Promise.reject(
      new Error("Google Identity Services доступен только в браузере")
    );
  }
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise((resolve, reject) => {
    // 1. Уже готово — выходим сразу
    if (window.google?.accounts?.oauth2) {
      resolve();
      return;
    }

    // 2. Ждём появления window.google, а не просто onload
    const waitForGoogle = (deadline: number) => {
      const id = window.setInterval(() => {
        if (window.google?.accounts?.oauth2) {
          window.clearInterval(id);
          resolve();
        } else if (Date.now() > deadline) {
          window.clearInterval(id);
          reject(
            new Error("Google Identity Services не инициализировался за 10с")
          );
        }
      }, 50);
    };

    // 3. Если тег уже вставлен (HMR, повторный импорт) — не дублируем
    const existing = document.querySelector<HTMLScriptElement>(
      'script[src="https://accounts.google.com/gsi/client"]'
    );
    if (existing) {
      waitForGoogle(Date.now() + 10_000);
      return;
    }

    // 4. Вставляем скрипт и ждём window.google
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true;
    s.defer = true;
    s.onload = () => waitForGoogle(Date.now() + 10_000);
    s.onerror = () => reject(new Error("Не удалось загрузить GIS"));
    document.head.appendChild(s);
  });

  return scriptPromise;
}

async function fetchEmail(accessToken: string): Promise<string | null> {
  try {
    const res = await fetch(
      "https://www.googleapis.com/oauth2/v3/userinfo",
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!res.ok) return null;
    const j = (await res.json()) as { email?: string };
    return j.email ?? null;
  } catch { return null; }
}

export async function signIn(): Promise<string> {
  if (!CLIENT_ID) throw new Error("NEXT_PUBLIC_CLIENT_ID не задан");
  await loadScript();
  return new Promise((resolve, reject) => {
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPE,
      callback: async (resp: any) => {
        if (resp.error) return reject(new Error(resp.error));
        token = {
          value: resp.access_token,
          expiresAt: Date.now() + Number(resp.expires_in) * 1000 - 60_000,
        };
        try {
          localStorage.setItem(TOKEN_KEY, JSON.stringify(token));
          localStorage.setItem(FLAG, "1");
        } catch {}
        const e = await fetchEmail(resp.access_token);
        if (e) {
          email = e;
          try { localStorage.setItem(EMAIL_KEY, e); } catch {}
        }
        resolve(resp.access_token);
      },
      error_callback: (err: any) => reject(new Error(err?.type ?? "auth error")),
    });
    client.requestAccessToken();
  });
}

export async function getToken(): Promise<string> {
  restore();
  if (token && Date.now() < token.expiresAt) return token.value;
  return signIn();
}

export function getEmail(): string | null {
  restore();
  return email;
}

export function hasSignedInBefore(): boolean {
  if (!isBrowser) return false;
  try { return localStorage.getItem(FLAG) === "1"; } catch { return false; }
}

export function signOut(): void {
  if (isBrowser && token && window.google?.accounts?.oauth2) {
    window.google.accounts.oauth2.revoke(token.value, () => {});
  }
  token = null;
  email = null;
  if (isBrowser) {
    try {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(EMAIL_KEY);
      localStorage.removeItem(FLAG);
    } catch {}
  }
}