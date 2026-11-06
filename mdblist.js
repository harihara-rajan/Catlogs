// Rotten Tomatoes (critics) scores via MDBList (https://mdblist.com), using your free API key
// (MDBLIST_API_KEY). The free plan allows 1,000 requests a day, and one request covers 10 titles,
// so titles are queued and looked up in the background in batches of 10; rows show the score as
// soon as it's known. Scores are kept for a week (titles with no score: 2 days).

const KEY = process.env.MDBLIST_API_KEY || '';
const BASE = process.env.MDBLIST_URL || 'https://api.mdblist.com';
const DAY = 24 * 3600 * 1000;
const DAILY_LIMIT = Number(process.env.MDBLIST_DAILY_LIMIT) || 900; // stay under the 1,000/day plan
const BATCH = 10;
const INTERVAL = 1500; // ms between requests

const scores = new Map(); // "movie:tt123" -> { v: number|null, until: ms }
const queue = { movie: new Set(), show: new Set() };
let used = { day: '', count: 0 };
let pausedUntil = 0;
let lastRaw = null; // last response, for /debug

const kindOf = (stremioType) => (stremioType === 'series' ? 'show' : 'movie');

// Score for a title if known (number 0-100, or null = no RT score); undefined = not known yet.
// Unknown or out-of-date titles are queued for lookup.
function rt(stremioType, tt) {
  if (!KEY || !/^tt\d+$/.test(tt || '')) return undefined;
  const kind = kindOf(stremioType);
  const e = scores.get(`${kind}:${tt}`);
  if (!e || e.until < Date.now()) queue[kind].add(tt);
  return e ? e.v : undefined;
}

// Pull "id -> score" pairs out of the response, whatever exact shape it has.
function parse(data, askedIds) {
  const out = new Map();
  const list = Array.isArray(data) ? data : data && (data.ratings || data.items || data.results || data.data);
  if (!Array.isArray(list)) return out;
  list.forEach((o, i) => {
    if (o == null) return;
    const id = (typeof o === 'object' && (o.id || o.imdb || o.imdb_id || o.imdbid || (o.ids && o.ids.imdb))) || (list.length === askedIds.length ? askedIds[i] : null);
    const raw = typeof o === 'object' ? (o.rating ?? o.value ?? o.score) : o;
    const v = raw === null || raw === undefined || raw === '' ? null : Number(raw);
    if (id) out.set(String(id), Number.isFinite(v) ? Math.round(v) : null);
  });
  return out;
}

async function tick() {
  const now = Date.now();
  if (!KEY || now < pausedUntil) return;
  const today = new Date().toISOString().slice(0, 10);
  if (used.day !== today) used = { day: today, count: 0 };
  if (used.count >= DAILY_LIMIT) return;

  const kind = queue.movie.size ? 'movie' : queue.show.size ? 'show' : null;
  if (!kind) return;
  const batch = [...queue[kind]].slice(0, BATCH);
  batch.forEach((id) => queue[kind].delete(id));

  used.count++;
  try {
    const res = await fetch(`${BASE}/rating/${kind}/tomatoes?apikey=${encodeURIComponent(KEY)}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ ids: batch, provider: 'imdb' }),
      signal: AbortSignal.timeout(20000),
    });
    const text = await res.text();
    lastRaw = { at: new Date().toISOString(), status: res.status, kind, ids: batch, body: text.slice(0, 1500) };
    if (res.status === 429) {
      pausedUntil = Date.now() + 15 * 60 * 1000;
      batch.forEach((id) => queue[kind].add(id));
      console.error('MDBList: rate limited, pausing 15 minutes');
      return;
    }
    if (res.status === 401 || res.status === 403) {
      pausedUntil = Date.now() + 6 * 3600 * 1000;
      console.error(`MDBList: key rejected (${res.status}), pausing 6 hours`);
      return;
    }
    if (!res.ok) throw new Error(`MDBList ${res.status}`);
    const found = parse(JSON.parse(text), batch);
    for (const id of batch) {
      const v = found.has(id) ? found.get(id) : null;
      scores.set(`${kind}:${id}`, { v, until: Date.now() + (v === null ? 2 * DAY : 7 * DAY) });
    }
  } catch (e) {
    batch.forEach((id) => queue[kind].add(id));
    pausedUntil = Date.now() + 60 * 1000;
    console.error('MDBList lookup failed:', e.message);
  }
}

function start() {
  if (!KEY) {
    console.log('MDBList: no MDBLIST_API_KEY set, Rotten Tomatoes scores are off');
    return;
  }
  setInterval(() => tick().catch((e) => console.error('MDBList:', e.message)), INTERVAL);
}

const status = () => ({
  enabled: !!KEY,
  known: scores.size,
  queued: queue.movie.size + queue.show.size,
  requestsToday: used.count,
  dailyLimit: DAILY_LIMIT,
  paused: pausedUntil > Date.now(),
  lastResponse: lastRaw,
});

module.exports = { start, rt, status, parse };
