// Recent arrivals straight from JustWatch, the source TMDB copies its "where to watch" data from.
// TMDB usually lags JustWatch by about a day, so checking JustWatch's "new on <service>" lists for
// the last few days lets new titles show up sooner. This uses JustWatch's public (unofficial) web
// API; if it fails or changes, the addon simply carries on with TMDB alone.

const { cached, limiter } = require('./cache');

const URL_ = process.env.JUSTWATCH_URL || 'https://apis.justwatch.com/graphql';
const HOUR = 3600 * 1000;
const DAY = 24 * HOUR;
const DAYS_BACK = 7;
const limited = limiter(4);

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
  const res = await fetch(URL_, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'user-agent': 'Mozilla/5.0 (compatible; ott-catalogs)' },
    body: JSON.stringify({ query: QUERY, variables }),
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`JustWatch ${res.status}`);
  const j = await res.json();
  if (j.errors) throw new Error('JustWatch: ' + j.errors.map((e) => e.message).join('; ').slice(0, 300));
  return j.data.newTitles;
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
async function recent(country, packages, type) {
  if (!packages || !packages.length) return [];
  const dates = [];
  for (let i = 0; i <= DAYS_BACK; i++) dates.push(new Date(Date.now() - i * DAY).toISOString().slice(0, 10));
  const days = await Promise.all(
    dates.map((d) => addedOn(country, packages, d).catch((e) => (console.error(`JustWatch ${country} ${packages} ${d}:`, e.message), [])))
  );
  const seen = new Set();
  return days.flat().filter((x) => x.type === type && !seen.has(x.tmdbId) && seen.add(x.tmdbId));
}

module.exports = { recent };
