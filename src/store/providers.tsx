"use client";

import { useState } from "react";
import { Provider } from "react-redux";
import { makeStore } from "./store";
import { CloudProvider } from "@/components/cloud-provider";

export default function StoreProvider({ children }: { children: React.ReactNode }) {
  const [store] = useState(makeStore);

  return <Provider store={store}><CloudProvider>{children}</CloudProvider></Provider>;
}
