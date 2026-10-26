export type GoogleProfile = {
  email: string | null;
  name: string | null;
  picture: string | null;
};

export type DriveStatus = "signed-out" | "loading" | "ready" | "saving" | "error";

export type Day = {
  id: number;
  title: string;
  description: string;
};

export type DiaryData = {
  version: 1;
  days: Day[];
};

export const EMPTY_DIARY: DiaryData = { version: 1, days: [] };

export function normalizeDiary(raw: unknown): DiaryData {
  if (Array.isArray(raw)) {
    return { version: 1, days: sanitizeDays(raw) };
  }
  if (raw && typeof raw === "object" && Array.isArray((raw as DiaryData).days)) {
    return { version: 1, days: sanitizeDays((raw as DiaryData).days) };
  }
  return { version: 1, days: [] };
}

function sanitizeDays(value: unknown[]): Day[] {
  return value.filter(isDay).map((day) => ({
    id: Number(day.id),
    title: String(day.title ?? ""),
    description: String(day.description ?? ""),
  }));
}

function isDay(value: unknown): value is Day {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as Day).id === "number" &&
    Number.isFinite((value as Day).id)
  );
}
