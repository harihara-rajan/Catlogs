// Small TMDB client with an in-memory cache.
// Availability data ("where to watch") on TMDB comes from JustWatch.

const BASE = process.env.TMDB_BASE || 'https://api.themoviedb.org/3';
const IMG = 'https://image.tmdb.org/t/p';

const HOUR = 3600 * 1000;
const DAY = 24 * HOUR;

// ---- cache (stores promises so concurrent identical requests share one fetch)
const cache = new Map();
const MAX_ENTRIES = 20000;

function cached(key, ttl, fn) {
  const hit = cache.get(key);
  if (hit && hit.exp > Date.now()) return hit.val;
  const val = fn().catch((err) => {
    cache.delete(key);
    throw err;
  });
  cache.set(key, { val, exp: Date.now() + ttl });
  if (cache.size > MAX_ENTRIES) cache.delete(cache.keys().next().value);
  return val;
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

  return cached(cacheKey, ttl, async () => {
    const headers = { accept: 'application/json' };
    const reqUrl = new URL(cacheKey);
    if (isBearer(apiKey)) headers.Authorization = `Bearer ${apiKey}`;
    else reqUrl.searchParams.set('api_key', apiKey);

    const res = await fetch(reqUrl, { headers });
    if (res.status === 401) throw new Error('TMDB rejected the API key (401)');
    if (res.status === 429) throw new Error('TMDB rate limit hit (429)');
    if (!res.ok) throw new Error(`TMDB ${res.status} for ${path}`);
    return res.json();
  });
}

const tmdbType = (stremioType) => (stremioType === 'series' ? 'tv' : 'movie');

// Provider list for India, used to turn service names into TMDB provider IDs.
function providers(stremioType, apiKey) {
  return get(`/watch/providers/${tmdbType(stremioType)}`, { watch_region: 'IN' }, apiKey, DAY)
    .then((d) => d.results || []);
}

function discover(stremioType, params, apiKey) {
  return get(`/discover/${tmdbType(stremioType)}`, params, apiKey, 6 * HOUR);
}

// IMDb IDs never change, so cache them for a long time.
function imdbId(stremioType, tmdbId, apiKey) {
  return get(`/${tmdbType(stremioType)}/${tmdbId}/external_ids`, {}, apiKey, 30 * DAY)
    .then((d) => (d && d.imdb_id ? d.imdb_id : null))
    .catch(() => null);
}

function details(stremioType, tmdbId, apiKey) {
  return get(`/${tmdbType(stremioType)}/${tmdbId}`, { language: 'en-US' }, apiKey, DAY);
}

const poster = (p) => (p ? `${IMG}/w500${p}` : undefined);
const backdrop = (p) => (p ? `${IMG}/w1280${p}` : undefined);

module.exports = { providers, discover, imdbId, details, poster, backdrop, tmdbType };
