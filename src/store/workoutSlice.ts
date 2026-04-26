import { createSlice, PayloadAction } from '@reduxjs/toolkit';

/**
 * WorkoutState
 *
 * startTimestamp / pausedAtMs replace the old `elapsedSeconds` counter so
 * that the Redux store is the wall-clock source of truth rather than an
 * incrementing integer that drifts during screen-lock.
 */
export interface WorkoutState {
  isActive: boolean;
  isPaused: boolean;
  /**
   * Unix ms timestamp at which the current workout segment started.
   * Adjusted to account for already-elapsed time on resume, so that
   * `Date.now() - startTimestamp` always equals true elapsed ms.
   */
  startTimestamp: number | null;
  /**
   * Number of ms elapsed at the moment the user paused.
   * Used to offset startTimestamp when the workout is resumed.
   */
  pausedAtMs: number;
  /** Derived / display field — updated by the timer hook on each tick. */
  elapsedSeconds: number;
  caloriesBurned: number;
  averagePace: number; // seconds per km
  distanceKm: number;
  workoutType: string;
}

const initialState: WorkoutState = {
  isActive: false,
  isPaused: false,
  startTimestamp: null,
  pausedAtMs: 0,
  elapsedSeconds: 0,
  caloriesBurned: 0,
  averagePace: 0,
  distanceKm: 0,
  workoutType: 'run',
};

const workoutSlice = createSlice({
  name: 'workout',
  initialState,
  reducers: {
    startWorkout(state, action: PayloadAction<{ workoutType?: string }>) {
      state.isActive = true;
      state.isPaused = false;
      // Anchor startTimestamp to now; no offset needed on a fresh start.
      state.startTimestamp = Date.now();
      state.pausedAtMs = 0;
      state.elapsedSeconds = 0;
      state.caloriesBurned = 0;
      state.averagePace = 0;
      state.distanceKm = 0;
      state.workoutType = action.payload.workoutType ?? 'run';
    },

    pauseWorkout(state) {
      if (!state.isActive || state.isPaused || state.startTimestamp === null)
        return;
      // Snapshot elapsed ms so we can resume accurately.
      state.pausedAtMs = Date.now() - state.startTimestamp;
      state.isPaused = true;
    },

    resumeWorkout(state) {
      if (!state.isActive || !state.isPaused) return;
      // Shift startTimestamp forward so Date.now() - startTimestamp continues
      // from where the user paused.
      state.startTimestamp = Date.now() - state.pausedAtMs;
      state.isPaused = false;
    },

    stopWorkout(state) {
      state.isActive = false;
      state.isPaused = false;
      state.startTimestamp = null;
      state.pausedAtMs = 0;
    },

    /**
     * Called by the timer hook on every tick with the wall-clock-derived
     * elapsed seconds. Also recomputes calorie / pace stats.
     */
    tickUpdate(
      state,
      action: PayloadAction<{ elapsedSeconds: number; distanceKm?: number }>,
    ) {
      const { elapsedSeconds, distanceKm } = action.payload;
      state.elapsedSeconds = elapsedSeconds;

      if (distanceKm !== undefined) {
        state.distanceKm = distanceKm;
      }

      // Calorie estimation: ~60 kcal / km for an average runner.
      // Replace with a proper MET formula as needed.
      state.caloriesBurned = Math.round(state.distanceKm * 60);

      // Average pace in seconds per km.
      state.averagePace =
        state.distanceKm > 0
          ? Math.round(elapsedSeconds / state.distanceKm)
          : 0;
    },

    updateDistance(state, action: PayloadAction<number>) {
      state.distanceKm = action.payload;
    },
  },
});

export const {
  startWorkout,
  pauseWorkout,
  resumeWorkout,
  stopWorkout,
  tickUpdate,
  updateDistance,
} = workoutSlice.actions;

export default workoutSlice.reducer;
