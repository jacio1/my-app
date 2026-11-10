"use client";

import { useEffect, useState } from "react";
import { Provider } from "react-redux";
import { loadSnapshot } from "@/lib/local-data";
import { loaded, makeStore } from "./store";

export default function StoreProvider({ children }: { children: React.ReactNode }) {
  const [store] = useState(makeStore);

  useEffect(() => {
    if (store.getState().local.loaded) return;
    try {
      store.dispatch(loaded(loadSnapshot()));
    } catch {
      store.dispatch(loaded(null));
    }
  }, [store]);

  return <Provider store={store}>{children}</Provider>;
}
