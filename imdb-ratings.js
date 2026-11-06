// IMDb ratings from IMDb's own free daily dataset (title.ratings.tsv.gz, ~1.6 million titles,
// for personal and non-commercial use). Downloaded at start-up and once a day, and kept compactly
// in memory (about 8 MB) as sorted ID / rating arrays.

const zlib = require('zlib');
const readline = require('readline');
const { Readable } = require('stream');

const URL_ = process.env.IMDB_RATINGS_URL || 'https://datasets.imdbws.com/title.ratings.tsv.gz';
const DAY = 24 * 3600 * 1000;

let ids = new Uint32Array(0); // numeric part of tt1234567, ascending
let tenths = new Uint8Array(0); // rating × 10 (7.8 -> 78)
let loadedAt = 0;

async function load() {
  const started = Date.now();
  const res = await fetch(URL_, { signal: AbortSignal.timeout(5 * 60 * 1000) });
  if (!res.ok) throw new Error(`IMDb dataset ${res.status}`);
  const lines = readline.createInterface({
    input: Readable.fromWeb(res.body).pipe(zlib.createGunzip()),
    crlfDelay: Infinity,
  });

  let cap = 2_000_000;
  let I = new Uint32Array(cap);
  let V = new Uint8Array(cap);
  let n = 0;
  let sorted = true;
  let header = true;
  for await (const line of lines) {
    if (header) { header = false; continue; } // tconst  averageRating  numVotes
    const t1 = line.indexOf('\t');
    const t2 = line.indexOf('\t', t1 + 1);
    if (t1 < 3 || t2 < 0) continue;
    const id = Number(line.slice(2, t1));
    const r = Math.round(Number(line.slice(t1 + 1, t2)) * 10);
    if (!Number.isFinite(id) || !Number.isFinite(r)) continue;
    if (n === cap) {
      cap *= 2;
      const I2 = new Uint32Array(cap); I2.set(I); I = I2;
      const V2 = new Uint8Array(cap); V2.set(V); V = V2;
    }
    if (n && id < I[n - 1]) sorted = false;
    I[n] = id;
    V[n] = r;
    n++;
  }
  if (n < 100000) throw new Error(`IMDb dataset looks incomplete (${n} rows)`);

  if (!sorted) {
    const order = Array.from({ length: n }, (_, i) => i).sort((a, b) => I[a] - I[b]);
    const I2 = new Uint32Array(n);
    const V2 = new Uint8Array(n);
    order.forEach((j, i) => { I2[i] = I[j]; V2[i] = V[j]; });
    I = I2; V = V2;
  } else {
    I = I.slice(0, n); V = V.slice(0, n);
  }
  ids = I;
  tenths = V;
  loadedAt = Date.now();
  console.log(`IMDb ratings: ${n} titles loaded in ${((Date.now() - started) / 1000).toFixed(1)}s`);
}

// tt1234567 -> 7.8, or null if IMDb has no rating for it.
function get(tt) {
  const m = /^tt(\d+)$/.exec(tt || '');
  if (!m || !ids.length) return null;
  const target = Number(m[1]);
  let lo = 0;
  let hi = ids.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (ids[mid] === target) return tenths[mid] / 10;
    if (ids[mid] < target) lo = mid + 1;
    else hi = mid - 1;
  }
  return null;
}

function start() {
  const run = () => load().catch((e) => console.error('IMDb ratings download failed:', e.message));
  run();
  setInterval(run, DAY);
}

const status = () => ({ titles: ids.length, loadedAt: loadedAt ? new Date(loadedAt).toISOString() : null });

module.exports = { start, get, status };
