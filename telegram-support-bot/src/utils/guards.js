const hits = new Map();

const WINDOW_MS = 10_000;
const MAX_EVENTS = 20;
const BLOCK_MS = 10_000;

export function allowMessage(userId, now = Date.now()) {
  const key = String(userId);
  const recent = (hits.get(key) || []).filter((time) => now - time < WINDOW_MS);
  if (recent.length >= MAX_EVENTS) {
    hits.set(key, recent);
    return false;
  }
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5000) {
    for (const [id, times] of hits) {
      if (!times.length || now - times[times.length - 1] > BLOCK_MS) {
        hits.delete(id);
      }
    }
  }
  return true;
}

const callbacks = new Map();

export function isDuplicateCallback(userId, data, now = Date.now()) {
  const key = `${userId}:${data}`;
  const previous = callbacks.get(key) || 0;
  callbacks.set(key, now);
  if (callbacks.size > 2000) {
    for (const [id, time] of callbacks) {
      if (now - time > 5000) {
        callbacks.delete(id);
      }
    }
  }
  return now - previous < 1000;
}

export function resetGuards() {
  hits.clear();
  callbacks.clear();
}
