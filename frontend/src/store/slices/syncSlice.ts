import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { SyncStatus } from "@/types/offline";

type SyncState = {
  status: SyncStatus;
  pendingCount: number;
  lastSyncAt: string | null;
  error: string | null;
};

const initialState: SyncState = {
  status: "offline",
  pendingCount: 0,
  lastSyncAt: null,
  error: null,
};

const syncSlice = createSlice({
  name: "sync",
  initialState,
  reducers: {
    setSyncing(state) {
      state.status = "syncing";
      state.error = null;
    },
    setOnline(state, action: PayloadAction<{ pendingCount: number; lastSyncAt?: string }>) {
      state.status = "online";
      state.pendingCount = action.payload.pendingCount;
      state.lastSyncAt = action.payload.lastSyncAt || new Date().toISOString();
      state.error = null;
    },
    setOffline(state, action: PayloadAction<number>) {
      state.status = "offline";
      state.pendingCount = action.payload;
    },
    setSyncFailed(state, action: PayloadAction<{ error: string; pendingCount: number }>) {
      state.status = "failed";
      state.error = action.payload.error;
      state.pendingCount = action.payload.pendingCount;
    },
    setPendingCount(state, action: PayloadAction<number>) {
      state.pendingCount = action.payload;
    },
  },
});

export const { setSyncing, setOnline, setOffline, setSyncFailed, setPendingCount } = syncSlice.actions;
export default syncSlice.reducer;
