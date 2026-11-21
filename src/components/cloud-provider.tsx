"use client";

import { Fragment, createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut, type User } from "firebase/auth";
import { collection, doc, onSnapshot, writeBatch } from "firebase/firestore";
import { cloudConfigured, firebaseClient } from "@/lib/firebase-client";
import { changedRecords, loadSnapshot, mergeRecovery, parseSnapshot, recordDocumentId, saveSnapshot, sections, type Snapshot, type Section, type RecordFields } from "@/lib/local-data";
import { loaded } from "@/store/store";
import { useAppStore } from "@/store/hooks";

type SyncState = "loading" | "local" | "connecting" | "synced" | "pending" | "offline" | "error";
type CloudContext = {
  user: User | null; status: SyncState; error: string; ready: boolean;
  login: () => Promise<void>; logout: () => Promise<void>;
  commit: (update: (snapshot: Snapshot) => Snapshot) => boolean;
  importLocal: () => boolean;
  recovery: Snapshot | null;
};
const Context = createContext<CloudContext | null>(null);

export function useCloud() {
  const context = useContext(Context);
  if (!context) throw new Error("CloudProvider is missing");
  return context;
}

export function CloudProvider({ children }: { children: React.ReactNode }) {
  const store = useAppStore();
  const [user, setUser] = useState<User | null>(null);
  const userRef = useRef<User | null>(null);
  const [status, setStatus] = useState<SyncState>("loading");
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const canEdit = useRef(false);
  const hasPending = useRef(false);
  const knownCloudRecords = useRef(new Set<string>());
  const [recovery, setRecovery] = useState<Snapshot | null>(null);
  const recoveryRef = useRef<Snapshot | null>(null);
  const rejected = useRef("");

  useEffect(() => {
    let unsubscribeRecords: (() => void) | undefined;
    let active = true;
    const onStorage = (event: StorageEvent) => {
      if (!userRef.current && event.key === "my-diary-app:v1") {
        try { store.dispatch(loaded(loadSnapshot())); } catch { setError("Не удалось загрузить изменения из другой вкладки."); }
      }
    };
    window.addEventListener("storage", onStorage);
    function guest() {
      try { store.dispatch(loaded(loadSnapshot())); setStatus("local"); canEdit.current = true; }
      catch { store.dispatch(loaded(null)); setStatus("error"); setError("Не удалось прочитать локальные записи. Сохранённые данные не изменены."); }
      setReady(true);
    }
    if (!cloudConfigured) { guest(); return () => window.removeEventListener("storage", onStorage); }
    const { auth, db } = firebaseClient();
    const unsubscribeAuth = onAuthStateChanged(auth, (account) => {
      if (!active) return;
      unsubscribeRecords?.();
      userRef.current = account;
      canEdit.current = false;
      hasPending.current = false;
      knownCloudRecords.current.clear();
      setUser(account);
      setError("");
      rejected.current = "";
      try {
        const saved = account ? localStorage.getItem(`diary:recovery:${account.uid}`) : null;
        recoveryRef.current = saved ? parseSnapshot(saved) : null;
      } catch { recoveryRef.current = null; }
      setRecovery(recoveryRef.current);
      if (!account) { guest(); return; }
      setReady(false);
      setStatus("connecting");
      // Account data and guest data never share a storage key.
      try {
        const cache = localStorage.getItem(`diary:account:${account.uid}`);
        store.dispatch(loaded(cache ? parseSnapshot(cache) : null));
      } catch { store.dispatch(loaded(null)); }
      unsubscribeRecords = onSnapshot(collection(db, "users", account.uid, "records"), { includeMetadataChanges: true }, (result) => {
        if (!active || userRef.current?.uid !== account.uid) return;
        // An empty offline cache must not replace a previously saved account snapshot.
        if (result.empty && result.metadata.fromCache && !result.metadata.hasPendingWrites) {
          setStatus(navigator.onLine ? "connecting" : "offline");
          return;
        }
        try {
          const raw: Record<string, unknown[]> = Object.fromEntries(sections.map((section) => [section, []]));
          result.forEach((item) => {
            const { section, deleted, ...record } = item.data();
            if (!sections.includes(section as Section)) throw new Error("Unknown cloud record");
            knownCloudRecords.current.add(recordDocumentId(section as Section, record.id));
            if (!deleted) raw[section as Section].push(record);
          });
          const next = parseSnapshot(JSON.stringify({ schemaVersion: 2, ...raw }));
          store.dispatch(loaded(next));
          try { localStorage.setItem(`diary:account:${account.uid}`, JSON.stringify(next)); } catch { /* Firestore persists its own cache. */ }
          hasPending.current = result.metadata.hasPendingWrites;
          canEdit.current = true;
          setReady(true);
          setStatus(result.metadata.hasPendingWrites ? "pending" : result.metadata.fromCache ? "offline" : "synced");
          setError(rejected.current);
        } catch {
          canEdit.current = false;
          setReady(false);
          setStatus("error");
          setError("В облаке обнаружены записи неизвестного формата. Редактирование остановлено, чтобы сохранить данные.");
        }
      }, () => {
        canEdit.current = false;
        setReady(false);
        setStatus("error");
        setError("Нет доступа к синхронизации. Проверьте вход, подключение Firestore и правила доступа в Firebase.");
      });
    }, () => { setStatus("error"); setError("Не удалось проверить аккаунт. Перезагрузите страницу."); });
    const onNetwork = () => { if (userRef.current) setStatus(navigator.onLine ? "connecting" : "offline"); };
    window.addEventListener("online", onNetwork);
    window.addEventListener("offline", onNetwork);
    return () => { active = false; unsubscribeAuth(); unsubscribeRecords?.(); window.removeEventListener("online", onNetwork); window.removeEventListener("offline", onNetwork); window.removeEventListener("storage", onStorage); };
  }, [store]);

  const commit = useCallback((update: (snapshot: Snapshot) => Snapshot) => {
    const before = store.getState().local.snapshot;
    if (!before || !canEdit.current) { setError("Дождитесь загрузки данных аккаунта перед редактированием."); return false; }
    try {
      const next = parseSnapshot(JSON.stringify(update(before)));
      const account = userRef.current;
      if (!account) { saveSnapshot(next); store.dispatch(loaded(next)); setError(""); return true; }
      const changes = changedRecords(before, next);
      if (changes.length > 450) throw new Error("За один раз можно изменить не больше 450 записей. Разделите импорт на части.");
      const { db } = firebaseClient();
      const batch = writeBatch(db);
      for (const change of changes) {
        const reference = doc(db, "users", account.uid, "records", recordDocumentId(change.section, change.id));
        if (!change.record) {
          batch.set(reference, { ...change.previous, section: change.section, deleted: true, updatedAt: new Date().toISOString() });
        } else {
          // Patch changed fields so independent edits to the same record can merge.
          const patch = Object.fromEntries(Object.entries(change.record).filter(([key, value]) => !change.previous || value !== change.previous[key as keyof typeof change.previous]));
          batch.set(reference, { ...patch, section: change.section, deleted: false }, { merge: true });
        }
      }
      if (!changes.length) return true;
      hasPending.current = true;
      setStatus(navigator.onLine ? "pending" : "offline");
      setError("");
      void batch.commit().then(() => {
        if (userRef.current?.uid === account.uid) { rejected.current = ""; setError(""); }
      }).catch(() => {
        if (userRef.current?.uid !== account.uid) return;
        recoveryRef.current = recoveryRef.current ? mergeRecovery(recoveryRef.current, next) : next;
        setRecovery(recoveryRef.current);
        try { localStorage.setItem(`diary:recovery:${account.uid}`, JSON.stringify(recoveryRef.current)); } catch { /* The current tab still offers an export. */ }
        setStatus("error");
        rejected.current = "Сервер отклонил изменения. Они не синхронизированы. В профиле можно скачать копию отклонённых правок; затем проверьте правила доступа и повторите действие.";
        setError(rejected.current);
      });
      // Firestore's local listener applies the batch and persists it to IndexedDB.
      store.dispatch(loaded(next));
      return true;
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Не удалось сохранить изменения.");
      return false;
    }
  }, [store]);

  async function login() {
    setError("");
    if (!cloudConfigured) { setError("Для входа настройте Firebase. Инструкция находится в README проекта."); return; }
    try { await signInWithPopup(firebaseClient().auth, new GoogleAuthProvider()); }
    catch { setError("Вход не завершён. Разрешите всплывающее окно, включите Google в Firebase Authentication и проверьте разрешённый домен."); }
  }
  async function logout() {
    if (hasPending.current) { setError("Сначала дождитесь синхронизации изменений и подключения к интернету."); return; }
    try { await signOut(firebaseClient().auth); }
    catch { setError("Не удалось выйти из аккаунта. Повторите попытку."); }
  }
  function importLocal() {
    if (!userRef.current) return false;
    try {
      const guest = loadSnapshot();
      return commit((current) => {
        function merge<T extends RecordFields>(existing: T[], local: T[], section: Section): T[] {
          // Repeated imports are idempotent; account versions always take precedence.
          const known = new Set(existing.map(({ id }) => id));
          return [...existing, ...local.filter(({ id }) => !known.has(id) && !knownCloudRecords.current.has(recordDocumentId(section, id)))];
        }
        return { ...current,
          tasks: merge(current.tasks, guest.tasks, "tasks"),
          notes: merge(current.notes, guest.notes, "notes"),
          diary: merge(current.diary, guest.diary, "diary"),
          plans: merge(current.plans, guest.plans, "plans"),
          goals: merge(current.goals, guest.goals, "goals"),
        };
      });
    } catch { setError("Не удалось прочитать локальные записи."); return false; }
  }
  return <Context.Provider value={{ user, status, error, ready, commit, login, logout, importLocal, recovery }}><Fragment key={user?.uid ?? "guest"}>{children}</Fragment></Context.Provider>;
}
