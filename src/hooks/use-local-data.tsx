"use client";

import { useCloud } from "@/components/cloud-provider";
import { useAppSelector } from "@/store/hooks";

export function useLocalData() {
  const state = useAppSelector((root) => root.local);
  const { commit, error } = useCloud();
  return { ...state, commit, error };
}

export function StorageStatus({ loaded }: { loaded: boolean }) {
  const { status } = useCloud();
  if (["connecting", "loading", "offline"].includes(status)) return <p role="status">{status === "offline" ? "Для первой загрузки аккаунта подключитесь к интернету." : "Загрузка записей…"}</p>;
  return loaded
    ? <p role="alert">Не удалось загрузить локальные данные. Исходные записи сохранены в хранилище браузера.</p>
    : <p role="status">Загрузка записей…</p>;
}
