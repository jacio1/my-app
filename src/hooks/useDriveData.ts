"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { hasSignedInBefore, signIn, signOut as googleSignOut } from "./auth";
import { loadFromDrive, saveToDrive } from "./drive";

export type Status = "signed-out" | "loading" | "ready" | "saving" | "error";

const SAVE_DELAY_MS = 1500;

const isBrowser = typeof window !== "undefined";

/**
 * Хранит данные в состоянии React, кэширует в localStorage
 * и синхронизирует с JSON-файлом в Google Диске.
 */
export function useDriveData<T>(cacheKey: string, initial: T) {
  const dirtyKey = `${cacheKey}:dirty`;

  // Не трогаем localStorage в ленивом инициализаторе — он выполняется при SSR
  const [data, setData] = useState<T>(initial);
  const [status, setStatus] = useState<Status>("signed-out");
  const [error, setError] = useState<string | null>(null);

  // Гидратация из кэша — только на клиенте, после монтирования
  useEffect(() => {
    if (!isBrowser) return;
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) setData(JSON.parse(cached) as T);
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey]);

  const dataRef = useRef(data);
  dataRef.current = data;

  const fileId = useRef<string | null>(null);
  const synced = useRef(false);   // уже подключились к Диску
  const skipNext = useRef(false); // не сохранять данные, которые только что пришли с Диска
  const timer = useRef<number | undefined>(undefined);
  const autoTried = useRef(false);

  const connect = useCallback(async () => {
    if (!isBrowser) return;
    setStatus("loading");
    setError(null);
    try {
      await signIn();
      const remote = await loadFromDrive<T>();

      if (!remote) {
        // Файла ещё нет: создаём из того, что есть локально
        fileId.current = await saveToDrive(dataRef.current, null);
      } else if (localStorage.getItem(dirtyKey) === "1") {
        // Есть несохранённые локальные правки: они новее, чем на Диске
        fileId.current = await saveToDrive(dataRef.current, remote.id);
        localStorage.removeItem(dirtyKey);
      } else {
        fileId.current = remote.id;
        skipNext.current = true;
        setData(remote.data as T);
      }

      synced.current = true;
      setStatus("ready");
    } catch (e) {
      setStatus("signed-out");
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [dirtyKey]);

  // Тихая попытка входа при открытии, если ты уже входил раньше.
  useEffect(() => {
    if (!isBrowser) return;
    if (autoTried.current) return;
    autoTried.current = true;
    if (hasSignedInBefore()) void connect();
  }, [connect]);

  // Любое изменение данных: сразу в кэш, на Диск с задержкой (debounce)
  useEffect(() => {
    if (!isBrowser) return;

    try {
      localStorage.setItem(cacheKey, JSON.stringify(data));
    } catch {}

    if (skipNext.current) {
      skipNext.current = false;
      return;
    }
    if (!synced.current) return;

    try {
      localStorage.setItem(dirtyKey, "1");
    } catch {}

    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(async () => {
      setStatus("saving");
      try {
        fileId.current = await saveToDrive(data, fileId.current);
        localStorage.removeItem(dirtyKey);
        setStatus("ready");
      } catch (e) {
        setStatus("error");
        setError(e instanceof Error ? e.message : String(e));
      }
    }, SAVE_DELAY_MS);

    return () => {
      window.clearTimeout(timer.current);
    };
  }, [data, cacheKey, dirtyKey]);

  const signOut = useCallback(() => {
    googleSignOut();
    synced.current = false;
    fileId.current = null;
    setStatus("signed-out");
  }, []);

  return { data, setData, status, error, connect, signOut };
}