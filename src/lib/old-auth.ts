"use client";


import {
  GOOGLE_CLIENT_ID,
  GOOGLE_SCOPE,
  clientIdProblem,
  isGoogleConfigured,
} from "./google-config";
import type { GoogleProfile } from "./types";

const TOKEN_KEY = "diary.google.token";
const PROFILE_KEY = "diary.google.profile";
const SCRIPT_SRC = "https://accounts.google.com/gsi/client";
const SCRIPT_TIMEOUT_MS = 10_000;


export type AuthErrorCode =
  | "not-configured"
  | "script-failed"
  | "popup-closed"
  | "popup-blocked"
  | "access-denied"
  | "expired"
  | "unknown";

export class GoogleAuthError extends Error {
  readonly code: AuthErrorCode;

  constructor(code: AuthErrorCode, message: string) {
    super(message);
    this.name = "GoogleAuthError";
    this.code = code;
  }
}

export function describeAuthError(error: unknown): string {
  if (error instanceof GoogleAuthError) return error.message;
  if (error instanceof Error) return error.message;
  return String(error);
}


type StoredToken = { value: string; expiresAt: number };

type TokenResponse = {
  access_token?: string;
  expires_in?: string | number;
  error?: string;
  error_description?: string;
};

type TokenClient = {
  requestAccessToken: (overrides?: { prompt?: string }) => void;
};

type GoogleOAuth2 = {
  initTokenClient: (config: {
    client_id: string;
    scope: string;
    prompt?: string;
    callback: (response: TokenResponse) => void;
    error_callback?: (error: { type?: string; message?: string }) => void;
  }) => TokenClient;
  revoke: (accessToken: string, done?: () => void) => void;
};

declare global {
  interface Window {
    google?: { accounts?: { oauth2?: GoogleOAuth2 } };
  }
}


const isBrowser = typeof window !== "undefined";

let token: StoredToken | null = null;
let profile: GoogleProfile | null = null;
let scriptPromise: Promise<void> | null = null;
let restored = false;

function restore(): void {
  if (!isBrowser || restored) return;
  restored = true;
  try {
    const rawToken = localStorage.getItem(TOKEN_KEY);
    if (rawToken) {
      const parsed = JSON.parse(rawToken) as StoredToken;
      if (typeof parsed?.value === "string" && typeof parsed?.expiresAt === "number") {
        token = parsed;
      }
    }
    const rawProfile = localStorage.getItem(PROFILE_KEY);
    if (rawProfile) profile = JSON.parse(rawProfile) as GoogleProfile;
  } catch {
  }
}

function persistToken(): void {
  if (!isBrowser || !token) return;
  try {
    localStorage.setItem(TOKEN_KEY, JSON.stringify(token));
  } catch {
  }
}

function persistProfile(): void {
  if (!isBrowser) return;
  try {
    if (profile) localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
    else localStorage.removeItem(PROFILE_KEY);
  } catch {
  }
}


function loadScript(): Promise<void> {
  if (!isBrowser) {
    return Promise.reject(
      new GoogleAuthError("script-failed", "Google Identity Services работает только в браузере."),
    );
  }
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise<void>((resolve, reject) => {
    if (window.google?.accounts?.oauth2) {
      resolve();
      return;
    }

    const waitForGoogle = (deadline: number) => {
      const timer = window.setInterval(() => {
        if (window.google?.accounts?.oauth2) {
          window.clearInterval(timer);
          resolve();
        } else if (Date.now() > deadline) {
          window.clearInterval(timer);
          reject(new GoogleAuthError("script-failed", "Google Identity Services не загрузился за 10 секунд."));
        }
      }, 50);
    };

    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_SRC}"]`);
    if (existing) {
      waitForGoogle(Date.now() + SCRIPT_TIMEOUT_MS);
      return;
    }

    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => waitForGoogle(Date.now() + SCRIPT_TIMEOUT_MS);
    script.onerror = () =>
      reject(new GoogleAuthError("script-failed", "Не удалось загрузить скрипт Google (проверьте сеть / блокировщики)."));
    document.head.appendChild(script);
  }).catch((error) => {
    scriptPromise = null; 
    throw error;
  });

  return scriptPromise;
}

export function preloadGoogleAuth(): void {
  if (!isBrowser) return;
  void loadScript().catch(() => {
  });
}


function assertConfigured(): void {
  const problem = clientIdProblem();
  if (problem) throw new GoogleAuthError("not-configured", problem);
}

function translateError(type?: string): GoogleAuthError {
  switch (type) {
    case "popup_closed":
    case "popup_closed_by_user":
      return new GoogleAuthError(
        "popup-closed",
        "Окно входа закрыто. Нажмите «Войти через Google» ещё раз.",
      );
    case "popup_failed_to_open":
      return new GoogleAuthError(
        "popup-blocked",
        "Браузер заблокировал окно входа — разрешите всплывающие окна для этого сайта.",
      );
    case "access_denied":
    case "consent_required":
    case "interaction_required":
      return new GoogleAuthError(
        "access-denied",
        "Google не выдал доступ. Причины: вы закрыли согласие или приложение не прошло проверку Google (для внешних пользователей нужен режим Testing + добавленный тестовый пользователь).",
      );
    default:
      return new GoogleAuthError("unknown", `Ошибка Google: ${type ?? "unknown"}`);
  }
}

function requestToken(prompt: "" | "none" | "select_account"): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const oauth2 = window.google?.accounts?.oauth2;
    if (!oauth2) {
      reject(new GoogleAuthError("script-failed", "Google Identity Services не загрузился."));
      return;
    }

    const client = oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: GOOGLE_SCOPE,
      prompt,
      callback: (response) => {
        if (response.error || !response.access_token) {
          reject(translateError(response.error ?? response.error_description));
          return;
        }
        const lifetimeSeconds = Number(response.expires_in ?? 3600);
        token = {
          value: response.access_token,
          expiresAt: Date.now() + Math.max(lifetimeSeconds - 60, 30) * 1000,
        };
        persistToken();
        resolve(response.access_token);
      },
      error_callback: (error) => reject(translateError(error?.type)),
    });

    client.requestAccessToken();
  });
}


async function fetchProfile(): Promise<GoogleProfile> {
  if (!token?.value) throw new GoogleAuthError("expired", "Нет активного токена Google.");

  const response = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${token.value}` },
    cache: "no-store",
  });

  if (response.status === 401) {
    clearToken();
    throw new GoogleAuthError("expired", "Токен Google больше не действует — войдите заново.");
  }
  if (!response.ok) {
    throw new GoogleAuthError("unknown", `Google не отдал профиль (HTTP ${response.status}).`);
  }

  const json = (await response.json()) as { email?: string; name?: string; picture?: string };
  profile = {
    email: json.email ?? null,
    name: json.name ?? null,
    picture: json.picture ?? null,
  };
  persistProfile();
  return profile;
}

export async function signIn(): Promise<GoogleProfile> {
  assertConfigured();
  await loadScript();
  await requestToken("select_account");
  return fetchProfile();
}

export async function signInSilently(): Promise<GoogleProfile> {
  assertConfigured();
  await loadScript();
  await requestToken("none");
  return fetchProfile();
}

export async function loadProfile(): Promise<GoogleProfile> {
  restore();
  if (!token?.value) {
    throw new GoogleAuthError("expired", "Нет активной сессии Google.");
  }
  return fetchProfile();
}

export async function getToken(): Promise<string> {
  restore();
  if (token && Date.now() < token.expiresAt) return token.value;
  throw new GoogleAuthError(
    "expired",
    "Сессия Google истекла (токен живёт около часа). Нажмите «Войти через Google» заново.",
  );
}

export function clearToken(): void {
  token = null;
  if (!isBrowser) return;
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
  }
}

export function getStoredProfile(): GoogleProfile | null {
  restore();
  return profile;
}

export function hasStoredProfile(): boolean {
  const stored = getStoredProfile();
  return Boolean(stored?.email);
}

export function hasValidToken(): boolean {
  restore();
  return Boolean(token && Date.now() < token.expiresAt);
}

export function isGoogleAuthConfigured(): boolean {
  return isGoogleConfigured();
}

export function signOut({ revokeToken = true }: { revokeToken?: boolean } = {}): void {
  restore();
  const accessToken = token?.value;
  if (revokeToken && accessToken && isBrowser && window.google?.accounts?.oauth2) {
    try {
      window.google.accounts.oauth2.revoke(accessToken, () => {});
    } catch {
    }
  }
  token = null;
  profile = null;
  if (!isBrowser) return;
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(PROFILE_KEY);
  } catch {
  }
}
