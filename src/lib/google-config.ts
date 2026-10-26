export const GOOGLE_CLIENT_ID = (process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "").trim();

export const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/drive.file",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
] as const;

export const GOOGLE_SCOPE = GOOGLE_SCOPES.join(" ");

export const CLIENT_ID_PATTERN = /^[0-9A-Za-z._-]+\.apps\.googleusercontent\.com$/;

export function isGoogleConfigured(): boolean {
  return CLIENT_ID_PATTERN.test(GOOGLE_CLIENT_ID);
}

export function clientIdProblem(): string | null {
  if (!GOOGLE_CLIENT_ID) {
    return (
      "Не задан NEXT_PUBLIC_GOOGLE_CLIENT_ID в файле .env. " +
      "Создайте OAuth Client ID в Google Cloud Console и перезапустите dev-сервер."
    );
  }
  if (!CLIENT_ID_PATTERN.test(GOOGLE_CLIENT_ID)) {
    return (
      `NEXT_PUBLIC_GOOGLE_CLIENT_ID выглядит некорректно ("${truncate(
        GOOGLE_CLIENT_ID,
      )}"). ` +
      "Ожидается строка вида 1234567890-abc123.apps.googleusercontent.com"
    );
  }
  return null;
}

export function truncate(value: string, head = 8, tail = 6): string {
  if (value.length <= head + tail + 1) return value;
  return `${value.slice(0, head)}…${value.slice(-tail)}`;
}
