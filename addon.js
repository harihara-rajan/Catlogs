const { addonBuilder } = require('stremio-addon-sdk');
const tmdb = require('./tmdb');
const justwatch = require('./justwatch');
const { cached, within } = require('./cache');

// Languages (TMDB original-language codes), in the order their rows appear, and which kinds of
// rows each gets.
const LANGUAGES = [
  { code: 'ta', name: 'Tamil', types: ['movie', 'series'] },
  { code: 'ml', name: 'Malayalam', types: ['movie'] },
  { code: 'hi', name: 'Hindi', types: ['movie', 'series'] },
];

// The services. `match` = TMDB provider names (India) that count as this service, compared after
// lower-casing and stripping spaces/punctuation, so "Netflix basic with Ads" still counts as Netflix.
// `fallback` IDs are only used if TMDB's provider list can't be read. `langs` = languages the
// service actually carries, so no empty rows are created.
const SERVICES = [
  { key: 'prime',       name: 'Prime Video', match: ['amazonprimevideo', 'primevideo'], fallback: [119],  langs: ['ta', 'ml', 'hi'] },
  { key: 'aha',         name: 'aha',         match: ['aha'],                            fallback: [532],  langs: ['ta'] },
  { key: 'netflix',     name: 'Netflix',     match: ['netflix'],                        fallback: [8],    langs: ['ta', 'ml', 'hi'] },
  { key: 'sonyliv',     name: 'SonyLIV',     match: ['sonyliv'],                        fallback: [237],  langs: ['ta', 'ml', 'hi'] },
  { key: 'sunnxt',      name: 'Sun NXT',     match: ['sunnxt'],                         fallback: [309],  langs: ['ta'] },
  { key: 'jiohotstar',  name: 'JioHotstar',  match: ['jiohotstar', 'hotstar', 'disneyplushotstar', 'jiocinema'], fallback: [2336], langs: ['ta', 'ml', 'hi'] },
  { key: 'zee5',        name: 'ZEE5',        match: ['zee5'],                           fallback: [232],  langs: ['ta', 'ml', 'hi'] },
  { key: 'manoramamax', name: 'ManoramaMAX', match: ['manoramamax'],                    fallback: [482],  langs: ['ml'] },
];

// Dropdown on each row: sort orders, then single years and/or decades. No choice = Newest.
// Stremio rejects manifests over 8 KB, so installs with more rows get fewer single years
// (see manifestFor): every year back to 1980 if it fits, otherwise recent years plus decades
// and "Older" (before 2000).
const THIS_YEAR = new Date().getFullYear();
const SORTS = ['Newest', 'Popular', 'Top rated'];
const MAX_MANIFEST = 7800;

function dropdown(fromYear) {
  const out = [...SORTS];
  if (fromYear) for (let y = THIS_YEAR; y >= fromYear; y--) out.push(String(y));
  if (fromYear === 1980) return out;
  const firstDecade = fromYear ? Math.floor((fromYear - 1) / 10) * 10 : Math.floor(THIS_YEAR / 10) * 10;
  for (let d = firstDecade; d >= 2000; d -= 10) out.push(`${d}s`);
  out.push('Older');
  return out;
}
const DROPDOWN_TIERS = [1980, 2015, 2020, null].map(dropdown);

// Date range for a year ("2024"), decade ("2010s") or "Older"; null for the sort orders.
function rangeOf(choice) {
  let m;
  if ((m = /^(\d{4})$/.exec(choice || ''))) return [`${m[1]}-01-01`, `${m[1]}-12-31`];
  if ((m = /^(\d{4})s$/.exec(choice || ''))) return [`${m[1]}-01-01`, `${Number(m[1]) + 9}-12-31`];
  if (choice === 'Older') return ['', '1999-12-31'];
  return null;
}

const PAGE_SIZE = 20; // TMDB discover page size
const HOUR = 3600 * 1000;
const ENV_KEY = process.env.TMDB_API_KEY || '';

const ALL_CATALOGS = LANGUAGES.flatMap((l) =>
  SERVICES.filter((s) => s.langs.includes(l.code)).flatMap((s) =>
    l.types.map((type) => ({
      type,
      id: `${l.code}-${s.key}-${type}`,
      name: `${s.name} ${l.name}`,
      extra: [{ name: 'genre', options: SORTS }, { name: 'skip' }],
    }))
  )
);

// Base manifest. server.js sends each install its own version via manifestFor().
const manifest = {
  id: 'community.tamil.ott.catalogs',
  version: '1.3.1',
  name: 'Tamil OTT Catalogs',
  description: 'Tamil movies and series on Indian streaming services, newest first. Data: TMDB and JustWatch.',
  logo: 'https://www.themoviedb.org/assets/2/v4/logos/v2/blue_square_2-d537fb228cf3ded904ef09b136fe3fec72548ebc1fea3fbbd1ad9e36364db38b.svg',
  types: ['movie', 'series'],
  idPrefixes: ['tmdb:'],
  resources: ['catalog', { name: 'meta', types: ['movie', 'series'], idPrefixes: ['tmdb:'] }],
  catalogs: ALL_CATALOGS.filter((c) => c.id.startsWith('ta-')),
  // Settings travel in the install link as JSON, e.g. {"languages":"ta,ml"}.
  config: [
    { key: 'languages', type: 'text', title: 'Languages' },
    { key: 'tmdbApiKey', type: 'text', title: 'TMDB key' },
  ],
  behaviorHints: { configurable: true, configurationRequired: !ENV_KEY },
};

// Parse the languages setting; defaults to Tamil only (what the first versions had).
function languagesFrom(config) {
  const raw = config && typeof config.languages === 'string' ? config.languages : 'ta';
  const picked = raw.split(',').map((s) => s.trim()).filter((c) => LANGUAGES.some((l) => l.code === c));
  return picked.length ? LANGUAGES.filter((l) => picked.includes(l.code)).map((l) => l.code) : ['ta'];
}

// Manifest for one install: only the chosen languages' rows, named after them.
function manifestFor(config) {
  const langs = languagesFrom(config);
  const names = LANGUAGES.filter((l) => langs.includes(l.code)).map((l) => l.name);
  const m = JSON.parse(JSON.stringify(manifest));
  m.name = names.length === 1 ? `${names[0]} OTT Catalogs` : `OTT Catalogs (${names.join(', ')})`;
  m.description = `${names.join(', ')} movies and series on Indian streaming services, newest first. Data: TMDB and JustWatch.`;
  const hasKey = ENV_KEY || (config && config.tmdbApiKey);
  m.behaviorHints = { configurable: true, configurationRequired: !hasKey };
  const rows = ALL_CATALOGS.filter((c) => langs.includes(c.id.split('-')[0]));
  for (const options of DROPDOWN_TIERS) {
    m.catalogs = rows.map((c) => ({ ...c, extra: [{ name: 'genre', options }, { name: 'skip' }] }));
    if (JSON.stringify(m).length <= MAX_MANIFEST) break;
  }
  return m;
}

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
  const range = rangeOf(choice);
  if (range) return { [`${dateField}.gte`]: range[0], [`${dateField}.lte`]: range[1], sort_by: 'popularity.desc' };
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

// Titles in this language that JustWatch says arrived on this service in the last week. These
// usually reach TMDB a day or so later; until then they're merged in here.
function recentArrivals(serviceKey, type, lang, apiKey) {
  return cached(`arrivals:${serviceKey}:${type}:${lang}`, HOUR, async () => {
    const items = await justwatch.recent(serviceKey, type);
    const metas = await Promise.all(
      items.map(async (x) => {
        try {
          const d = await tmdb.details(type, x.tmdbId, apiKey);
          if (d.original_language !== lang || !dateOf(d) || dateOf(d) > today()) return null;
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
  const m = /^([a-z]{2})-([a-z0-9]+)-(movie|series)$/.exec(id);
  if (!m || !apiKey) return [];
  const [, lang, serviceKey] = m;
  if (!ALL_CATALOGS.some((c) => c.id === id && c.type === type)) return [];
  const choice = (extra && extra.genre) || 'Newest';
  const range = rangeOf(choice);

  const skip = Number((extra && extra.skip) || 0);
  const page = Math.floor(skip / PAGE_SIZE) + 1;
  if (page > 500) return []; // TMDB max

  const ids = await providerIds(type, apiKey);
  const mergeArrivals = page === 1 && (choice === 'Newest' || range);
  const [data, arrivals] = await Promise.all([
    tmdb.discover(
      type,
      {
        with_original_language: lang,
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
    mergeArrivals ? within(6000, recentArrivals(serviceKey, type, lang, apiKey), []) : [],
  ]);

  const listed = page > (data.total_pages || 0) ? [] : await Promise.all((data.results || []).map((it) => toMeta(it, type, apiKey)));
  if (!arrivals.length) return listed.map(clean);

  const have = new Set(listed.map((x) => x._tmdb));
  let extra_ = arrivals.filter((a) => !have.has(a._tmdb));
  if (range) {
    extra_ = extra_.filter((a) => a._date >= range[0] && a._date <= range[1]);
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

// Loads the first page of every row (default view) plus recent arrivals, so rows open instantly.
async function warmUp() {
  if (!ENV_KEY) return;
  const started = Date.now();
  const split = (c) => c.id.split('-'); // [lang, service, type]
  await Promise.allSettled(ALL_CATALOGS.map((c) => recentArrivals(split(c)[1], c.type, split(c)[0], ENV_KEY)));
  const results = await Promise.allSettled(ALL_CATALOGS.map((c) => getCatalog(c.type, c.id, {}, ENV_KEY)));
  const ok = results.filter((r) => r.status === 'fulfilled').length;
  console.log(`warm-up: ${ok}/${results.length} rows loaded in ${((Date.now() - started) / 1000).toFixed(1)}s`);
}

module.exports = builder.getInterface();
module.exports.SERVICES = SERVICES;
module.exports.LANGUAGES = LANGUAGES;
module.exports.warmUp = warmUp;
module.exports.manifestFor = manifestFor;
module.exports.languagesFrom = languagesFrom;
module.exports.hasServerKey = !!ENV_KEY;
