export type RecordFields = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
};

export type Task = RecordFields & { completed: boolean };
export type Entry = RecordFields & { text: string };
export type Snapshot = {
  schemaVersion: 1;
  tasks: Task[];
  notes: Entry[];
  diary: Entry[];
};

const KEY = "my-diary-app:v1";
const EMPTY: Snapshot = { schemaVersion: 1, tasks: [], notes: [], diary: [] };

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
  if (!object(value) || value.schemaVersion !== 1 ||
    !list(value.tasks, (item): item is Task => fields(item) && typeof item.completed === "boolean") ||
    !list(value.notes, isEntry) || !list(value.diary, isEntry)) {
    throw new Error("Некорректный формат резервной копии.");
  }
  return { schemaVersion: 1, tasks: value.tasks, notes: value.notes, diary: value.diary };
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
