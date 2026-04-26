/**
 * workoutSync.js
 * Handles syncing workout session data to the remote API.
 * Uses a short client-side timeout, exponential backoff retry,
 * and an offline queue so sync failures never corrupt local state.
 */

const SYNC_ENDPOINT = '/api/workout/session/sync';
const OFFLINE_QUEUE_KEY = 'fittrack_sync_offline_queue';
const MAX_RETRIES = 3;
const BASE_TIMEOUT_MS = 9000; // 9s — well under the server's 30s gateway timeout

/**
 * Attempt to POST a session payload to the sync endpoint.
 * Retries up to MAX_RETRIES times with exponential backoff.
 * On exhausted retries, enqueues payload for background retry.
 *
 * @param {object} payload — serializable session snapshot
 * @returns {Promise<void>}
 */
export async function syncWorkoutSession(payload) {
  // Drain any previously queued payloads first (fire-and-forget)
  drainOfflineQueue().catch(() => {});

  const success = await postWithRetry(payload, MAX_RETRIES);
  if (!success) {
    console.warn('workoutSync: all retries exhausted, queuing payload for later.');
    enqueueOffline(payload);
  }
}

/**
 * POST payload with exponential backoff retry.
 * @param {object} payload
 * @param {number} retriesLeft
 * @returns {Promise<boolean>} true if sync succeeded
 */
async function postWithRetry(payload, retriesLeft) {
  const attempt = MAX_RETRIES - retriesLeft + 1;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), BASE_TIMEOUT_MS);

  try {
    const res = await fetch(SYNC_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (res.ok) return true;

    // 5xx — retryable server error
    if (res.status >= 500 && retriesLeft > 1) {
      console.warn(`workoutSync: attempt ${attempt} got ${res.status}, retrying...`);
      await backoff(attempt);
      return postWithRetry(payload, retriesLeft - 1);
    }

    // 4xx — non-retryable
    console.error(`workoutSync: non-retryable error ${res.status}`);
    return false;
  } catch (err) {
    clearTimeout(timeoutId);
    const isTimeout = err.name === 'AbortError';
    console.error(`workoutSync: attempt ${attempt} ${isTimeout ? 'timed out' : 'failed'}:`, err.message);

    if (retriesLeft > 1) {
      await backoff(attempt);
      return postWithRetry(payload, retriesLeft - 1);
    }
    return false;
  }
}

/**
 * Exponential backoff: 1s, 2s, 4s …
 */
function backoff(attempt) {
  const ms = Math.min(1000 * Math.pow(2, attempt - 1), 16000);
  return new Promise((res) => setTimeout(res, ms));
}

/**
 * Add a payload to the localStorage offline queue.
 */
function enqueueOffline(payload) {
  try {
    const queue = readOfflineQueue();
    queue.push({ payload, queuedAt: Date.now() });
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
  } catch (e) {
    console.error('workoutSync: failed to enqueue offline payload:', e);
  }
}

/**
 * Attempt to drain the offline queue, posting each payload in order.
 * Successfully synced entries are removed; failures are left for next drain.
 */
async function drainOfflineQueue() {
  const queue = readOfflineQueue();
  if (queue.length === 0) return;

  const remaining = [];
  for (const entry of queue) {
    const success = await postWithRetry(entry.payload, 1); // single attempt per drain pass
    if (!success) remaining.push(entry);
  }

  try {
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(remaining));
  } catch (e) {
    console.error('workoutSync: failed to write back offline queue:', e);
  }
}

function readOfflineQueue() {
  try {
    const raw = localStorage.getItem(OFFLINE_QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (_) {
    return [];
  }
}
