/**
 * timerUtils.ts
 *
 * Wall-clock based timer utilities.
 * Uses Date.now() as the source of truth so that background throttling,
 * screen locks, and tab suspension do NOT cause elapsed-time drift.
 */

const STORAGE_KEY = 'fittrack_workout_start_ts';

export interface TimerHandle {
  /** Returns elapsed seconds computed from the wall clock. */
  getElapsed: () => number;
  /** Cleans up the interval. */
  stop: () => void;
}

/**
 * Creates a wall-clock timer.
 *
 * @param onTick        Called every ~1 s with the true elapsed seconds.
 * @param alreadyElapsedMs  Pass a non-zero value to resume a paused session.
 * @returns TimerHandle
 */
export function createTimer(
  onTick: (elapsedSeconds: number) => void,
  alreadyElapsedMs: number = 0,
): TimerHandle {
  // Anchor the start in the past by however much time has already elapsed.
  const startTimestamp = Date.now() - alreadyElapsedMs;

  // Persist so a page reload can recover the session.
  persistStartTimestamp(startTimestamp);

  const getElapsed = (): number =>
    Math.floor((Date.now() - startTimestamp) / 1000);

  const interval = setInterval(() => {
    onTick(getElapsed());
  }, 1000);

  const stop = (): void => {
    clearInterval(interval);
    clearPersistedStartTimestamp();
  };

  return { getElapsed, stop };
}

/**
 * Attempts to recover a persisted start timestamp from a previous session.
 * Returns the timestamp in ms, or null if none exists.
 */
export function recoverPersistedStartTimestamp(): number | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return null;
    const ts = Number(raw);
    return Number.isFinite(ts) ? ts : null;
  } catch {
    return null;
  }
}

export function persistStartTimestamp(ts: number): void {
  try {
    localStorage.setItem(STORAGE_KEY, String(ts));
  } catch {
    // Storage unavailable — non-fatal.
  }
}

export function clearPersistedStartTimestamp(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Non-fatal.
  }
}

/**
 * Formats elapsed seconds into mm:ss or hh:mm:ss.
 */
export function formatElapsed(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;

  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');

  if (h > 0) {
    return `${String(h).padStart(2, '0')}:${mm}:${ss}`;
  }
  return `${mm}:${ss}`;
}
