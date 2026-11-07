// The record of what's on each service (catalogue.json on the repo's `data` branch, kept by the
// GitHub job, scripts/fetch-catalogue.js): when each title was first seen on each service. Used to
// tell genuinely new arrivals from titles JustWatch has merely re-dated.

const { cached } = require('./cache');

const URL_ = process.env.CATALOGUE_URL || 'https://raw.githubusercontent.com/harihara-rajan/Catlogs/data/catalogue.json';
const MIN = 60 * 1000;

let lastError = null;
let lastFile = null;

function file() {
  return cached('catalogue-file', 30 * MIN, async () => {
    try {
      const res = await fetch(`${URL_}?t=${Math.floor(Date.now() / (30 * MIN))}`, { signal: AbortSignal.timeout(30000) });
      if (res.status === 404) return { sets: {} }; // not made yet (no TMDB key on GitHub)
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const f = await res.json();
      if (!f || !f.sets) throw new Error('unexpected file contents');
      lastFile = { scannedAt: f.scannedAt, sets: Object.keys(f.sets).length };
      lastError = null;
      return f;
    } catch (e) {
      lastError = { at: new Date().toISOString(), message: e.message };
      return { sets: {} }; // carry on without it (falls back to the release-date rule)
    }
  });
}

const dayBefore = (d) => new Date(Date.parse(d) - 24 * 3600 * 1000).toISOString().slice(0, 10);

// Did `tmdbId` arrive on `service` around `added` (YYYY-MM-DD)?
//   true  = the record covers that day and the title wasn't there before it
//   false = it was already on the service before (JustWatch re-dated it)
//   null  = the record doesn't go back that far, or doesn't list the title there: can't tell
async function arrivedAround(region, lang, type, service, tmdbId, added) {
  const set = (await file()).sets[`${region}:${lang}:${type}:${service}`];
  if (!set || set.since >= added) return null;
  const t = set.titles[String(tmdbId)];
  // Not in TMDB's list for that service: either TMDB hasn't caught up yet or doesn't list it
  // there at all; can't tell which, so leave it to the release-date rule.
  if (!t) return null;
  return t[0] > set.since && t[0] >= dayBefore(added);
}

// Titles first seen on `service` on or after `since` (and after the record began): Map(tmdbId -> first day).
async function firstSeenSince(region, lang, type, service, since) {
  const set = (await file()).sets[`${region}:${lang}:${type}:${service}`];
  const out = new Map();
  if (!set) return out;
  for (const [id, [first]] of Object.entries(set.titles)) {
    if (first >= since && first > set.since) out.set(id, first);
  }
  return out;
}

const status = () => ({ source: URL_, file: lastFile, lastError });

module.exports = { arrivedAround, firstSeenSince, status, file };
