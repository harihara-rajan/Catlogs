// Films with a dubbed audio track per service, as found by the GitHub job (scripts/fetch-dubs.js)
// and published as dubs.json on the repo's `data` branch.

const { cached } = require('./cache');

const URL_ = process.env.DUBS_URL || 'https://raw.githubusercontent.com/harihara-rajan/Catlogs/data/dubs.json';
const HOUR = 3600 * 1000;

let lastError = null;
let lastFile = null;

function file() {
  return cached('dubs-file', HOUR, async () => {
    try {
      const res = await fetch(`${URL_}?t=${Math.floor(Date.now() / HOUR)}`, { signal: AbortSignal.timeout(30000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const f = await res.json();
      if (!f || !f.lists || !f.generatedAt) throw new Error('unexpected file contents');
      lastFile = {
        generatedAt: f.generatedAt,
        lists: Object.fromEntries(Object.entries(f.lists).map(([k, v]) => [k, `${v.titles.length} films, scanned ${v.at}`])),
      };
      lastError = null;
      return f;
    } catch (e) {
      lastError = { at: new Date().toISOString(), message: e.message };
      throw new Error(`dubs file: ${e.message}`);
    }
  });
}

// Films with an `audio` track on any of the given services in `country`.
// services: [{ key, jw: [package short names] }] -> Map(tmdbId -> { imdbId, services: Set(key) })
async function films(country, audio, services) {
  const f = await file();
  const out = new Map();
  for (const { key, jw } of services) {
    for (const pkg of jw) {
      const list = f.lists[`${country}:${audio}:${pkg}`];
      if (!list) continue;
      for (const [tmdbId, imdbId] of list.titles) {
        if (!out.has(tmdbId)) out.set(tmdbId, { imdbId, services: new Set() });
        const e = out.get(tmdbId);
        e.services.add(key);
        if (!e.imdbId && imdbId) e.imdbId = imdbId;
      }
    }
  }
  return out;
}

const status = () => ({ source: URL_, file: lastFile, lastError });

module.exports = { films, status };
