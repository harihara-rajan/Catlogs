// Finds films with a dubbed audio track (e.g. Tamil) on the services of each "dubbed" tick box
// (DUB_EDITIONS in services.js) by going through those services' movie catalogues on JustWatch,
// which lists the audio languages of each streaming offer. Runs once a day from the GitHub job;
// the addon reads the result (dubs.json on the `data` branch) and keeps the films originally in
// the wanted languages.
//
//   node scripts/fetch-dubs.js previous-dubs.json dubs.json
//
// Writes the output in every case: a fresh scan when one is due, otherwise (or for a service that
// couldn't be scanned) the previous data.

const fs = require('fs');
const { SERVICES, DUB_EDITIONS } = require('../services');

const JW = process.env.JUSTWATCH_URL || 'https://apis.justwatch.com/graphql';
const GAP = Number(process.env.JW_GAP) || 3000; // ms between requests: JustWatch rate-limits bursts
const EVERY = 20 * 3600 * 1000; // re-scan a service at most this often
const SCAN_VERSION = 2; // bump to force a re-scan of every service (2 = year slices)
const SUBSCRIPTION = new Set(['FLATRATE', 'FREE', 'ADS']); // not RENT / BUY
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const QUERY = `query($c: Country!, $l: Language!, $p: [String!], $min: Int, $max: Int, $after: String) {
  popularTitles(country: $c, filter: { packages: $p, objectTypes: [MOVIE], releaseYear: { min: $min, max: $max } }, first: 100, after: $after) {
    totalCount
    pageInfo { endCursor hasNextPage }
    edges { node {
      content(country: $c, language: $l) { externalIds { imdbId tmdbId } }
      offers(country: $c, platform: WEB, filter: { packages: $p }) { monetizationType audioLanguages }
    } }
  } }`;

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
    return j.data.popularTitles;
  }
}

// JustWatch only pages through the first ~1,900 titles of a list, so big catalogues are scanned
// in release-year slices, halving any slice that's still too big.
const CAP = 1850;

// Movies on one service released in [min, max] with an `audio` track -> [[tmdbId, imdbId], ...]
async function scanYears(country, pkg, audio, min, max) {
  const out = [];
  let after = null;
  for (let page = 0; page < 20; page++) {
    const r = await post({ c: country, l: 'en', p: [pkg], min, max, after });
    if (page === 0 && r.totalCount > CAP && max > min) {
      const mid = Math.floor((min + max) / 2);
      await sleep(GAP);
      const a = await scanYears(country, pkg, audio, min, mid);
      await sleep(GAP);
      const b = await scanYears(country, pkg, audio, mid + 1, max);
      return a.concat(b);
    }
    for (const { node } of r.edges) {
      const ids = node.content && node.content.externalIds;
      if (!ids || !ids.tmdbId) continue;
      const dubbed = (node.offers || []).some((o) => SUBSCRIPTION.has(o.monetizationType) && (o.audioLanguages || []).includes(audio));
      if (dubbed) out.push([String(ids.tmdbId), ids.imdbId || null]);
    }
    if (!r.pageInfo || !r.pageInfo.hasNextPage) break;
    after = r.pageInfo.endCursor;
    await sleep(GAP);
  }
  return out;
}

async function scan(country, pkg, audio) {
  const thisYear = new Date().getFullYear();
  const found = await scanYears(country, pkg, audio, 1900, thisYear + 1);
  const seen = new Set();
  const out = found.filter(([t]) => !seen.has(t) && seen.add(t));
  console.log(`${country}:${pkg} ${audio}: ${out.length} movies with this audio`);
  return out;
}

(async () => {
  const [prevPath, outPath] = process.argv.slice(2);
  let prev = {};
  try { prev = JSON.parse(fs.readFileSync(prevPath, 'utf8')); } catch {}
  const prevLists = (prev && prev.lists) || {};

  // One list per (country, audio language, JustWatch package).
  const wanted = new Map();
  for (const e of DUB_EDITIONS) for (const key of e.services) {
    for (const pkg of SERVICES[key][e.region].jw) wanted.set(`${e.region}:${e.audio}:${pkg}`, { country: e.region, audio: e.audio, pkg });
  }

  const result = { generatedAt: new Date().toISOString(), lists: {} };
  let stop = false;
  for (const [key, { country, audio, pkg }] of wanted) {
    const old = prevLists[key];
    const fresh = old && old.complete && old.v === SCAN_VERSION && Date.now() - Date.parse(old.at) < EVERY;
    if (fresh || stop) {
      if (old) result.lists[key] = old;
      continue;
    }
    try {
      result.lists[key] = { complete: true, v: SCAN_VERSION, at: new Date().toISOString(), titles: await scan(country, pkg, audio) };
    } catch (e) {
      console.error(`${key}: ${e.message}`);
      if (old) result.lists[key] = old; // keep what we had
      if (e instanceof RateLimited) stop = true; // try again next run
    }
    await sleep(GAP);
  }
  if (!Object.keys(result.lists).length) {
    console.error('No dub data yet.');
    return;
  }
  fs.writeFileSync(outPath, JSON.stringify(result));
})();
