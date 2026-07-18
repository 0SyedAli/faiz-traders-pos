"use client";

import { useCallback, useEffect, useRef } from "react";
import { getPendingSyncCount, runSyncCycle } from "@/lib/sync-engine";
import { getToken } from "@/lib/api";
import { useAppDispatch } from "@/store/hooks";
import { setOffline, setOnline, setPendingCount, setSyncFailed, setSyncing } from "@/store/slices/syncSlice";

const ONE_HOUR = 60 * 60 * 1000;

export function SyncBootstrap() {
  const dispatch = useAppDispatch();
  const running = useRef(false);

  const sync = useCallback(async (forcePull = false) => {
    if (!getToken()) {
      dispatch(setOffline(await getPendingSyncCount()));
      return;
    }
    if (running.current) return;
    running.current = true;
    dispatch(setSyncing());

    try {
      const result = await runSyncCycle(forcePull);
      if (!result.online) dispatch(setOffline(result.pending));
      else dispatch(setOnline({ pendingCount: result.pending }));
    } catch (error) {
      const pendingCount = await getPendingSyncCount();
      dispatch(setSyncFailed({
        error: error instanceof Error ? error.message : "Sync failed",
        pendingCount,
      }));
    } finally {
      running.current = false;
    }
  }, [dispatch]);

  useEffect(() => {
    getPendingSyncCount().then((count) => dispatch(setPendingCount(count)));
    void sync(true);

    const timer = window.setInterval(() => void sync(false), ONE_HOUR);
    const onlineHandler = () => void sync(false);
    const dataHandler = () => getPendingSyncCount().then((count) => dispatch(setPendingCount(count)));

    const authHandler = () => void sync(true);

    window.addEventListener("online", onlineHandler);
    window.addEventListener("my-store-auth-changed", authHandler);
    window.addEventListener("my-store-offline-data-updated", dataHandler);

    return () => {
      window.clearInterval(timer);
      window.removeEventListener("online", onlineHandler);
      window.removeEventListener("my-store-auth-changed", authHandler);
      window.removeEventListener("my-store-offline-data-updated", dataHandler);
    };
  }, [dispatch, sync]);

  return null;
}
