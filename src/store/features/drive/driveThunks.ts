// store/driveThunks.ts
import { createAsyncThunk } from "@reduxjs/toolkit";
import type { RootState, AppDispatch } from "@/store/store";
import { loadFromDrive, saveToDrive } from "@/lib/drive";
import { getEmail, signIn, signOut as googleSignOut } from "@/lib/auth";
import {
  setData, setStatus, setError, setEmail, setFileId,
} from "./driveSlice";

const CACHE_KEY = "days-cache";
const DIRTY_KEY = "days-cache:dirty";
const SAVE_DELAY_MS = 1500;

// ── 1. гидратация из localStorage ──
export const hydrateFromCache = createAsyncThunk<void, void, { state: RootState }>(
  "drive/hydrate",
  async (_, { dispatch }) => {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) dispatch(setData(JSON.parse(cached)));
    } catch {}
    const em = getEmail();
    if (em) dispatch(setEmail(em));
  }
);

// ── 2. подключение к Диску (аналог connect) ──
export const connectDrive = createAsyncThunk<void, void, { state: RootState }>(
  "drive/connect",
  async (_, { dispatch, getState }) => {
    dispatch(setStatus("loading"));
    dispatch(setError(null));
    try {
      await signIn();                          // ← окно Google
      const remote = await loadFromDrive<unknown>();
      // ... остальное
      dispatch(setStatus("ready"));
    } catch (e) {
      console.error("[connectDrive] caught:", e);   // ← ВОТ ЭТО
      dispatch(setStatus("signed-out"));
      dispatch(setError(e instanceof Error ? e.message : String(e)));
    }
  }
);
// ── 3. выход ──
export const disconnectDrive = createAsyncThunk<void, void>(
  "drive/disconnect",
  async (_, { dispatch }) => {
    googleSignOut();
    dispatch(setStatus("signed-out"));
    dispatch(setFileId(null));
    dispatch(setEmail(null));
  }
);

// ── 4. сохранение с debounce ──
let saveTimer: ReturnType<typeof setTimeout> | undefined;

export const scheduleSave = createAsyncThunk<void, void, { state: RootState }>(
  "drive/scheduleSave",
  async (_, { dispatch, getState }) => {
    const state = getState().drive;
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(state.data));
    } catch {}

    if (state.status === "signed-out") return;

    try { localStorage.setItem(DIRTY_KEY, "1"); } catch {}

    clearTimeout(saveTimer);
    saveTimer = setTimeout(async () => {
      dispatch(setStatus("saving"));
      try {
        const current = getState().drive;
        const id = await saveToDrive(current.data, current.fileId);
        dispatch(setFileId(id));
        localStorage.removeItem(DIRTY_KEY);
        dispatch(setStatus("ready"));
      } catch (e) {
        dispatch(setStatus("error"));
        dispatch(setError(e instanceof Error ? e.message : String(e)));
      }
    }, SAVE_DELAY_MS);
  }
);