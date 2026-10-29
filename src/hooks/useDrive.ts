"use client";

import { useCallback, useEffect } from "react";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { preloadGoogleAuth } from "@/lib/old-auth";
import {
  autoConnect,
  connectDrive,
  disconnectDrive,
  hydrateFromCache,
  scheduleSave,
  syncNow,
} from "@/store/features/drive/driveThunks";
import { setData as setDataAction } from "@/store/features/drive/driveSlice";
import {
  EMPTY_DIARY,
  normalizeDiary,
  type Day,
  type DiaryData,
} from "@/lib/types";

export function useDrive() {
  const dispatch = useAppDispatch();
  const drive = useAppSelector((state) => state.drive);

  useEffect(() => {
    preloadGoogleAuth();
    void dispatch(hydrateFromCache());
    void dispatch(autoConnect());
  }, [dispatch]);

  const setData = useCallback(
    (updater: DiaryData | ((prev: DiaryData) => DiaryData)) => {
      const prev = drive.data ?? EMPTY_DIARY;
      const next = typeof updater === "function" ? updater(prev) : updater;
      dispatch(setDataAction(normalizeDiary(next)));
      void dispatch(scheduleSave());
    },
    [dispatch, drive.data],
  );

  const updateDays = useCallback(
    (updater: Day[] | ((prev: Day[]) => Day[])) => {
      setData((prev) => ({
        ...prev,
        days: typeof updater === "function" ? updater(prev.days) : updater,
      }));
    },
    [setData],
  );

  return {
    data: drive.data,
    days: drive.data?.days ?? [],
    status: drive.status,
    error: drive.error,
    profile: drive.profile,
    email: drive.profile?.email ?? null,
    sessionActive: drive.sessionActive,
    fileId: drive.fileId,
    lastSyncedAt: drive.lastSyncedAt,
    setData,
    updateDays,
    connect: () =>
      dispatch(connectDrive())
        .unwrap()
        .catch(() => undefined),
    syncNow: () =>
      dispatch(syncNow())
        .unwrap()
        .catch(() => undefined),
    signOut: () => dispatch(disconnectDrive()),
    hydrate: () => dispatch(hydrateFromCache()),
  };
}
