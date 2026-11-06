// Recent arrivals straight from JustWatch, the source TMDB copies its "where to watch" data from.
// TMDB usually lags JustWatch by about a day, so checking JustWatch's "new on <service>" lists for
// the last few days lets new titles show up sooner. This uses JustWatch's public (unofficial) web
// API; if it fails or changes, the addon simply carries on with TMDB alone.

const { cached, limiter } = require('./cache');

const URL_ = process.env.JUSTWATCH_URL || 'https://apis.justwatch.com/graphql';
const HOUR = 3600 * 1000;
const DAY = 24 * HOUR;
const DAYS_BACK = 7;
const limited = limiter(2);

// Problems talking to JustWatch: the last error is kept for /debug, and after a failure JustWatch
// is left alone for a few minutes rather than hammered.
let lastError = null;
let pausedUntil = 0;
let okCount = 0;

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
  if (Date.now() < pausedUntil) throw new Error('JustWatch paused after an error');
  for (let attempt = 1; ; attempt++) {
    let res;
    try {
      res = await fetch(URL_, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          accept: 'application/json',
          'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36',
        },
        body: JSON.stringify({ query: QUERY, variables }),
        signal: AbortSignal.timeout(20000),
      });
    } catch (e) {
      if (attempt < 2) { await new Promise((r) => setTimeout(r, 3000)); continue; }
      return fail(`network: ${e.message}`);
    }
    const text = await res.text();
    if ((res.status === 429 || res.status >= 500) && attempt < 2) {
      await new Promise((r) => setTimeout(r, 5000));
      continue;
    }
    if (!res.ok) return fail(`HTTP ${res.status}: ${text.slice(0, 200)}`);
    let j;
    try { j = JSON.parse(text); } catch { return fail(`not JSON: ${text.slice(0, 200)}`); }
    if (j.errors) return fail('GraphQL: ' + j.errors.map((e) => e.message).join('; ').slice(0, 300));
    okCount++;
    return j.data.newTitles;
  }
}

function fail(message) {
  lastError = { at: new Date().toISOString(), message };
  pausedUntil = Date.now() + 5 * 60 * 1000;
  console.error('JustWatch:', message);
  throw new Error(`JustWatch ${message}`);
}

// Everything added to a service (one or more JustWatch packages) in one country on one day
// -> [{ type: 'movie'|'series', tmdbId, imdbId }]
function addedOn(country, packages, date) {
  const yesterday = new Date(Date.now() - DAY).toISOString().slice(0, 10);
  const ttl = date >= yesterday ? HOUR : 7 * DAY; // older days don't change
  return cached(`jw:${country}:${packages.join(',')}:${date}`, ttl, () =>
    limited(async () => {
      const out = [];
      let after = null;
      for (let page = 0; page < 10; page++) {
        const r = await post({ c: country, l: 'en', d: date, p: packages, after });
        for (const { node } of r.edges) {
          const ids = node.objectType === 'SHOW_SEASON' ? node.show && node.show.content.externalIds : node.content.externalIds;
          if (!ids || !ids.tmdbId) continue;
          const type = node.objectType === 'MOVIE' ? 'movie' : 'series';
          out.push({ type, tmdbId: String(ids.tmdbId).split(':')[0], imdbId: ids.imdbId || null });
        }
        if (!r.pageInfo || !r.pageInfo.hasNextPage) break;
        after = r.pageInfo.endCursor;
      }
      return out;
    })
  );
}

// Titles added to a service in the last DAYS_BACK days, of the given type, de-duplicated.
// Throws if any day couldn't be fetched, so an incomplete list is never mistaken for "nothing new".
async function recent(country, packages, type) {
  if (!packages || !packages.length) return [];
  const dates = [];
  for (let i = 0; i <= DAYS_BACK; i++) dates.push(new Date(Date.now() - i * DAY).toISOString().slice(0, 10));
  const days = await Promise.allSettled(dates.map((d) => addedOn(country, packages, d)));
  const failedDays = days.filter((d) => d.status === 'rejected');
  if (failedDays.length) throw new Error(`${failedDays.length} of ${dates.length} days failed (${failedDays[0].reason.message})`);
  const seen = new Set();
  return days.flatMap((d) => d.value).filter((x) => x.type === type && !seen.has(x.tmdbId) && seen.add(x.tmdbId));
}

const status = () => ({ okRequests: okCount, lastError, paused: Date.now() < pausedUntil });

module.exports = { recent, status };
