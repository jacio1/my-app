"use client";

import { useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import type { AppDispatch, RootState } from "@/store/store";
import {
  connectDrive, disconnectDrive, scheduleSave, hydrateFromCache,
} from "@/store/features/drive/driveThunks";
import { setData as setDataAction } from "@/store/features/drive/driveSlice";

export function useDrive<T>() {
  const dispatch = useDispatch<AppDispatch>();
  const { data, status, error, email } = useSelector(
    (s: RootState) => s.drive
  );

  const setData = useCallback(
    (updater: T | ((prev: T) => T)) => {
      const prev = data as T;
      const next =
        typeof updater === "function"
          ? (updater as (p: T) => T)(prev)
          : updater;
      dispatch(setDataAction(next as unknown));
      dispatch(scheduleSave());
    },
    [dispatch, data]
  );

  return {
    data: data as T,
    status,
    error,
    email,
    setData,
    connect: () => dispatch(connectDrive()),
    signOut: () => dispatch(disconnectDrive()),
    hydrate: () => dispatch(hydrateFromCache()),
  };
}