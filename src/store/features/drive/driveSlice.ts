import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { DiaryData, DriveStatus, GoogleProfile } from "@/lib/types";

export type DriveState = {
  data: DiaryData | null;
  status: DriveStatus;
  error: string | null;
  profile: GoogleProfile | null;
  fileId: string | null;
  lastSyncedAt: number | null;
  hydrated: boolean;
  autoTried: boolean;
  sessionActive: boolean;
};

const initialState: DriveState = {
  data: null,
  status: "signed-out",
  error: null,
  profile: null,
  fileId: null,
  lastSyncedAt: null,
  hydrated: false,
  autoTried: false,
  sessionActive: false,
};

const driveSlice = createSlice({
  name: "drive",
  initialState,
  reducers: {
    setData(state, action: PayloadAction<DiaryData>) {
      state.data = action.payload;
    },
    setStatus(state, action: PayloadAction<DriveStatus>) {
      state.status = action.payload;
    },
    setError(state, action: PayloadAction<string | null>) {
      state.error = action.payload;
    },
    setProfile(state, action: PayloadAction<GoogleProfile | null>) {
      state.profile = action.payload;
    },
    setFileId(state, action: PayloadAction<string | null>) {
      state.fileId = action.payload;
    },
    markSynced(state) {
      state.lastSyncedAt = Date.now();
    },
    markHydrated(state) {
      state.hydrated = true;
    },
    markAutoTried(state) {
      state.autoTried = true;
    },
    setSessionActive(state, action: PayloadAction<boolean>) {
      state.sessionActive = action.payload;
    },
    resetDrive(state) {
      state.status = "signed-out";
      state.error = null;
      state.profile = null;
      state.fileId = null;
      state.lastSyncedAt = null;
      state.sessionActive = false;
      state.autoTried = true;
    },
  },
});

export const {
  setData,
  setStatus,
  setError,
  setProfile,
  setFileId,
  markSynced,
  markHydrated,
  markAutoTried,
  setSessionActive,
  resetDrive,
} = driveSlice.actions;

export default driveSlice.reducer;
