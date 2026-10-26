import { createAsyncThunk } from "@reduxjs/toolkit";
import type { AppDispatch, RootState } from "@/store/store";
import {
  GoogleAuthError,
  describeAuthError,
  getStoredProfile,
  hasStoredProfile,
  hasValidToken,
  isGoogleAuthConfigured,
  loadProfile,
  signIn,
  signInSilently,
  signOut as googleSignOut,
} from "@/lib/auth";
import {
  DriveError,
  forgetFileId,
  getRememberedFileId,
  loadFromDrive,
  saveToDrive,
} from "@/lib/drive";
import { EMPTY_DIARY, normalizeDiary, type DiaryData } from "@/lib/types";
import {
  markAutoTried,
  markHydrated,
  markSynced,
  resetDrive,
  setData,
  setError,
  setFileId,
  setProfile,
  setSessionActive,
  setStatus,
} from "./driveSlice";

const CACHE_KEY = "diary.data";
const DIRTY_KEY = "diary.data:dirty";
const SAVE_DELAY_MS = 1500;

type ThunkConfig = { state: RootState; dispatch: AppDispatch };


function readCachedDiary(): DiaryData | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? normalizeDiary(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

function writeCachedDiary(data: DiaryData): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(data));
  } catch {
  }
}

function markDirty(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(DIRTY_KEY, "1");
  } catch {
  }
}

function clearDirty(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(DIRTY_KEY);
  } catch {
  }
}

function isDirty(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(DIRTY_KEY) === "1";
  } catch {
    return false;
  }
}

function messageOf(error: unknown): string {
  if (error instanceof GoogleAuthError || error instanceof DriveError) return error.message;
  return describeAuthError(error);
}

function isAuthFailure(error: unknown): boolean {
  return error instanceof GoogleAuthError;
}

async function pullOrPush(
  dispatch: AppDispatch,
  getState: () => RootState,
): Promise<void> {
  const local = getState().drive.data;
  const remote = await loadFromDrive();
  const dirty = isDirty();

  if (!remote) {
    const initial = normalizeDiary(local);
    const fileId = await saveToDrive(initial, null);
    dispatch(setFileId(fileId));
    if (!local) dispatch(setData(initial));
    writeCachedDiary(initial);
    clearDirty();
    dispatch(markSynced());
    return;
  }

  if (dirty && local) {
    const fileId = await saveToDrive(normalizeDiary(local), remote.fileId);
    dispatch(setFileId(fileId));
    clearDirty();
    dispatch(markSynced());
    return;
  }

  const remoteData = normalizeDiary(remote.data);
  dispatch(setData(remoteData));
  dispatch(setFileId(remote.fileId));
  writeCachedDiary(remoteData);
  clearDirty();
  dispatch(markSynced());
}

export const hydrateFromCache = createAsyncThunk<void, void, ThunkConfig>(
  "drive/hydrate",
  async (_, { dispatch, getState }) => {
    if (getState().drive.hydrated) return;

    dispatch(setData(readCachedDiary() ?? EMPTY_DIARY));

    const storedProfile = getStoredProfile();
    if (storedProfile) dispatch(setProfile(storedProfile));

    const storedFileId = getRememberedFileId();
    if (storedFileId) dispatch(setFileId(storedFileId));

    dispatch(markHydrated());
  },
);

export const autoConnect = createAsyncThunk<void, void, ThunkConfig>(
  "drive/autoConnect",
  async (_, { dispatch, getState }) => {
    if (getState().drive.autoTried) return;
    dispatch(markAutoTried());

    if (!isGoogleAuthConfigured()) return;
    if (!hasStoredProfile() && !hasValidToken()) return;

    dispatch(setStatus("loading"));
    try {
      const profile = hasValidToken() ? await loadProfile() : await signInSilently();
      dispatch(setProfile(profile));
      await pullOrPush(dispatch, getState);
      dispatch(setSessionActive(true));
      dispatch(setStatus("ready"));
    } catch {
      dispatch(setSessionActive(false));
      dispatch(setStatus("signed-out"));
    }
  },
);

export const connectDrive = createAsyncThunk<void, void, ThunkConfig>(
  "drive/connect",
  async (_, { dispatch, getState }) => {
    dispatch(setStatus("loading"));
    dispatch(setError(null));
    try {
      const profile = await signIn();
      dispatch(setProfile(profile));
      dispatch(setSessionActive(true));
      await pullOrPush(dispatch, getState);
      dispatch(setStatus("ready"));
    } catch (error) {
      if (isAuthFailure(error)) {
        dispatch(setSessionActive(false));
        dispatch(setStatus("signed-out"));
      } else {
        dispatch(setStatus("error"));
      }
      dispatch(setError(messageOf(error)));
    }
  },
);

export const syncNow = createAsyncThunk<void, void, ThunkConfig>(
  "drive/syncNow",
  async (_, { dispatch, getState }) => {
    dispatch(setStatus("loading"));
    dispatch(setError(null));
    try {
      if (!hasValidToken()) {
        throw new GoogleAuthError(
          "expired",
          "Токен истёк — нажмите «Войти через Google», чтобы продлить сессию.",
        );
      }
      const profile = await loadProfile();
      dispatch(setProfile(profile));
      dispatch(setSessionActive(true));
      await pullOrPush(dispatch, getState);
      dispatch(setStatus("ready"));
    } catch (error) {
      if (isAuthFailure(error)) dispatch(setSessionActive(false));
      dispatch(setStatus("error"));
      dispatch(setError(messageOf(error)));
    }
  },
);

export const disconnectDrive = createAsyncThunk<void, void, ThunkConfig>(
  "drive/disconnect",
  async (_, { dispatch }) => {
    googleSignOut({ revokeToken: true });
    forgetFileId();
    clearDirty();
    dispatch(resetDrive());
  },
);

let saveTimer: ReturnType<typeof setTimeout> | undefined;

export const scheduleSave = createAsyncThunk<void, void, ThunkConfig>(
  "drive/scheduleSave",
  async (_, { dispatch, getState }) => {
    const state = getState().drive;
    if (!state.data) return;

    writeCachedDiary(state.data);
    markDirty();

    if (state.status === "signed-out") return; 

    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      void (async () => {
        const current = getState().drive;
        if (!current.data) return;

        dispatch(setStatus("saving"));
        dispatch(setError(null));
        try {
          const fileId = await saveToDrive(normalizeDiary(current.data), current.fileId);
          dispatch(setFileId(fileId));
          dispatch(setSessionActive(true));
          clearDirty();
          dispatch(markSynced());
          dispatch(setStatus("ready"));
        } catch (error) {
          if (isAuthFailure(error)) dispatch(setSessionActive(false));
          dispatch(setStatus("error"));
          dispatch(setError(messageOf(error)));
        }
      })();
    }, SAVE_DELAY_MS);
  },
);
