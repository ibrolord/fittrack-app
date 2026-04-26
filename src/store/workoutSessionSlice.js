/**
 * workoutSessionSlice.js
 * Redux slice for active workout session state.
 *
 * KEY INVARIANT: `elapsed` is NEVER reset as a side effect of a sync or
 * persist failure. Only an explicit `resetSession` action may clear it.
 */
import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  sessionId: null,
  elapsed: 0,       // source-of-truth elapsed seconds (owned here, not by network layer)
  sets: [],
  startedAt: null,
  syncStatus: 'idle',    // 'idle' | 'syncing' | 'error'
  persistStatus: 'idle', // 'idle' | 'persisting' | 'error'
  syncError: null,
  persistError: null,
};

const workoutSessionSlice = createSlice({
  name: 'workoutSession',
  initialState,
  reducers: {
    /**
     * Initialize a brand-new session. Only called on explicit session start.
     */
    initSession(state, action) {
      const { sessionId, startedAt } = action.payload;
      state.sessionId = sessionId;
      state.elapsed = 0;
      state.sets = [];
      state.startedAt = startedAt || Date.now();
      state.syncStatus = 'idle';
      state.persistStatus = 'idle';
      state.syncError = null;
      state.persistError = null;
    },

    /**
     * Tick: update elapsed. Never gated on sync/persist status.
     */
    tickElapsed(state, action) {
      state.elapsed = action.payload; // seconds
    },

    /**
     * Add a completed set to the session.
     */
    addSet(state, action) {
      state.sets.push(action.payload);
    },

    // --- Sync lifecycle (status only — NEVER touches elapsed) ---
    syncStarted(state) {
      state.syncStatus = 'syncing';
      state.syncError = null;
    },
    syncSucceeded(state) {
      state.syncStatus = 'idle';
      state.syncError = null;
    },
    syncFailed(state, action) {
      // Only update sync error status — do NOT touch elapsed or sets
      state.syncStatus = 'error';
      state.syncError = action.payload || 'Sync failed';
    },

    // --- Persist lifecycle (status only — NEVER touches elapsed) ---
    persistStarted(state) {
      state.persistStatus = 'persisting';
      state.persistError = null;
    },
    persistSucceeded(state) {
      state.persistStatus = 'idle';
      state.persistError = null;
    },
    persistFailed(state, action) {
      // Only update persist error status — do NOT touch elapsed or sets
      state.persistStatus = 'error';
      state.persistError = action.payload || 'Persist failed';
    },

    /**
     * Full reset — ONLY called on explicit user-initiated session end/discard.
     */
    resetSession() {
      return { ...initialState };
    },
  },
});

export const {
  initSession,
  tickElapsed,
  addSet,
  syncStarted,
  syncSucceeded,
  syncFailed,
  persistStarted,
  persistSucceeded,
  persistFailed,
  resetSession,
} = workoutSessionSlice.actions;

export default workoutSessionSlice.reducer;

// Selectors
export const selectElapsed = (state) => state.workoutSession.elapsed;
export const selectSets = (state) => state.workoutSession.sets;
export const selectSyncStatus = (state) => state.workoutSession.syncStatus;
export const selectPersistStatus = (state) => state.workoutSession.persistStatus;
export const selectSessionId = (state) => state.workoutSession.sessionId;
