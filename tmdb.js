// Small TMDB client.
// - Answers from memory whenever it can: once a list has been fetched, later requests get the saved
//   copy instantly, and an outdated copy is refreshed in the background instead of making you wait.
// - Limits how many requests go to TMDB at once, so loading all rows together doesn't hit rate limits.
// Availability data ("where to watch") on TMDB comes from JustWatch.

const BASE = process.env.TMDB_BASE || 'https://api.themoviedb.org/3';
const IMG = 'https://image.tmdb.org/t/p';

const HOUR = 3600 * 1000;
const DAY = 24 * HOUR;

// ---- request limiter
const MAX_PARALLEL = 16;
let active = 0;
const waiting = [];
async function limited(fn) {
  if (active >= MAX_PARALLEL) await new Promise((r) => waiting.push(r));
  active++;
  try {
    return await fn();
  } finally {
    active--;
    if (waiting.length) waiting.shift()();
  }
}

// ---- cache: key -> { value, fresh (ms timestamp), pending (promise|null) }
const cache = new Map();
const MAX_ENTRIES = 30000;

function cached(key, ttl, fn) {
  const now = Date.now();
  let e = cache.get(key);

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
    cache.set(key, e);
    if (cache.size > MAX_ENTRIES) cache.delete(cache.keys().next().value);
    return refresh().catch((err) => {
      if (!e.has) cache.delete(key);
      throw err;
    });
  }
  if (!e.has) return refresh(); // first fetch still running
  if (e.fresh <= now) refresh().catch((err) => console.error('background refresh failed:', err.message));
  return Promise.resolve(e.value); // instant, possibly slightly old
}

// v4 "API Read Access Token" is a JWT (starts with eyJ); v3 key is a 32-char hex string.
const isBearer = (key) => typeof key === 'string' && key.startsWith('eyJ');

async function get(path, params, apiKey, ttl) {
  if (!apiKey) throw new Error('No TMDB API key configured');
  const url = new URL(BASE + path);
  const sorted = Object.entries(params || {})
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .sort(([a], [b]) => a.localeCompare(b));
  for (const [k, v] of sorted) url.searchParams.set(k, String(v));
  const cacheKey = url.toString();

  return cached(cacheKey, ttl, () =>
    limited(async () => {
      const headers = { accept: 'application/json' };
      const reqUrl = new URL(cacheKey);
      if (isBearer(apiKey)) headers.Authorization = `Bearer ${apiKey}`;
      else reqUrl.searchParams.set('api_key', apiKey);

      const res = await fetch(reqUrl, { headers, signal: AbortSignal.timeout(15000) });
      if (res.status === 401) throw new Error('TMDB rejected the API key (401)');
      if (res.status === 429) throw new Error('TMDB rate limit hit (429)');
      if (!res.ok) throw new Error(`TMDB ${res.status} for ${path}`);
      return res.json();
    })
  );
}

const tmdbType = (stremioType) => (stremioType === 'series' ? 'tv' : 'movie');

// Provider list for India, used to turn service names into TMDB provider IDs.
function providers(stremioType, apiKey) {
  return get(`/watch/providers/${tmdbType(stremioType)}`, { watch_region: 'IN' }, apiKey, DAY)
    .then((d) => d.results || []);
}

// Lists refresh every 2 hours (in the background, see above).
function discover(stremioType, params, apiKey) {
  return get(`/discover/${tmdbType(stremioType)}`, params, apiKey, 2 * HOUR);
}

// IMDb IDs never change, so keep them for a long time.
function imdbId(stremioType, tmdbId, apiKey) {
  return get(`/${tmdbType(stremioType)}/${tmdbId}/external_ids`, {}, apiKey, 30 * DAY)
    .then((d) => (d && d.imdb_id ? d.imdb_id : null))
    .catch(() => null);
}

function details(stremioType, tmdbId, apiKey) {
  return get(`/${tmdbType(stremioType)}/${tmdbId}`, { language: 'en-US' }, apiKey, DAY);
}

// Title search, for pinned titles given by name.
function search(stremioType, query, year, apiKey) {
  const params = { query, language: 'en-US', include_adult: false };
  if (year) params[stremioType === 'series' ? 'first_air_date_year' : 'year'] = year;
  return get(`/search/${tmdbType(stremioType)}`, params, apiKey, 6 * HOUR).then((d) => d.results || []);
}

// Look a title up by IMDb ID, for pinned titles given as tt1234567.
function findByImdb(stremioType, imdb, apiKey) {
  return get(`/find/${imdb}`, { external_source: 'imdb_id', language: 'en-US' }, apiKey, DAY).then((d) =>
    (stremioType === 'series' ? d.tv_results : d.movie_results) || []
  );
}

const poster = (p) => (p ? `${IMG}/w500${p}` : undefined);
const backdrop = (p) => (p ? `${IMG}/w1280${p}` : undefined);

module.exports = { providers, discover, imdbId, details, search, findByImdb, poster, backdrop, tmdbType };
