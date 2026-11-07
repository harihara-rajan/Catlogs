// Keeps a record of what's on each service, so the addon can tell a genuinely new arrival from a
// title JustWatch has merely re-dated (it sometimes gives hundreds of old titles a new "added"
// date). For every tick box with "New This Week" rows (Tamil, Malayalam, Hindi), each service and
// each type, it lists the titles TMDB says are streaming there (TMDB copies JustWatch daily) and
// remembers when each one was first seen.
//
//   TMDB_API_KEY=... node scripts/fetch-catalogue.js previous-catalogue.json catalogue.json
//
// Output: { version, scannedAt, sets: { "IN:ta:movie:prime": { since, at, titles: { tmdbId: [first, last] } } } }
//   since  = day of the first complete scan of that set (titles first seen then were already there)
//   first  = day the title was first seen on the service (reset if it comes back after a gap)
//   last   = day it was last seen
// A set is only updated by a complete scan; if TMDB fails part-way, the previous data is kept.

const fs = require('fs');
const { SERVICES, EDITIONS } = require('../services');

const KEY = process.env.TMDB_API_KEY || '';
const BASE = process.env.TMDB_BASE || 'https://api.themoviedb.org/3';
const VERSION = 1;
const EVERY = 3 * 3600 * 1000; // scan at most this often
const GONE = 7; // days: a title missing longer than this counts as new again when it comes back
const FORGET = 60; // days: drop titles not seen for this long
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const day = (t = Date.now()) => new Date(t).toISOString().slice(0, 10);
const daysBetween = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5);

async function get(path, params) {
  const url = new URL(BASE + path);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
  const headers = { accept: 'application/json' };
  if (KEY.startsWith('eyJ')) headers.Authorization = `Bearer ${KEY}`;
  else url.searchParams.set('api_key', KEY);
  for (let attempt = 1; attempt <= 4; attempt++) {
    await sleep(30);
    let res;
    try {
      res = await fetch(url, { headers, signal: AbortSignal.timeout(20000) });
    } catch (e) {
      if (attempt === 4) throw e;
      await sleep(2000 * attempt);
      continue;
    }
    if (res.status === 429) { await sleep((Number(res.headers.get('retry-after')) || 3) * 1000); continue; }
    if (!res.ok) throw new Error(`TMDB ${res.status} for ${path}`);
    return res.json();
  }
  throw new Error(`TMDB kept refusing ${path}`);
}

// Every title of `lang` and `type` streaming on `service` in `region` -> Set of TMDB ids.
async function scan(region, lang, type, service) {
  const tv = type === 'series';
  const params = {
    with_original_language: lang,
    watch_region: region,
    with_watch_providers: SERVICES[service][region].ids.join('|'),
    with_watch_monetization_types: 'flatrate|free|ads',
    sort_by: tv ? 'first_air_date.desc' : 'primary_release_date.desc',
    include_adult: 'false',
  };
  const ids = new Set();
  let page = 1;
  let pages = 1;
  do {
    const d = await get(`/discover/${tv ? 'tv' : 'movie'}`, { ...params, page });
    pages = Math.min(d.total_pages || 1, 500);
    for (const r of d.results || []) ids.add(String(r.id));
    page++;
  } while (page <= pages);
  return ids;
}

async function main() {
  const [prevPath, outPath] = process.argv.slice(2);
  let prev = {};
  try { prev = JSON.parse(fs.readFileSync(prevPath, 'utf8')); } catch { /* first run */ }
  if (prev.version !== VERSION) prev = { sets: {} };
  const write = (data) => fs.writeFileSync(outPath, JSON.stringify(data));

  if (!KEY) {
    console.log('No TMDB_API_KEY secret: keeping the previous record.');
    if (prev.scannedAt) write(prev);
    return;
  }
  if (prev.scannedAt && Date.now() - Date.parse(prev.scannedAt) < EVERY) {
    console.log(`Scanned at ${prev.scannedAt}; next scan later.`);
    write(prev);
    return;
  }

  const today = day();
  const out = { version: VERSION, scannedAt: new Date().toISOString(), sets: { ...prev.sets } };
  let ok = 0;
  let failed = 0;
  for (const e of EDITIONS.filter((x) => x.newThisWeek)) {
    for (const type of e.types) {
      for (const service of e.services) {
        const key = `${e.region}:${e.lang}:${type}:${service}`;
        let ids;
        try {
          ids = await scan(e.region, e.lang, type, service);
        } catch (err) {
          failed++;
          console.log(`${key}: ${err.message} (keeping the previous data)`);
          continue;
        }
        const old = prev.sets[key];
        const titles = {};
        let added = 0;
        if (old) {
          for (const [id, [first, last]] of Object.entries(old.titles)) {
            if (daysBetween(last, today) <= FORGET) titles[id] = [first, last];
          }
        }
        for (const id of ids) {
          const t = titles[id];
          if (!t || daysBetween(t[1], today) > GONE) {
            titles[id] = [today, today];
            if (old) added++;
          } else {
            t[1] = today;
          }
        }
        out.sets[key] = { since: old ? old.since : today, at: out.scannedAt, titles };
        ok++;
        console.log(`${key}: ${ids.size} titles${old ? `, ${added} new` : ' (first scan)'}`);
      }
    }
  }
  console.log(`${ok} sets scanned, ${failed} failed.`);
  write(out);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
