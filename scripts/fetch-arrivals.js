// Collects "new on <service>" lists from JustWatch for the last 8 days and writes them to a JSON
// file. Runs on GitHub Actions (.github/workflows/arrivals.yml) every 30 minutes, because
// JustWatch rate-limits Render's shared addresses; the addon reads the result from the repo's
// `data` branch.
//
//   node scripts/fetch-arrivals.js previous.json arrivals.json
//
// Days older than yesterday don't change, so they're copied from the previous file when present.

const fs = require('fs');
const { SERVICES, EDITIONS } = require('../services');

const JW = process.env.JUSTWATCH_URL || 'https://apis.justwatch.com/graphql';
const DAY = 24 * 3600 * 1000;
const DAYS_BACK = 7;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const QUERY = `query($c: Country!, $l: Language!, $d: Date!, $p: [String!], $after: String) {
  newTitles(country: $c, date: $d, first: 100, after: $after, filter: { packages: $p }, pageType: NEW, priceDrops: false) {
    pageInfo { endCursor hasNextPage }
    edges { node {
      objectType
      content(country: $c, language: $l) { externalIds { imdbId tmdbId } }
      ... on Season { show { content(country: $c, language: $l) { externalIds { imdbId tmdbId } } } }
    } }
  } }`;

async function post(variables) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(JW, {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json', 'user-agent': 'Mozilla/5.0' },
        body: JSON.stringify({ query: QUERY, variables }),
        signal: AbortSignal.timeout(30000),
      });
      const text = await res.text();
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 120)}`);
      const j = JSON.parse(text);
      if (j.errors) throw new Error('GraphQL: ' + j.errors.map((e) => e.message).join('; '));
      return j.data.newTitles;
    } catch (e) {
      if (attempt === 3) throw e;
      await sleep(attempt * 5000);
    }
  }
}

// One service (set of JustWatch packages) in one country on one day -> [[type, tmdbId, imdbId], ...]
async function day(country, packages, date) {
  const out = [];
  let after = null;
  for (let page = 0; page < 10; page++) {
    const r = await post({ c: country, l: 'en', d: date, p: packages, after });
    for (const { node } of r.edges) {
      const ids = node.objectType === 'SHOW_SEASON' ? node.show && node.show.content.externalIds : node.content.externalIds;
      if (!ids || !ids.tmdbId) continue;
      out.push([node.objectType === 'MOVIE' ? 'movie' : 'series', String(ids.tmdbId).split(':')[0], ids.imdbId || null]);
    }
    if (!r.pageInfo || !r.pageInfo.hasNextPage) break;
    after = r.pageInfo.endCursor;
    await sleep(300);
  }
  return out;
}

(async () => {
  const [prevPath, outPath] = process.argv.slice(2);
  let prev = {};
  try { prev = JSON.parse(fs.readFileSync(prevPath, 'utf8')); } catch {}
  const prevSets = (prev && prev.sets) || {};

  // Every (country, service) pair any tick box uses.
  const sets = new Map();
  for (const e of EDITIONS) for (const key of e.services) {
    const svc = SERVICES[key][e.region];
    sets.set(`${e.region}:${svc.jw.join(',')}`, { country: e.region, packages: svc.jw });
  }

  const dates = [];
  for (let i = 0; i <= DAYS_BACK; i++) dates.push(new Date(Date.now() - i * DAY).toISOString().slice(0, 10));
  const recentCutoff = dates[1]; // today and yesterday are always re-fetched

  const result = { generatedAt: new Date().toISOString(), dates, sets: {} };
  let fetched = 0;
  let failed = 0;
  for (const [setKey, { country, packages }] of sets) {
    result.sets[setKey] = {};
    for (const d of dates) {
      const old = prevSets[setKey] && prevSets[setKey][d];
      if (old && d < recentCutoff) { result.sets[setKey][d] = old; continue; }
      try {
        result.sets[setKey][d] = await day(country, packages, d);
        fetched++;
      } catch (e) {
        failed++;
        console.error(`${setKey} ${d}: ${e.message}`);
        if (old) result.sets[setKey][d] = old; // keep what we had
      }
      await sleep(300);
    }
    const n = Object.values(result.sets[setKey]).reduce((a, x) => a + x.length, 0);
    console.log(`${setKey.padEnd(16)} ${n} titles in ${dates.length} days`);
  }
  console.log(`fetched ${fetched} days, ${failed} failed`);
  if (!fetched) {
    console.error('Nothing could be fetched from JustWatch; leaving the published file as it is.');
    process.exit(1);
  }
  fs.writeFileSync(outPath, JSON.stringify(result));
})();
