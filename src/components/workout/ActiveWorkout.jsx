/**
 * ActiveWorkout.jsx
 * Main component for an in-progress workout session.
 * Handles set completion, sync, and persist without ever resetting
 * timer state as a side effect of network or storage failures.
 */
import React, { useEffect, useRef, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  addSet,
  tickElapsed,
  syncStarted,
  syncSucceeded,
  syncFailed,
  persistStarted,
  persistSucceeded,
  persistFailed,
  selectElapsed,
  selectSets,
  selectSessionId,
} from '../../store/workoutSessionSlice';
import { WorkoutTimer } from '../../timer/WorkoutTimer';
import { WorkoutSession } from '../../session/WorkoutSession';
import { syncWorkoutSession } from '../../api/workoutSync';
import { formatElapsed } from '../../utils/timeFormat';

export default function ActiveWorkout() {
  const dispatch = useDispatch();
  const elapsed = useSelector(selectElapsed);
  const sets = useSelector(selectSets);
  const sessionId = useSelector(selectSessionId);

  // Stable refs — never cause re-renders on their own
  const sessionRef = useRef(null);
  const timerRef = useRef(null);

  // Initialize session and timer on mount
  useEffect(() => {
    let cancelled = false;

    async function init() {
      // Attempt to restore an existing session
      let session = sessionId ? await WorkoutSession.load(sessionId) : null;
      if (!session) {
        session = new WorkoutSession();
      }
      if (cancelled) return;

      sessionRef.current = session;

      const timer = new WorkoutTimer(session);
      timerRef.current = timer;

      timer.start((currentElapsed) => {
        // Check for unexpected resets and warn — do not apply them
        if (currentElapsed === 0 && elapsed > 10) {
          console.warn(
            `[WARN] Timer state mismatch: expected ${elapsed}s, got ${currentElapsed} — preserving Redux state`
          );
          return;
        }
        dispatch(tickElapsed(currentElapsed));
      });
    }

    init().catch((e) => console.error('ActiveWorkout: init failed:', e));

    return () => {
      cancelled = true;
      timerRef.current?.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // mount only

  /**
   * Handle set completion.
   * Sync and persist failures are fully isolated — they NEVER reset the timer
   * or re-initialize the session. Errors are dispatched as status flags only.
   */
  const handleSetComplete = useCallback(
    async (setData) => {
      // 1. Update Redux state immediately (optimistic)
      dispatch(addSet(setData));

      // 2. Update session object if available
      if (sessionRef.current) {
        sessionRef.current.addSet(setData);
      }

      // 3. Sync to server — failure is safe: queued for retry in workoutSync.js
      dispatch(syncStarted());
      try {
        await syncWorkoutSession({
          sessionId: sessionRef.current?.id,
          elapsed: timerRef.current?.getElapsed() ?? elapsed,
          sets: sessionRef.current?.sets ?? sets,
        });
        dispatch(syncSucceeded());
      } catch (syncErr) {
        // syncWorkoutSession internally handles retries and offline queuing
        // — this catch is a safety net only
        console.error('ActiveWorkout: sync error (payload queued):', syncErr);
        dispatch(syncFailed(syncErr?.message));
        // *** DO NOT call initSession() or reset anything here ***
      }

      // 4. Persist locally — failure is safe: logged, localStorage fallback attempted
      dispatch(persistStarted());
      try {
        if (sessionRef.current) {
          await sessionRef.current.persist();
        }
        dispatch(persistSucceeded());
      } catch (persistErr) {
        // WorkoutSession.persist() should never throw, but guard anyway
        console.error('ActiveWorkout: persist error:', persistErr);
        dispatch(persistFailed(persistErr?.message));
        // *** DO NOT reset session or timer here ***
      }
    },
    [dispatch, elapsed, sets]
  );

  return (
    <div className="active-workout">
      <header className="workout-header">
        <h1>Active Workout</h1>
        <div className="timer" aria-live="polite" aria-label="Workout timer">
          {formatElapsed(elapsed)}
        </div>
      </header>

      <section className="sets-list">
        {sets.map((set, idx) => (
          <div key={idx} className="set-row">
            <span>{set.exercise}</span>
            <span>{set.reps} × {set.weight}kg</span>
          </div>
        ))}
      </section>

      <button
        id="set-complete-btn"
        className="btn-primary"
        onClick={() =>
          handleSetComplete({
            exercise: 'Squat', // replaced by real form state in production
            reps: 8,
            weight: 100,
            completedAt: Date.now(),
          })
        }
      >
        Complete Set
      </button>
    </div>
  );
}
