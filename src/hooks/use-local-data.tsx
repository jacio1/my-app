"use client";

import { useState } from "react";
import { saveSnapshot, type Snapshot } from "@/lib/local-data";
import { loaded } from "@/store/store";
import { useAppSelector, useAppStore } from "@/store/hooks";

export function useLocalData() {
  const state = useAppSelector((root) => root.local);
  const store = useAppStore();
  const [error, setError] = useState("");

  function commit(update: (snapshot: Snapshot) => Snapshot): boolean {
    const current = store.getState().local.snapshot;
    if (!current) return false;

    const next = update(current);
    try {
      saveSnapshot(next);
    } catch {
      setError("Изменения не сохранены. Проверьте доступ к хранилищу и повторите попытку.");
      return false;
    }
    store.dispatch(loaded(next));
    setError("");
    return true;
  }

  return { ...state, commit, error };
}

export function StorageStatus({ loaded }: { loaded: boolean }) {
  return loaded
    ? <p role="alert">Не удалось загрузить локальные данные. Исходные записи сохранены в хранилище браузера.</p>
    : <p role="status">Загрузка записей…</p>;
}
