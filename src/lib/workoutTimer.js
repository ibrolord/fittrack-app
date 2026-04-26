/**
 * WorkoutTimer — manages active workout session timing.
 * Bug: interval is not paused when the page becomes hidden (screen lock).
 * This causes drift on mobile — the elapsed time jumps when the user returns.
 */
let intervalId = null;
let startTimestamp = null;
let elapsedSeconds = 0;

export function startTimer(onTick) {
  if (intervalId) return; // already running
  startTimestamp = Date.now() - elapsedSeconds * 1000;
  intervalId = setInterval(() => {
    elapsedSeconds = Math.floor((Date.now() - startTimestamp) / 1000);
    onTick(elapsedSeconds);
  }, 1000);
  // Missing: document.addEventListener('visibilitychange', handleVisibility)
}

export function stopTimer() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
  elapsedSeconds = 0;
  startTimestamp = null;
}

export function pauseTimer() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}

export function resumeTimer(onTick) {
  startTimer(onTick);
}

export function getElapsed() {
  return elapsedSeconds;
}
