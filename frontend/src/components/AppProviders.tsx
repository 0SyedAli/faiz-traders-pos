"use client";

import { Provider } from "react-redux";
import { store } from "@/store";
import { SyncBootstrap } from "@/components/SyncBootstrap";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <Provider store={store}>
      <SyncBootstrap />
      {children}
    </Provider>
  );
}
