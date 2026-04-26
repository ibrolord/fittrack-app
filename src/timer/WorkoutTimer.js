/**
 * WorkoutTimer.js
 * Manages the running elapsed-time counter for an active workout session.
 * Timer state is held internally and is NEVER reset by external sync/persist failures.
 */
export class WorkoutTimer {
  constructor(session) {
    this.session = session;
    // Internal elapsed is the source of truth — decoupled from session object
    this._elapsed = (session && session.elapsed) || 0;
    this._intervalId = null;
    this._onTick = null;
  }

  /**
   * Attach (or replace) the session reference without resetting elapsed.
   * Called after a session reload/re-hydration.
   */
  attachSession(session) {
    if (!session) {
      console.warn('WorkoutTimer.attachSession called with null — ignoring');
      return;
    }
    this.session = session;
    // Sync session elapsed from our authoritative in-memory value
    this.session.elapsed = this._elapsed;
  }

  /**
   * Update elapsed time.
   * SAFE: if session is null/invalid, timer state is preserved in this._elapsed
   * and the UI tick callback still fires — we just skip the session write.
   *
   * @param {number} elapsed — seconds elapsed
   */
  update(elapsed) {
    // Always update internal state first — this is the source of truth
    this._elapsed = elapsed;

    if (!this.session) {
      console.error(
        'WorkoutTimer.update called with null session; skipping session write. ' +
        'Timer state preserved at ' + elapsed + 's.'
      );
      // Do NOT reset UI — fire tick callback with preserved value
      if (typeof this._onTick === 'function') {
        this._onTick(this._elapsed);
      }
      return;
    }

    try {
      this.session.elapsed = elapsed;
    } catch (e) {
      console.error('WorkoutTimer: failed to write elapsed to session:', e);
      // Still do not crash — continue ticking
    }

    if (typeof this._onTick === 'function') {
      this._onTick(this._elapsed);
    }
  }

  /**
   * Start the timer interval.
   * @param {function} onTick — called every second with current elapsed (seconds)
   */
  start(onTick) {
    if (this._intervalId !== null) return; // already running
    this._onTick = onTick;
    const startWallTime = Date.now() - this._elapsed * 1000;

    this._intervalId = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startWallTime) / 1000);
      this.update(elapsed);
    }, 1000);
  }

  /**
   * Stop the timer without resetting elapsed.
   */
  stop() {
    if (this._intervalId !== null) {
      clearInterval(this._intervalId);
      this._intervalId = null;
    }
  }

  /**
   * Stop and reset elapsed to 0. Only call on explicit user-initiated session end.
   */
  reset() {
    this.stop();
    this._elapsed = 0;
    if (this.session) {
      this.session.elapsed = 0;
    }
  }

  getElapsed() {
    return this._elapsed;
  }

  isRunning() {
    return this._intervalId !== null;
  }
}
