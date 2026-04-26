import { useCallback, useEffect, useRef, useState } from 'react';
import {
  createTimer,
  formatElapsed,
  recoverPersistedStartTimestamp,
  TimerHandle,
} from '../utils/timerUtils';

export interface UseWorkoutTimerResult {
  /** True elapsed seconds derived from the wall clock. */
  elapsedSeconds: number;
  /** Human-readable mm:ss / hh:mm:ss string. */
  displayTime: string;
  isRunning: boolean;
  start: (alreadyElapsedMs?: number) => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
}

/**
 * useWorkoutTimer
 *
 * Provides a wall-clock-accurate workout timer that survives:
 *  - Android/iOS screen lock (JS throttling)
 *  - Tab backgrounding
 *  - Page reload (via localStorage recovery)
 *
 * Internally stores an absolute startTimestamp and computes elapsed as
 * Date.now() - startTimestamp on every tick and on every visibilitychange
 * event, so the displayed time is always correct regardless of how long
 * the screen was off.
 */
export function useWorkoutTimer(): UseWorkoutTimerResult {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isRunning, setIsRunning] = useState(false);

  // Ref to avoid stale-closure issues inside event listeners.
  const timerRef = useRef<TimerHandle | null>(null);
  // Track how many ms had elapsed at the point the user paused.
  const pausedAtMsRef = useRef<number>(0);

  const syncDisplay = useCallback((elapsed: number) => {
    setElapsedSeconds(elapsed);
  }, []);

  // On mount, attempt to recover an interrupted session.
  useEffect(() => {
    const persisted = recoverPersistedStartTimestamp();
    if (persisted !== null) {
      const alreadyElapsedMs = Date.now() - persisted;
      // Auto-resume the recovered session.
      const handle = createTimer(syncDisplay, alreadyElapsedMs);
      timerRef.current = handle;
      setIsRunning(true);
      // Immediately sync the display.
      syncDisplay(handle.getElapsed());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // visibilitychange listener — re-syncs the display immediately when the
  // user unlocks their phone or switches back to the tab.
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && timerRef.current) {
        syncDisplay(timerRef.current.getElapsed());
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [syncDisplay]);

  const start = useCallback(
    (alreadyElapsedMs: number = 0) => {
      if (timerRef.current) {
        timerRef.current.stop();
      }
      const handle = createTimer(syncDisplay, alreadyElapsedMs);
      timerRef.current = handle;
      setIsRunning(true);
      syncDisplay(handle.getElapsed());
    },
    [syncDisplay],
  );

  const pause = useCallback(() => {
    if (!timerRef.current) return;
    // Record elapsed ms so resume can offset correctly.
    pausedAtMsRef.current = timerRef.current.getElapsed() * 1000;
    timerRef.current.stop();
    timerRef.current = null;
    setIsRunning(false);
  }, []);

  const resume = useCallback(() => {
    if (timerRef.current) return; // already running
    const handle = createTimer(syncDisplay, pausedAtMsRef.current);
    timerRef.current = handle;
    setIsRunning(true);
    syncDisplay(handle.getElapsed());
  }, [syncDisplay]);

  const stop = useCallback(() => {
    if (timerRef.current) {
      timerRef.current.stop();
      timerRef.current = null;
    }
    pausedAtMsRef.current = 0;
    setElapsedSeconds(0);
    setIsRunning(false);
  }, []);

  // Clean up on unmount.
  useEffect(() => {
    return () => {
      timerRef.current?.stop();
    };
  }, []);

  return {
    elapsedSeconds,
    displayTime: formatElapsed(elapsedSeconds),
    isRunning,
    start,
    pause,
    resume,
    stop,
  };
}
