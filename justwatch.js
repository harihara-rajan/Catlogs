// Recent arrivals ("new on <service>" in the last week), as collected from JustWatch by the GitHub
// job in .github/workflows/arrivals.yml and published as arrivals.json on the repo's `data` branch.
// (JustWatch rate-limits Render's shared addresses, so the server doesn't ask JustWatch itself.)
// TMDB copies JustWatch about a day later; until then these titles are merged into the rows.

const { cached } = require('./cache');

const URL_ = process.env.ARRIVALS_URL || 'https://raw.githubusercontent.com/harihara-rajan/Catlogs/data/arrivals.json';
const MIN = 60 * 1000;

let lastError = null;
let lastFile = null;

function file() {
  return cached('arrivals-file', 10 * MIN, async () => {
    try {
      const res = await fetch(`${URL_}?t=${Math.floor(Date.now() / (10 * MIN))}`, { signal: AbortSignal.timeout(20000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const f = await res.json();
      if (!f || !f.sets || !f.generatedAt) throw new Error('unexpected file contents');
      lastFile = { generatedAt: f.generatedAt, sets: Object.keys(f.sets).length };
      lastError = null;
      return f;
    } catch (e) {
      lastError = { at: new Date().toISOString(), message: e.message };
      throw new Error(`arrivals file: ${e.message}`);
    }
  });
}

// Titles added to a service in the last week, of the given type, de-duplicated.
// -> [{ type, tmdbId, imdbId }]. Throws if the file can't be read.
async function recent(country, packages, type) {
  if (!packages || !packages.length) return [];
  const f = await file();
  const days = f.sets[`${country}:${packages.join(',')}`];
  if (!days) return []; // not collected (e.g. English rows, which default to Popular)
  const seen = new Set();
  const out = [];
  for (const d of Object.keys(days).sort().reverse()) {
    for (const [t, tmdbId, imdbId] of days[d]) {
      if (t === type && !seen.has(tmdbId)) {
        seen.add(tmdbId);
        out.push({ type: t, tmdbId, imdbId });
      }
    }
  }
  return out;
}

// Everything of `type` that arrived on any of `services` in the file's days (the last ~8):
// Map(tmdbId -> { imdbId, added: 'YYYY-MM-DD' (most recent), services: Set(key), bulk }).
// bulk = it arrived on a day when the service added an unusually large number of titles, which is
// usually JustWatch re-listing an existing catalogue rather than genuinely new arrivals.
const BULK_DAY = 40;
async function arrivalsByTitle(country, services, type) {
  const f = await file();
  const out = new Map();
  for (const { key, jw } of services) {
    const days = f.sets[`${country}:${jw.join(',')}`];
    if (!days) continue;
    for (const [date, list] of Object.entries(days)) {
      const bulk = list.length > BULK_DAY;
      for (const [t, tmdbId, imdbId] of list) {
        if (t !== type) continue;
        const e = out.get(tmdbId);
        if (!e) {
          out.set(tmdbId, { imdbId, added: date, services: new Set([key]), bulk });
          continue;
        }
        e.services.add(key);
        if (!e.imdbId && imdbId) e.imdbId = imdbId;
        if (date > e.added) { e.added = date; e.bulk = bulk; }
      }
    }
  }
  return out;
}

const status = () => ({ source: URL_, file: lastFile, lastError });

module.exports = { recent, arrivalsByTitle, status, file };
