// Small TMDB client. Answers from memory whenever it can (see cache.js) and limits how many
// requests go to TMDB at once, so loading all rows together doesn't hit rate limits.
// Availability data ("where to watch") on TMDB comes from JustWatch.

const { cached, limiter } = require('./cache');

const BASE = process.env.TMDB_BASE || 'https://api.themoviedb.org/3';
const IMG = 'https://image.tmdb.org/t/p';

const HOUR = 3600 * 1000;
const DAY = 24 * HOUR;
const limited = limiter(16);

// TMDB allows roughly 40-50 requests a second; space request starts at least 25 ms apart.
let nextSlot = 0;
async function paced() {
  const now = Date.now();
  const wait = Math.max(0, nextSlot - now);
  nextSlot = Math.max(now, nextSlot) + 25;
  if (wait) await new Promise((r) => setTimeout(r, wait));
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

      await paced();
      let res = await fetch(reqUrl, { headers, signal: AbortSignal.timeout(15000) });
      if (res.status === 429) {
        // Over the rate limit: wait as told (or 2 s) and try once more.
        const secs = Number(res.headers.get('retry-after')) || 2;
        await new Promise((r) => setTimeout(r, secs * 1000));
        res = await fetch(reqUrl, { headers, signal: AbortSignal.timeout(15000) });
      }
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

// Lists refresh every 2 hours (in the background).
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

// Title search (cached for 6 hours).
function search(stremioType, query, apiKey) {
  return get(`/search/${tmdbType(stremioType)}`, { query, include_adult: 'false', language: 'en-US' }, apiKey, 6 * HOUR);
}

// Details with IMDb ID and where-to-watch in one request (cached for 12 hours).
function detailsFull(stremioType, tmdbId, apiKey) {
  return get(`/${tmdbType(stremioType)}/${tmdbId}`, { language: 'en-US', append_to_response: 'external_ids,watch/providers' }, apiKey, 12 * HOUR);
}

const poster = (p) => (p ? `${IMG}/w500${p}` : undefined);
const backdrop = (p) => (p ? `${IMG}/w1280${p}` : undefined);

module.exports = { providers, discover, imdbId, details, search, detailsFull, poster, backdrop, tmdbType };
