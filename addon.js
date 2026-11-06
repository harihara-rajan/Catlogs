const fs = require('fs');
const path = require('path');
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

// Dropdown on each row: sort orders, then single years. No choice = Newest.
const THIS_YEAR = new Date().getFullYear();
const YEARS = [];
for (let y = THIS_YEAR; y >= 1980; y--) YEARS.push(String(y));
const SORTS = ['Newest', 'Popular', 'Top rated'];

const PAGE_SIZE = 20; // TMDB discover page size
const PIN_DAYS = 14; // pinned titles stay at the top of a row this long after their "added" date
const ENV_KEY = process.env.TMDB_API_KEY || '';

const manifest = {
  id: 'community.tamil.ott.catalogs',
  version: '1.1.0',
  name: 'Tamil OTT Catalogs',
  description:
    'Tamil movies and series currently on Prime Video, aha, Netflix, SonyLIV, Sun NXT, JioHotstar and ZEE5 in India. Newest first; pick a year or another sort from the dropdown. Catalogs only — data from TMDB / JustWatch.',
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

function sortParams(choice, type) {
  const today = new Date().toISOString().slice(0, 10);
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
      return { sort_by: `${dateField}.desc`, [`${dateField}.lte`]: today };
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

// ---------------------------------------------------------------------------------------------
// Pinned titles (pins.json): new arrivals you add by hand so they show up before TMDB/JustWatch
// catch up. They appear at the top of the service's row for PIN_DAYS days after "added".
// ---------------------------------------------------------------------------------------------
function loadPins() {
  try {
    const raw = JSON.parse(fs.readFileSync(path.join(__dirname, 'pins.json'), 'utf8'));
    const out = {};
    for (const s of SERVICES) out[s.key] = Array.isArray(raw[s.key]) ? raw[s.key] : [];
    return out;
  } catch (e) {
    if (e.code !== 'ENOENT') console.error('pins.json could not be read:', e.message);
    return {};
  }
}
const PINS = loadPins();

function pinIsActive(pin) {
  if (!pin.added) return true;
  const added = Date.parse(pin.added);
  if (Number.isNaN(added)) return true;
  return Date.now() - added < PIN_DAYS * 24 * 3600 * 1000;
}

async function resolvePin(pin, type, apiKey) {
  try {
    let item = null;
    if (pin.imdb) {
      item = (await tmdb.findByImdb(type, pin.imdb, apiKey))[0] || null;
    } else if (pin.title) {
      const results = await tmdb.search(type, pin.title, pin.year, apiKey);
      item = results.find((r) => r.original_language === 'ta') || results[0] || null;
    }
    if (item) {
      const meta = await toMetaPreview(item, type, apiKey);
      if (pin.imdb) meta.id = pin.imdb;
      return meta;
    }
    // Not on TMDB yet: an IMDb ID still works, Stremio fills in the details itself.
    if (pin.imdb) return { id: pin.imdb, type, name: pin.title || pin.imdb, releaseInfo: pin.year ? String(pin.year) : undefined };
  } catch (e) {
    console.error(`pin ${pin.title || pin.imdb} failed:`, e.message);
  }
  return null;
}

async function pinnedFor(serviceKey, type, apiKey) {
  const pins = (PINS[serviceKey] || []).filter((p) => (p.type || 'movie') === type && pinIsActive(p));
  const metas = await Promise.all(pins.map((p) => resolvePin(p, type, apiKey)));
  return metas.filter(Boolean);
}

// ---------------------------------------------------------------------------------------------

const keyFrom = (config) => (config && config.tmdbApiKey ? String(config.tmdbApiKey).trim() : ENV_KEY);

async function getCatalog(type, id, extra, apiKey) {
  const m = /^ta-([a-z0-9]+)-(movie|series)$/.exec(id);
  if (!m || !apiKey) return [];
  const serviceKey = m[1];
  const choice = (extra && extra.genre) || 'Newest';

  const skip = Number((extra && extra.skip) || 0);
  const page = Math.floor(skip / PAGE_SIZE) + 1;
  if (page > 500) return []; // TMDB max

  const ids = await providerIds(type, apiKey);
  const [data, pinned] = await Promise.all([
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
    // Pins go on top of the first page of the Newest and Popular views.
    page === 1 && (choice === 'Newest' || choice === 'Popular') ? pinnedFor(serviceKey, type, apiKey) : [],
  ]);

  const listed = page > (data.total_pages || 0) ? [] : await Promise.all((data.results || []).map((it) => toMetaPreview(it, type, apiKey)));
  const seen = new Set(pinned.map((p) => p.id));
  return [...pinned, ...listed.filter((x) => !seen.has(x.id))];
}

builder.defineCatalogHandler(async ({ type, id, extra, config }) => {
  try {
    const metas = await getCatalog(type, id, extra, keyFrom(config));
    return { metas, cacheMaxAge: 3600, staleRevalidate: 4 * 3600, staleError: 7 * 24 * 3600 };
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

// Loads the first page of every row (default view) so the Board opens instantly.
async function warmUp() {
  if (!ENV_KEY) return;
  const started = Date.now();
  const results = await Promise.allSettled(
    manifest.catalogs.map((c) => getCatalog(c.type, c.id, {}, ENV_KEY))
  );
  const ok = results.filter((r) => r.status === 'fulfilled').length;
  console.log(`warm-up: ${ok}/${results.length} rows loaded in ${((Date.now() - started) / 1000).toFixed(1)}s`);
}

module.exports = builder.getInterface();
module.exports.SERVICES = SERVICES;
module.exports.warmUp = warmUp;
