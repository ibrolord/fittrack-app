import React from 'react';
import { useWorkoutTimer } from '../../hooks/useWorkoutTimer';

interface WorkoutTimerProps {
  /** Called on every tick with the corrected elapsed seconds. */
  onElapsedChange?: (elapsedSeconds: number) => void;
  autoStart?: boolean;
  initialElapsedMs?: number;
}

/**
 * WorkoutTimer
 *
 * Displays the current workout elapsed time.
 * All timing logic lives in useWorkoutTimer — this component is
 * purely presentational and delegates no time arithmetic itself.
 */
export const WorkoutTimer: React.FC<WorkoutTimerProps> = ({
  onElapsedChange,
  autoStart = false,
  initialElapsedMs = 0,
}) => {
  const { displayTime, elapsedSeconds, isRunning, start, pause, resume, stop } =
    useWorkoutTimer();

  // Notify parent of elapsed changes (e.g. for calorie/pace calculations).
  const prevElapsedRef = React.useRef(-1);
  React.useEffect(() => {
    if (elapsedSeconds !== prevElapsedRef.current) {
      prevElapsedRef.current = elapsedSeconds;
      onElapsedChange?.(elapsedSeconds);
    }
  }, [elapsedSeconds, onElapsedChange]);

  // Auto-start on mount if requested.
  React.useEffect(() => {
    if (autoStart) {
      start(initialElapsedMs);
    }
    // Only run on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="workout-timer" aria-label="Workout timer" aria-live="off">
      <span className="workout-timer__display" aria-atomic="true">
        {displayTime}
      </span>

      <div className="workout-timer__controls">
        {!isRunning ? (
          <button
            className="workout-timer__btn workout-timer__btn--start"
            onClick={() => (elapsedSeconds === 0 ? start() : resume())}
            aria-label="Start timer"
          >
            {elapsedSeconds === 0 ? 'Start' : 'Resume'}
          </button>
        ) : (
          <button
            className="workout-timer__btn workout-timer__btn--pause"
            onClick={pause}
            aria-label="Pause timer"
          >
            Pause
          </button>
        )}

        <button
          className="workout-timer__btn workout-timer__btn--stop"
          onClick={stop}
          disabled={elapsedSeconds === 0 && !isRunning}
          aria-label="Stop timer"
        >
          Stop
        </button>
      </div>
    </div>
  );
};

export default WorkoutTimer;
