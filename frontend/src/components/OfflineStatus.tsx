"use client";

import { runSyncCycle } from "@/lib/sync-engine";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { setOffline, setOnline, setSyncFailed, setSyncing } from "@/store/slices/syncSlice";

const labels = {
  offline: "Offline Database",
  online: "Online • Synced",
  syncing: "Syncing...",
  failed: "Sync Failed",
};

export function OfflineStatus() {
  const dispatch = useAppDispatch();
  const sync = useAppSelector((state) => state.sync);

  const syncNow = async () => {
    dispatch(setSyncing());
    try {
      const result = await runSyncCycle(true);
      if (!result.online) dispatch(setOffline(result.pending));
      else dispatch(setOnline({ pendingCount: result.pending }));
    } catch (error) {
      dispatch(setSyncFailed({
        error: error instanceof Error ? error.message : "Sync failed",
        pendingCount: sync.pendingCount,
      }));
    }
  };

  return (
    <button
      type="button"
      className={`offline-status ${sync.status}`}
      onClick={syncNow}
      title={sync.error || "Click to sync now"}
    >
      <span className="offline-status-dot" />
      <span>{labels[sync.status]}</span>
      {sync.pendingCount > 0 ? <b>{sync.pendingCount}</b> : null}
    </button>
  );
}
