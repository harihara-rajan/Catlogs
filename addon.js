const { addonBuilder } = require('stremio-addon-sdk');
const tmdb = require('./tmdb');

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

// Shown as the dropdown filter on each catalog.
const SORTS = ['Popular', 'Newest', 'Top rated'];

const PAGE_SIZE = 20; // TMDB discover page size
const ENV_KEY = process.env.TMDB_API_KEY || '';

const manifest = {
  id: 'community.tamil.ott.catalogs',
  version: '1.0.0',
  name: 'Tamil OTT Catalogs',
  description:
    'Tamil movies and series currently on Prime Video, aha, Netflix, SonyLIV, Sun NXT, JioHotstar and ZEE5 in India. Catalogs only — data from TMDB / JustWatch.',
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
        { name: 'genre', options: SORTS, isRequired: false },
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

function sortParams(sort, type) {
  const today = new Date().toISOString().slice(0, 10);
  const dateField = type === 'series' ? 'first_air_date' : 'primary_release_date';
  switch (sort) {
    case 'Newest':
      return { sort_by: `${dateField}.desc`, [`${dateField}.lte`]: today };
    case 'Top rated':
      return { sort_by: 'vote_average.desc', 'vote_count.gte': 25 };
    default:
      return { sort_by: 'popularity.desc' };
  }
}

function yearOf(item) {
  const d = item.release_date || item.first_air_date;
  return d ? d.slice(0, 4) : undefined;
}

async function toMetaPreview(item, type, apiKey) {
  const imdb = await tmdb.imdbId(type, item.id, apiKey);
  return {
    // IMDb IDs let Stremio's own metadata and your other addons recognise the title.
    // Titles TMDB has no IMDb ID for fall back to tmdb:<type>:<id> (served by the meta handler below).
    id: imdb || `tmdb:${type}:${item.id}`,
    type,
    name: item.title || item.name || item.original_title || item.original_name,
    poster: tmdb.poster(item.poster_path),
    background: tmdb.backdrop(item.backdrop_path),
    description: item.overview || undefined,
    releaseInfo: yearOf(item),
  };
}

const keyFrom = (config) => (config && config.tmdbApiKey ? String(config.tmdbApiKey).trim() : ENV_KEY);

builder.defineCatalogHandler(async ({ type, id, extra, config }) => {
  const apiKey = keyFrom(config);
  const m = /^ta-([a-z0-9]+)-(movie|series)$/.exec(id);
  if (!m || !apiKey) return { metas: [] };
  const serviceKey = m[1];

  const skip = Number((extra && extra.skip) || 0);
  const page = Math.floor(skip / PAGE_SIZE) + 1;
  if (page > 500) return { metas: [] }; // TMDB max

  try {
    const ids = await providerIds(type, apiKey);
    const data = await tmdb.discover(
      type,
      {
        with_original_language: 'ta',
        watch_region: 'IN',
        with_watch_providers: ids[serviceKey],
        with_watch_monetization_types: 'flatrate|free|ads',
        include_adult: false,
        language: 'en-US',
        page,
        ...sortParams(extra && extra.genre, type),
      },
      apiKey
    );
    if (page > (data.total_pages || 0)) return { metas: [] };
    const metas = await Promise.all((data.results || []).map((it) => toMetaPreview(it, type, apiKey)));
    return { metas, cacheMaxAge: 6 * 3600, staleRevalidate: 24 * 3600, staleError: 7 * 24 * 3600 };
  } catch (e) {
    console.error(`catalog ${id} page ${page} failed:`, e.message);
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
    return {
      meta: {
        id,
        type,
        name: d.title || d.name,
        poster: tmdb.poster(d.poster_path),
        background: tmdb.backdrop(d.backdrop_path),
        description: d.overview || undefined,
        releaseInfo: yearOf(d),
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

module.exports = builder.getInterface();
module.exports.SERVICES = SERVICES;
