import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export type Status = "signed-out" | "loading" | "ready" | "saving" | "error";

type DriveState<T> = {
  data: T;
  status: Status;
  error: string | null;
  email: string | null;
  fileId: string | null;
};

const initialState = {
  data: null as unknown,
  status: "signed-out" as Status,
  error: null,
  email: null,
  fileId: null,
} satisfies DriveState<unknown>;

const driveSlice = createSlice({
  name: "drive",
  initialState,
  reducers: {
    setData(state, action: PayloadAction<unknown>) {
      state.data = action.payload;
    },
    setStatus(state, action: PayloadAction<Status>) {
      state.status = action.payload;
    },
    setError(state, action: PayloadAction<string | null>) {
      state.error = action.payload;
    },
    setEmail(state, action: PayloadAction<string | null>) {
      state.email = action.payload;
    },
    setFileId(state, action: PayloadAction<string | null>) {
      state.fileId = action.payload;
    },
  },
});

export const { setData, setStatus, setError, setEmail, setFileId } =
  driveSlice.actions;
export default driveSlice.reducer;