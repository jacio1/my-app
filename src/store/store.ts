import { configureStore, createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { Snapshot } from "@/lib/local-data";

type LocalState = {
  snapshot: Snapshot | null;
  loaded: boolean;
};

const initialState: LocalState = { snapshot: null, loaded: false };
const local = createSlice({
  name: "local",
  initialState,
  reducers: {
    loaded: (_, action: PayloadAction<Snapshot | null>): LocalState => ({
      snapshot: action.payload,
      loaded: true,
    }),
  },
});

export const { loaded } = local.actions;
export const makeStore = () => configureStore({ reducer: { local: local.reducer } });
export type AppStore = ReturnType<typeof makeStore>;
export type RootState = ReturnType<AppStore["getState"]>;
export type AppDispatch = AppStore["dispatch"];
