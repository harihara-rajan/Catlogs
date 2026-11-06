// Shared helpers: an in-memory cache that answers instantly from a saved copy and refreshes
// out-of-date entries in the background, and a limiter for parallel outgoing requests.

function limiter(max) {
  let active = 0;
  const waiting = [];
  return async function limited(fn) {
    if (active >= max) await new Promise((r) => waiting.push(r));
    active++;
    try {
      return await fn();
    } finally {
      active--;
      if (waiting.length) waiting.shift()();
    }
  };
}

// key -> { value, has, fresh (ms timestamp), pending }
const store = new Map();
const MAX_ENTRIES = 40000;

function cached(key, ttl, fn) {
  const now = Date.now();
  let e = store.get(key);

  const refresh = () => {
    if (e.pending) return e.pending;
    e.pending = fn()
      .then((value) => {
        e.value = value;
        e.has = true;
        e.fresh = Date.now() + ttl;
        return value;
      })
      .finally(() => {
        e.pending = null;
      });
    return e.pending;
  };

  if (!e) {
    e = { value: undefined, has: false, fresh: 0, pending: null };
    store.set(key, e);
    if (store.size > MAX_ENTRIES) store.delete(store.keys().next().value);
    return refresh().catch((err) => {
      if (!e.has) store.delete(key);
      throw err;
    });
  }
  if (!e.has) return refresh(); // first fetch still running
  if (e.fresh <= now) refresh().catch((err) => console.error(`background refresh failed (${key.slice(0, 80)}):`, err.message));
  return Promise.resolve(e.value); // instant, possibly slightly old
}

// Resolve with fallback if a promise takes longer than ms (the promise keeps running and fills the cache).
function within(ms, promise, fallback) {
  let t;
  return Promise.race([
    promise.catch(() => fallback),
    new Promise((r) => (t = setTimeout(() => r(fallback), ms))),
  ]).finally(() => clearTimeout(t));
}

module.exports = { cached, limiter, within };
