/**
 * WorkoutSession.js
 * Represents a single active workout session and handles local persistence.
 * Persist failures are isolated — they never mutate or null out session state.
 */
import { openWorkoutDB } from '../db/workoutDB';

const FALLBACK_STORAGE_KEY = 'fittrack_session_fallback';

export class WorkoutSession {
  constructor(data = {}) {
    this.id = data.id || crypto.randomUUID();
    this.elapsed = data.elapsed || 0;
    this.sets = data.sets || [];
    this.startedAt = data.startedAt || Date.now();
    this.updatedAt = data.updatedAt || Date.now();
  }

  /**
   * Persist current session state to IndexedDB.
   * Falls back to localStorage on failure (handles iOS Safari IndexedDB quirks).
   * NEVER throws — caller is always safe. NEVER resets session fields on error.
   */
  async persist() {
    const snapshot = this._snapshot();

    // Attempt IndexedDB persist
    try {
      await this._persistToIndexedDB(snapshot);
      // Clear any stale fallback entry on success
      try { localStorage.removeItem(FALLBACK_STORAGE_KEY); } catch (_) {}
      return;
    } catch (e) {
      console.error('WorkoutSession.persist() failed (IndexedDB):', e);
    }

    // Fallback: localStorage (resilient on iOS Safari)
    try {
      localStorage.setItem(FALLBACK_STORAGE_KEY, JSON.stringify(snapshot));
      console.warn('WorkoutSession: persisted to localStorage fallback.');
    } catch (fallbackErr) {
      console.error('WorkoutSession: localStorage fallback also failed:', fallbackErr);
      // Still do NOT reset session — just log and continue
    }
  }

  /**
   * Persist to IndexedDB.
   * All IDB operations are chained within the same transaction without
   * unrelated await gaps — required for iOS Safari transaction stability.
   *
   * @param {object} snapshot
   * @returns {Promise<void>}
   */
  _persistToIndexedDB(snapshot) {
    return new Promise(async (resolve, reject) => {
      let db;
      try {
        db = await openWorkoutDB();
      } catch (e) {
        return reject(e);
      }

      const tx = db.transaction('sessions', 'readwrite');
      const store = tx.objectStore('sessions');

      // Chain all IDB operations synchronously inside the transaction
      // (no unrelated awaits between put and tx.oncomplete — Safari requirement)
      const putReq = store.put(snapshot);

      putReq.onerror = () => reject(putReq.error);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(new Error('IndexedDB transaction aborted'));
    });
  }

  /**
   * Load latest session from IndexedDB, or fall back to localStorage snapshot.
   * @param {string} id
   * @returns {Promise<WorkoutSession|null>}
   */
  static async load(id) {
    try {
      const db = await openWorkoutDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('sessions', 'readonly');
        const store = tx.objectStore('sessions');
        const req = store.get(id);
        req.onsuccess = () =>
          resolve(req.result ? new WorkoutSession(req.result) : null);
        req.onerror = () => reject(req.error);
      });
    } catch (e) {
      console.error('WorkoutSession.load() IndexedDB failed, trying fallback:', e);
      try {
        const raw = localStorage.getItem(FALLBACK_STORAGE_KEY);
        if (raw) {
          const data = JSON.parse(raw);
          if (data.id === id) return new WorkoutSession(data);
        }
      } catch (_) {}
      return null;
    }
  }

  /**
   * Produce a plain serializable snapshot of current session state.
   */
  _snapshot() {
    return {
      id: this.id,
      elapsed: this.elapsed,
      sets: this.sets,
      startedAt: this.startedAt,
      updatedAt: Date.now(),
    };
  }

  addSet(set) {
    this.sets = [...this.sets, set];
    this.updatedAt = Date.now();
  }
}
