const { addonBuilder } = require('stremio-addon-sdk');
const tmdb = require('./tmdb');
const justwatch = require('./justwatch');
const { cached, within } = require('./cache');

// The seven services. `match` = TMDB provider names (India) that count as this service,
// compared after lower-casing and stripping spaces/punctuation, so "Netflix basic with Ads"
// still counts as Netflix. `fallback` IDs are only used if TMDB's provider list can't be read.
const SERVICES = [
  { key: 'prime',      name: 'Prime Video', match: ['amazonprimevideo', 'primevideo'],                 fallback: [119] },
  { key: 'aha',        name: 'aha',         match: ['aha'],                                            fallback: [532] },
  { key: 'netflix',    name: 'Netflix',     match: ['netflix'],                                        fallback: [8] },
  { key: 'sonyliv',    name: 'SonyLIV',     match: ['sonyliv'],                                        fallback: [237] },
  { key: 'sunnxt',     name: 'Sun NXT',     match: ['sunnxt'],                                         fallback: [309] },
  { key: 'jiohotstar', name: 'JioHotstar',  match: ['jiohotstar', 'hotstar', 'disneyplushotstar', 'jiocinema'], fallback: [122] },
  { key: 'zee5',       name: 'ZEE5',        match: ['zee5'],                                           fallback: [232] },
];

// Dropdown on each row: sort orders, then single years. No choice = Newest.
const THIS_YEAR = new Date().getFullYear();
const YEARS = [];
for (let y = THIS_YEAR; y >= 1980; y--) YEARS.push(String(y));
const SORTS = ['Newest', 'Popular', 'Top rated'];

const PAGE_SIZE = 20; // TMDB discover page size
const HOUR = 3600 * 1000;
const ENV_KEY = process.env.TMDB_API_KEY || '';

const manifest = {
  id: 'community.tamil.ott.catalogs',
  version: '1.2.0',
  name: 'Tamil OTT Catalogs',
  description:
    'Tamil movies and series currently on Prime Video, aha, Netflix, SonyLIV, Sun NXT, JioHotstar and ZEE5 in India. Newest first; pick a year or another sort from the dropdown. Catalogs only — data from TMDB and JustWatch.',
  logo: 'https://www.themoviedb.org/assets/2/v4/logos/v2/blue_square_2-d537fb228cf3ded904ef09b136fe3fec72548ebc1fea3fbbd1ad9e36364db38b.svg',
  types: ['movie', 'series'],
  idPrefixes: ['tmdb:'],
  resources: ['catalog', { name: 'meta', types: ['movie', 'series'], idPrefixes: ['tmdb:'] }],
  catalogs: SERVICES.flatMap((s) =>
    ['movie', 'series'].map((type) => ({
      type,
      id: `ta-${s.key}-${type}`,
      name: `${s.name} Tamil`,
      extra: [
        { name: 'genre', options: [...SORTS, ...YEARS], isRequired: false },
        { name: 'skip', isRequired: false },
      ],
    }))
  ),
  config: [
    {
      key: 'tmdbApiKey',
      type: 'text',
      title: 'TMDB API key (v3 key or v4 Read Access Token)',
      required: !ENV_KEY,
    },
  ],
  behaviorHints: { configurable: true, configurationRequired: !ENV_KEY },
};

const builder = new addonBuilder(manifest);

const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

// service key -> "id1|id2" for TMDB's with_watch_providers (| = OR)
async function providerIds(type, apiKey) {
  let list = [];
  try {
    list = await tmdb.providers(type, apiKey);
  } catch (e) {
    console.error('provider list failed, using fallbacks:', e.message);
  }
  const out = {};
  for (const s of SERVICES) {
    const ids = list
      .filter((p) => {
        const n = norm(p.provider_name);
        return s.match.some((m) => n === m || n.startsWith(m));
      })
      .map((p) => p.provider_id);
    out[s.key] = (ids.length ? ids : s.fallback).join('|');
  }
  return out;
}

const today = () => new Date().toISOString().slice(0, 10);

function sortParams(choice, type) {
  const dateField = type === 'series' ? 'first_air_date' : 'primary_release_date';
  if (/^\d{4}$/.test(choice || '')) {
    const yearField = type === 'series' ? 'first_air_date_year' : 'primary_release_year';
    return { [yearField]: choice, sort_by: 'popularity.desc' };
  }
  switch (choice) {
    case 'Popular':
      return { sort_by: 'popularity.desc' };
    case 'Top rated':
      return { sort_by: 'vote_average.desc', 'vote_count.gte': 25 };
    default: // Newest
      return { sort_by: `${dateField}.desc`, [`${dateField}.lte`]: today() };
  }
}

const dateOf = (item) => item.release_date || item.first_air_date || '';

// Internal fields (_tmdb, _date) are used for merging and removed before sending to Stremio.
async function toMeta(item, type, apiKey, knownImdb) {
  const imdb = knownImdb || (await tmdb.imdbId(type, item.id, apiKey));
  const date = dateOf(item);
  return {
    // IMDb IDs let Stremio's own metadata and your other addons recognise the title.
    // Titles TMDB has no IMDb ID for fall back to tmdb:<type>:<id> (served by the meta handler below).
    id: imdb || `tmdb:${type}:${item.id}`,
    type,
    name: item.title || item.name || item.original_title || item.original_name,
    poster: tmdb.poster(item.poster_path),
    background: tmdb.backdrop(item.backdrop_path),
    description: item.overview || undefined,
    releaseInfo: date ? date.slice(0, 4) : undefined,
    _tmdb: String(item.id),
    _date: date,
  };
}

const clean = ({ _tmdb, _date, ...meta }) => meta;

// Tamil titles that JustWatch says arrived on this service in the last week. These usually reach
// TMDB a day or so later; until then they're merged in here.
function recentArrivals(serviceKey, type, apiKey) {
  return cached(`arrivals:${serviceKey}:${type}`, HOUR, async () => {
    const items = await justwatch.recent(serviceKey, type);
    const metas = await Promise.all(
      items.map(async (x) => {
        try {
          const d = await tmdb.details(type, x.tmdbId, apiKey);
          if (d.original_language !== 'ta' || !dateOf(d) || dateOf(d) > today()) return null;
          return await toMeta(d, type, apiKey, x.imdbId);
        } catch {
          return null;
        }
      })
    );
    return metas.filter(Boolean);
  });
}

const keyFrom = (config) => (config && config.tmdbApiKey ? String(config.tmdbApiKey).trim() : ENV_KEY);

async function getCatalog(type, id, extra, apiKey) {
  const m = /^ta-([a-z0-9]+)-(movie|series)$/.exec(id);
  if (!m || !apiKey) return [];
  const serviceKey = m[1];
  const choice = (extra && extra.genre) || 'Newest';
  const isYear = /^\d{4}$/.test(choice);

  const skip = Number((extra && extra.skip) || 0);
  const page = Math.floor(skip / PAGE_SIZE) + 1;
  if (page > 500) return []; // TMDB max

  const ids = await providerIds(type, apiKey);
  const mergeArrivals = page === 1 && (choice === 'Newest' || isYear);
  const [data, arrivals] = await Promise.all([
    tmdb.discover(
      type,
      {
        with_original_language: 'ta',
        watch_region: 'IN',
        with_watch_providers: ids[serviceKey],
        with_watch_monetization_types: 'flatrate|free|ads',
        include_adult: false,
        language: 'en-US',
        page,
        ...sortParams(choice, type),
      },
      apiKey
    ),
    // Don't hold the row up for JustWatch: if it's slow, show TMDB's list now; the arrivals are
    // saved in the background and included next time.
    mergeArrivals ? within(6000, recentArrivals(serviceKey, type, apiKey), []) : [],
  ]);

  const listed = page > (data.total_pages || 0) ? [] : await Promise.all((data.results || []).map((it) => toMeta(it, type, apiKey)));
  if (!arrivals.length) return listed.map(clean);

  const have = new Set(listed.map((x) => x._tmdb));
  let extra_ = arrivals.filter((a) => !have.has(a._tmdb));
  if (isYear) {
    extra_ = extra_.filter((a) => a._date.startsWith(choice));
    return [...extra_, ...listed].map(clean);
  }
  // Newest: slot arrivals into release-date order, but only those that belong on this first page.
  const full = listed.length >= PAGE_SIZE;
  const oldest = full ? listed[listed.length - 1]._date : '';
  extra_ = extra_.filter((a) => a._date >= oldest);
  return [...listed, ...extra_].sort((a, b) => (a._date < b._date ? 1 : a._date > b._date ? -1 : 0)).map(clean);
}

builder.defineCatalogHandler(async ({ type, id, extra, config }) => {
  try {
    const metas = await getCatalog(type, id, extra, keyFrom(config));
    return { metas, cacheMaxAge: 1800, staleRevalidate: 2 * 3600, staleError: 7 * 24 * 3600 };
  } catch (e) {
    console.error(`catalog ${id} failed:`, e.message);
    return { metas: [] };
  }
});

// Only for titles without an IMDb ID (id = tmdb:movie:123 / tmdb:series:456).
builder.defineMetaHandler(async ({ type, id, config }) => {
  const apiKey = keyFrom(config);
  const m = /^tmdb:(movie|series):(\d+)$/.exec(id);
  if (!m || !apiKey) return { meta: null };
  try {
    const d = await tmdb.details(m[1], m[2], apiKey);
    const runtime = d.runtime || (d.episode_run_time && d.episode_run_time[0]);
    const date = dateOf(d);
    return {
      meta: {
        id,
        type,
        name: d.title || d.name,
        poster: tmdb.poster(d.poster_path),
        background: tmdb.backdrop(d.backdrop_path),
        description: d.overview || undefined,
        releaseInfo: date ? date.slice(0, 4) : undefined,
        genres: (d.genres || []).map((g) => g.name),
        runtime: runtime ? `${runtime} min` : undefined,
        website: d.homepage || undefined,
      },
      cacheMaxAge: 24 * 3600,
    };
  } catch (e) {
    console.error(`meta ${id} failed:`, e.message);
    return { meta: null };
  }
});

// Loads the first page of every row (default view) plus recent arrivals, so the Board opens instantly.
async function warmUp() {
  if (!ENV_KEY) return;
  const started = Date.now();
  await Promise.allSettled(
    manifest.catalogs.map((c) => recentArrivals(c.id.split('-')[1], c.type, ENV_KEY))
  );
  const results = await Promise.allSettled(manifest.catalogs.map((c) => getCatalog(c.type, c.id, {}, ENV_KEY)));
  const ok = results.filter((r) => r.status === 'fulfilled').length;
  console.log(`warm-up: ${ok}/${results.length} rows loaded in ${((Date.now() - started) / 1000).toFixed(1)}s`);
}

module.exports = builder.getInterface();
module.exports.SERVICES = SERVICES;
module.exports.warmUp = warmUp;
