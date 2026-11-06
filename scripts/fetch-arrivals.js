// Collects "new on <service>" lists from JustWatch for the last 8 days and writes them to a JSON
// file (only the subscription titles, not rentals). Runs on GitHub Actions (.github/workflows/arrivals.yml) every 30 minutes, because
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

// One request per day covers every service in a country; newOffer says which service (and plan)
// each title arrived on.
const QUERY = `query($c: Country!, $l: Language!, $d: Date!, $p: [String!], $after: String) {
  newTitles(country: $c, date: $d, first: 100, after: $after, filter: { packages: $p }, pageType: NEW, priceDrops: false) {
    pageInfo { endCursor hasNextPage }
    edges {
      newOffer(platform: WEB) { monetizationType package { shortName } }
      node {
        objectType
        content(country: $c, language: $l) { externalIds { imdbId tmdbId } }
        ... on Season { show { content(country: $c, language: $l) { externalIds { imdbId tmdbId } } } }
      }
    }
  } }`;
const SUBSCRIPTION = new Set(['FLATRATE', 'FREE', 'ADS']); // not RENT / BUY
const GAP = Number(process.env.JW_GAP) || 2000; // ms between requests: JustWatch rate-limits bursts

class RateLimited extends Error {}

async function post(variables) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    let res;
    try {
      res = await fetch(JW, {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json', 'user-agent': 'Mozilla/5.0' },
        body: JSON.stringify({ query: QUERY, variables }),
        signal: AbortSignal.timeout(30000),
      });
    } catch (e) {
      if (attempt === 3) throw e;
      await sleep(5000);
      continue;
    }
    const text = await res.text();
    if (res.status === 429) {
      if (attempt === 3) throw new RateLimited('JustWatch rate limit (429)');
      await sleep(60000 * attempt);
      continue;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 120)}`);
    const j = JSON.parse(text);
    if (j.errors) throw new Error('GraphQL: ' + j.errors.map((e) => e.message).join('; '));
    return j.data.newTitles;
  }
}

// Everything that arrived on any of `packages` in `country` on `date`
// -> Map(package short name -> [[type, tmdbId, imdbId], ...])
async function day(country, packages, date) {
  const out = new Map(packages.map((p) => [p, []]));
  let after = null;
  for (let page = 0; page < 30; page++) {
    const r = await post({ c: country, l: 'en', d: date, p: packages, after });
    for (const { newOffer, node } of r.edges) {
      const pkg = newOffer && newOffer.package && newOffer.package.shortName;
      if (!out.has(pkg) || !SUBSCRIPTION.has(newOffer.monetizationType)) continue;
      const ids = node.objectType === 'SHOW_SEASON' ? node.show && node.show.content.externalIds : node.content.externalIds;
      if (!ids || !ids.tmdbId) continue;
      out.get(pkg).push([node.objectType === 'MOVIE' ? 'movie' : 'series', String(ids.tmdbId).split(':')[0], ids.imdbId || null]);
    }
    if (!r.pageInfo || !r.pageInfo.hasNextPage) break;
    after = r.pageInfo.endCursor;
    await sleep(GAP);
  }
  return out;
}

(async () => {
  const [prevPath, outPath] = process.argv.slice(2);
  let prev = {};
  try { prev = JSON.parse(fs.readFileSync(prevPath, 'utf8')); } catch {}
  const prevSets = (prev && prev.sets) || {};

  // New arrivals are only used by rows whose default view is Newest (not the English rows, which
  // default to Popular), so only those services are collected. Grouped by country.
  const byCountry = new Map(); // country -> Map(setKey -> packages)
  for (const e of EDITIONS) {
    if ((e.defaultSort || 'Newest') !== 'Newest') continue;
    for (const key of e.services) {
      const svc = SERVICES[key][e.region];
      if (!byCountry.has(e.region)) byCountry.set(e.region, new Map());
      byCountry.get(e.region).set(`${e.region}:${svc.jw.join(',')}`, svc.jw);
    }
  }

  const dates = [];
  for (let i = 0; i <= DAYS_BACK; i++) dates.push(new Date(Date.now() - i * DAY).toISOString().slice(0, 10));
  const recentCutoff = dates[1]; // today and yesterday are always re-fetched

  const result = { generatedAt: new Date().toISOString(), dates, sets: {} };
  let fetched = 0;
  let failed = 0;
  let stop = false;
  for (const [country, setMap] of byCountry) {
    const packages = [...new Set([...setMap.values()].flat())];
    for (const key of setMap.keys()) result.sets[key] = {};
    for (const d of dates) {
      const keep = () => { for (const key of setMap.keys()) { const old = prevSets[key] && prevSets[key][d]; if (old) result.sets[key][d] = old; } };
      const haveOld = [...setMap.keys()].every((key) => prevSets[key] && prevSets[key][d]);
      if ((haveOld && d < recentCutoff) || stop) { keep(); continue; }
      try {
        const got = await day(country, packages, d);
        for (const [key, pkgs] of setMap) result.sets[key][d] = pkgs.flatMap((p) => got.get(p) || []);
        fetched++;
      } catch (e) {
        failed++;
        console.error(`${country} ${d}: ${e.message}`);
        keep();
        if (e instanceof RateLimited) stop = true; // leave JustWatch alone until the next run
      }
      await sleep(GAP);
    }
  }
  for (const [key, days] of Object.entries(result.sets)) {
    console.log(`${key.padEnd(10)} ${Object.values(days).reduce((a, x) => a + x.length, 0)} titles in ${Object.keys(days).length} days`);
  }
  console.log(`fetched ${fetched} days, ${failed} failed`);
  if (!fetched) {
    console.error('Nothing could be fetched from JustWatch; leaving the published file as it is.');
    process.exit(1);
  }
  fs.writeFileSync(outPath, JSON.stringify(result));
})();
