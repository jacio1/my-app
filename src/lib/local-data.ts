export type RecordFields = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
};

export type Task = RecordFields & { completed: boolean };
export type Entry = RecordFields & { text: string };
export type Plan = Entry & { date: string };
export type Goal = Entry & { completed: boolean };
export const sections = ["tasks", "notes", "diary", "plans", "goals"] as const;
export type Section = typeof sections[number];
export type AnyRecord = Task | Entry | Plan | Goal;
export type Snapshot = {
  schemaVersion: 2;
  tasks: Task[];
  notes: Entry[];
  diary: Entry[];
  plans: Plan[];
  goals: Goal[];
};

const KEY = "my-diary-app:v1";
export const EMPTY: Snapshot = { schemaVersion: 2, tasks: [], notes: [], diary: [], plans: [], goals: [] };

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function date(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function fields(value: unknown): value is Record<string, unknown> & RecordFields {
  return object(value) && typeof value.id === "string" && !!value.id &&
    typeof value.title === "string" && date(value.createdAt) && date(value.updatedAt);
}

function list<T extends { id: string }>(value: unknown, valid: (item: unknown) => item is T): value is T[] {
  return Array.isArray(value) && value.every(valid) &&
    new Set(value.map((item) => item.id)).size === value.length;
}

export function parseSnapshot(raw: string): Snapshot {
  const value: unknown = JSON.parse(raw);
  if (!object(value) || ![1, 2].includes(value.schemaVersion as number) ||
    !list(value.tasks, (item): item is Task => fields(item) && typeof item.completed === "boolean") ||
    !list(value.notes, isEntry) || !list(value.diary, isEntry) ||
    (value.schemaVersion === 2 && (
      !list(value.plans, (item): item is Plan => isEntry(item) && ((item as Plan).date === "" || isCalendarDate((item as Plan).date))) ||
      !list(value.goals, (item): item is Goal => isEntry(item) && typeof (item as Goal).completed === "boolean")
    ))) {
    throw new Error("Некорректный формат резервной копии.");
  }
  return { schemaVersion: 2, tasks: value.tasks, notes: value.notes, diary: value.diary,
    plans: value.schemaVersion === 2 ? value.plans as Plan[] : [],
    goals: value.schemaVersion === 2 ? value.goals as Goal[] : [] };
}

export function isCalendarDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function recordDocumentId(section: Section, id: string) {
  return `${section}_${encodeURIComponent(id)}`;
}

export function changedRecords(before: Snapshot, after: Snapshot) {
  return sections.flatMap((section) => {
    const previous = new Map<string, AnyRecord>(before[section].map((record) => [record.id, record]));
    const next = new Map<string, AnyRecord>(after[section].map((record) => [record.id, record]));
    return [...new Set([...previous.keys(), ...next.keys()])].flatMap((id) => {
      const old = previous.get(id);
      const record = next.get(id);
      return JSON.stringify(old) === JSON.stringify(record) ? [] : [{ section, id, record: record ?? null, previous: old }];
    });
  });
}

export function mergeRecovery(before: Snapshot, after: Snapshot): Snapshot {
  function merge<T extends RecordFields>(a: T[], b: T[]): T[] {
    const records = new Map(a.map((record) => [record.id, record]));
    for (const record of b) {
      const previous = records.get(record.id);
      if (!previous || Date.parse(record.updatedAt) >= Date.parse(previous.updatedAt)) records.set(record.id, record);
    }
    return [...records.values()];
  }
  return { schemaVersion: 2, tasks: merge(before.tasks, after.tasks), notes: merge(before.notes, after.notes), diary: merge(before.diary, after.diary), plans: merge(before.plans, after.plans), goals: merge(before.goals, after.goals) };
}

function isEntry(value: unknown): value is Entry {
  return fields(value) && typeof value.text === "string";
}

export function saveSnapshot(snapshot: Snapshot, storage = window.localStorage) {
  storage.setItem(KEY, JSON.stringify(snapshot));
}

export function loadSnapshot(storage = window.localStorage): Snapshot {
  const saved = storage.getItem(KEY);
  if (saved !== null) return parseSnapshot(saved);

  const legacy = storage.getItem("diary-notes");
  const drive = storage.getItem("diary.data");
  if (legacy === null && drive === null) return EMPTY;

  const notes: unknown = legacy === null ? [] : JSON.parse(legacy);
  const cached: unknown = drive === null ? [] : JSON.parse(drive);
  const days = object(cached) ? cached.days : cached;
  if (!Array.isArray(notes) || !Array.isArray(days)) throw new Error("Invalid legacy data");

  const diary: Entry[] = notes.map((note: unknown) => {
    if (!object(note) || typeof note.id !== "string" || !note.id ||
      typeof note.title !== "string" || !date(note.createdAt) ||
      typeof note.dayDescription !== "string") throw new Error("Invalid legacy note");
    return {
      id: note.id, title: note.title, text: note.dayDescription,
      createdAt: note.createdAt, updatedAt: note.createdAt,
    };
  });
  for (const [index, day] of days.entries()) {
    if (!object(day) || typeof day.id !== "number" || !Number.isFinite(day.id) ||
      typeof day.title !== "string" || typeof day.description !== "string") {
      throw new Error("Invalid Drive cache");
    }
    // The Drive format has no date. Preserve list order with placeholder timestamps.
    const timestamp = new Date(days.length - index).toISOString();
    diary.push({
      id: crypto.randomUUID(), title: day.title, text: day.description,
      createdAt: timestamp, updatedAt: timestamp,
    });
  }
  const snapshot = parseSnapshot(JSON.stringify({ ...EMPTY, diary }));
  saveSnapshot(snapshot, storage);
  return snapshot;
}

export function newRecord(title: string): RecordFields {
  const now = new Date().toISOString();
  return { id: crypto.randomUUID(), title, createdAt: now, updatedAt: now };
}
