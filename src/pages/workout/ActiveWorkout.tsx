import React, { useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import WorkoutTimer from '../../components/workout/WorkoutTimer';
import {
  startWorkout,
  pauseWorkout,
  resumeWorkout,
  stopWorkout,
  tickUpdate,
} from '../../store/workoutSlice';
import type { RootState } from '../../store';
import { formatElapsed } from '../../utils/timerUtils';

/**
 * ActiveWorkout page
 *
 * Calorie and pace stats are derived from the wall-clock elapsed seconds
 * supplied by WorkoutTimer's onElapsedChange callback, never from an
 * independent incrementing counter.
 */
const ActiveWorkout: React.FC = () => {
  const dispatch = useDispatch();
  const { isActive, isPaused, elapsedSeconds, caloriesBurned, averagePace, distanceKm, workoutType } =
    useSelector((state: RootState) => state.workout);

  /**
   * Fired by WorkoutTimer on every tick with the wall-clock-corrected
   * elapsed seconds. Dispatch tickUpdate so Redux (and any downstream
   * selectors) always see the accurate time.
   */
  const handleElapsedChange = useCallback(
    (seconds: number) => {
      dispatch(tickUpdate({ elapsedSeconds: seconds, distanceKm }));
    },
    [dispatch, distanceKm],
  );

  const handleStart = () => {
    dispatch(startWorkout({ workoutType }));
  };

  const handlePause = () => {
    dispatch(pauseWorkout());
  };

  const handleResume = () => {
    dispatch(resumeWorkout());
  };

  const handleStop = () => {
    dispatch(stopWorkout());
  };

  const formattedPace =
    averagePace > 0 ? `${formatElapsed(averagePace)} /km` : '--:-- /km';

  return (
    <div className="active-workout">
      <h1 className="active-workout__title">
        {workoutType.charAt(0).toUpperCase() + workoutType.slice(1)}
      </h1>

      {/* Timer — drives all elapsed-time state via onElapsedChange */}
      <WorkoutTimer
        autoStart={isActive && !isPaused}
        onElapsedChange={handleElapsedChange}
      />

      <section className="active-workout__stats">
        <div className="stat">
          <span className="stat__label">Time</span>
          <span className="stat__value">{formatElapsed(elapsedSeconds)}</span>
        </div>

        <div className="stat">
          <span className="stat__label">Distance</span>
          <span className="stat__value">{distanceKm.toFixed(2)} km</span>
        </div>

        <div className="stat">
          <span className="stat__label">Calories</span>
          {/* caloriesBurned is computed from wall-clock elapsedSeconds in Redux */}
          <span className="stat__value">{caloriesBurned} kcal</span>
        </div>

        <div className="stat">
          <span className="stat__label">Avg Pace</span>
          <span className="stat__value">{formattedPace}</span>
        </div>
      </section>

      <div className="active-workout__controls">
        {!isActive && (
          <button className="btn btn--primary" onClick={handleStart}>
            Start Workout
          </button>
        )}

        {isActive && !isPaused && (
          <button className="btn btn--secondary" onClick={handlePause}>
            Pause
          </button>
        )}

        {isActive && isPaused && (
          <button className="btn btn--primary" onClick={handleResume}>
            Resume
          </button>
        )}

        {isActive && (
          <button className="btn btn--danger" onClick={handleStop}>
            End Workout
          </button>
        )}
      </div>
    </div>
  );
};

export default ActiveWorkout;
