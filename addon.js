const { addonBuilder } = require('stremio-addon-sdk');
const tmdb = require('./tmdb');
const justwatch = require('./justwatch');
const { cached, within } = require('./cache');
const imdbRatings = require('./imdb-ratings');
const mdblist = require('./mdblist');
const poster = require('./poster');

// Streaming services, per country: TMDB provider IDs (TMDB and JustWatch share these) and
// JustWatch package short names (for recent arrivals). Some services have several plans.
const SERVICES = {
  prime:       { name: 'Prime Video',    IN: { ids: [119], jw: ['prv'] },  US: { ids: [9], jw: ['amp'] } },
  aha:         { name: 'aha',            IN: { ids: [532], jw: ['aha'] } },
  netflix:     { name: 'Netflix',        IN: { ids: [8], jw: ['nfx'] },    US: { ids: [8, 1796], jw: ['nfx', 'nfa'] } },
  sonyliv:     { name: 'SonyLIV',        IN: { ids: [237], jw: ['snl'] } },
  sunnxt:      { name: 'Sun NXT',        IN: { ids: [309], jw: ['snx'] } },
  jiohotstar:  { name: 'JioHotstar',     IN: { ids: [2336], jw: ['jhs'] } },
  zee5:        { name: 'ZEE5',           IN: { ids: [232], jw: ['zee'] } },
  manoramamax: { name: 'ManoramaMAX',    IN: { ids: [482], jw: ['mrx'] } },
  appletv:     { name: 'Apple TV',       IN: { ids: [350], jw: ['atp'] },  US: { ids: [350], jw: ['atp'] } },
  lionsgate:   { name: 'Lionsgate Play', IN: { ids: [561], jw: ['lgp'] } },
  disney:      { name: 'Disney+',        US: { ids: [337], jw: ['dnp'] } },
  hbomax:      { name: 'HBO Max',        US: { ids: [1899], jw: ['mxx'] } },
  hulu:        { name: 'Hulu',           US: { ids: [15], jw: ['hlu'] } },
  paramount:   { name: 'Paramount+',     US: { ids: [2303, 2616], jw: ['ppp', 'ppe'] } },
  peacock:     { name: 'Peacock',        US: { ids: [386, 387], jw: ['pct', 'pcp'] } },
};

// The tick boxes on the install page, in the order their rows appear. `lang` = TMDB original
// language, `region` = country whose streaming catalogues are used, `defaultSort` = how rows are
// ordered when nothing is picked in the dropdown (Newest if not set).
const EDITIONS = [
  { code: 'ta', name: 'Tamil', lang: 'ta', region: 'IN', types: ['movie', 'series'],
    services: ['prime', 'aha', 'netflix', 'sonyliv', 'sunnxt', 'jiohotstar', 'zee5'] },
  { code: 'ml', name: 'Malayalam', lang: 'ml', region: 'IN', types: ['movie'],
    services: ['prime', 'netflix', 'sonyliv', 'jiohotstar', 'zee5', 'manoramamax'] },
  { code: 'hi', name: 'Hindi', lang: 'hi', region: 'IN', types: ['movie', 'series'],
    services: ['prime', 'netflix', 'sonyliv', 'jiohotstar', 'zee5'] },
  { code: 'en-in', name: 'English (India)', rowLabel: 'English (IN)', lang: 'en', region: 'IN', types: ['movie', 'series'], defaultSort: 'Popular',
    services: ['netflix', 'prime', 'jiohotstar', 'appletv', 'sonyliv', 'lionsgate'] },
  { code: 'en-us', name: 'English (US)', rowLabel: 'English (US)', lang: 'en', region: 'US', types: ['movie', 'series'], defaultSort: 'Popular',
    services: ['netflix', 'prime', 'disney', 'hbomax', 'hulu', 'appletv', 'paramount', 'peacock'] },
];

// Dropdown on each row: sort orders, then single years and/or decades. No choice = Newest.
// Stremio rejects manifests over 8 KB, so installs with more rows get a shorter dropdown
// (see manifestFor): every year back to 1980 if it fits, then recent years plus decades and
// "Older" (before 2000), then decades only, then just the sort orders, and finally no dropdown.
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
const DROPDOWN_TIERS = [dropdown(1980), dropdown(2015), dropdown(2020), dropdown(null), SORTS, null];

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

// Every possible row. Tamil keeps its original ids (ta-netflix-movie) so old installs still work.
const ROWS = EDITIONS.flatMap((e) =>
  e.services.flatMap((key) =>
    e.types.map((type) => ({
      id: `${e.code}-${key}-${type}`,
      type,
      name: `${SERVICES[key].name} ${e.rowLabel || e.name}`,
      edition: e,
      serviceKey: key,
      service: SERVICES[key][e.region],
    }))
  )
);
const ROW_BY_ID = new Map(ROWS.map((r) => [r.id, r]));
// The row's default sort goes first in its dropdown.
function catalogEntry(r, options) {
  const first = r.edition.defaultSort || 'Newest';
  const opts = options && [first, ...options.filter((o) => o !== first)];
  return {
    type: r.type,
    id: r.id,
    name: r.name,
    extra: opts ? [{ name: 'genre', options: opts }, { name: 'skip' }] : [{ name: 'skip' }],
  };
}

// Base manifest. server.js sends each install its own version via manifestFor().
const manifest = {
  id: 'community.tamil.ott.catalogs',
  version: '1.5.1',
  name: 'Tamil OTT Catalogs',
  description: 'Tamil movies and series on streaming services, newest first. Data: TMDB and JustWatch.',
  logo: 'https://www.themoviedb.org/assets/2/v4/logos/v2/blue_square_2-d537fb228cf3ded904ef09b136fe3fec72548ebc1fea3fbbd1ad9e36364db38b.svg',
  types: ['movie', 'series'],
  idPrefixes: ['tmdb:'],
  resources: ['catalog', { name: 'meta', types: ['movie', 'series'], idPrefixes: ['tmdb:'] }],
  catalogs: ROWS.filter((r) => r.edition.code === 'ta').map((r) => catalogEntry(r, SORTS)),
  // Settings travel in the install link as JSON, e.g. {"languages":"ta,en-us"}.
  config: [
    { key: 'languages', type: 'text', title: 'Languages' },
    { key: 'tmdbApiKey', type: 'text', title: 'TMDB key' },
  ],
  behaviorHints: { configurable: true, configurationRequired: !ENV_KEY },
};

// Parse the languages setting; defaults to Tamil only (what the first versions had).
function languagesFrom(config) {
  const raw = config && typeof config.languages === 'string' ? config.languages : 'ta';
  const picked = raw.split(',').map((s) => s.trim());
  const codes = EDITIONS.filter((e) => picked.includes(e.code)).map((e) => e.code);
  return codes.length ? codes : ['ta'];
}

// Manifest for one install: only the chosen rows, named after them, with the richest dropdown
// that still fits.
function manifestFor(config) {
  const codes = languagesFrom(config);
  const names = EDITIONS.filter((e) => codes.includes(e.code)).map((e) => e.name);
  const m = JSON.parse(JSON.stringify(manifest));
  m.name = names.length === 1 ? `${names[0]} OTT Catalogs` : `OTT Catalogs (${names.join(', ')})`;
  m.description = `${names.join(', ')} movies and series on streaming services, newest first. Data: TMDB and JustWatch.`;
  const hasKey = ENV_KEY || (config && config.tmdbApiKey);
  m.behaviorHints = { configurable: true, configurationRequired: !hasKey };
  const rows = ROWS.filter((r) => codes.includes(r.edition.code));
  for (const options of DROPDOWN_TIERS) {
    m.catalogs = rows.map((r) => catalogEntry(r, options));
    if (JSON.stringify(m).length <= MAX_MANIFEST) break;
  }
  return m;
}

const builder = new addonBuilder(manifest);

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
  const meta = {
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
  // Tells Stremio which video *is* the movie, so it offers "Mark as watched" and Play straight from
  // the row (Stremio's own catalogs do the same). Series have episodes instead, so they don't.
  if (type === 'movie') meta.behaviorHints = { defaultVideoId: meta.id };
  return meta;
}

const clean = ({ _tmdb, _date, ...meta }) => meta;

// Titles in this row's language that JustWatch says arrived on this service in the last week.
// These usually reach TMDB a day or so later; until then they're merged in here.
const arrivalStats = new Map(); // row id -> what the last arrivals check found (for /debug)

function recentArrivals(row, apiKey) {
  return cached(`arrivals:${row.id}`, HOUR, async () => {
    const items = await justwatch.recent(row.edition.region, row.service.jw, row.type);
    let failed = 0;
    const metas = await Promise.all(
      items.map(async (x) => {
        try {
          const d = await tmdb.details(row.type, x.tmdbId, apiKey);
          if (d.original_language !== row.edition.lang || !dateOf(d) || dateOf(d) > today()) return null;
          return await toMeta(d, row.type, apiKey, x.imdbId);
        } catch (e) {
          if (!/ 404 /.test(e.message)) failed++; // 404 = TMDB doesn't know it; anything else is temporary
          return null;
        }
      })
    );
    const found = metas.filter(Boolean);
    arrivalStats.set(row.id, { at: new Date().toISOString(), checked: items.length, failed, found: found.map((m) => `${m.name} (${m.releaseInfo})`) });
    // If lookups failed (e.g. TMDB busy), don't keep an incomplete list: the next request tries again.
    if (failed) throw new Error(`${failed} of ${items.length} TMDB lookups failed for ${row.id}`);
    return found;
  });
}

const keyFrom = (config) => (config && config.tmdbApiKey ? String(config.tmdbApiKey).trim() : ENV_KEY);

// -> { metas, partial }; partial = new arrivals should have been merged in but weren't ready yet.
async function getCatalog(type, id, extra, apiKey) {
  const row = ROW_BY_ID.get(id);
  if (!row || row.type !== type || !apiKey) return { metas: [], partial: false };
  const choice = (extra && extra.genre) || row.edition.defaultSort || 'Newest';
  const range = rangeOf(choice);

  const skip = Number((extra && extra.skip) || 0);
  const page = Math.floor(skip / PAGE_SIZE) + 1;
  if (page > 500) return { metas: [], partial: false }; // TMDB max

  const mergeArrivals = page === 1 && (choice === 'Newest' || range);
  const [data, arrivals] = await Promise.all([
    tmdb.discover(
      type,
      {
        with_original_language: row.edition.lang,
        watch_region: row.edition.region,
        with_watch_providers: row.service.ids.join('|'),
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
    mergeArrivals ? within(6000, recentArrivals(row, apiKey), null) : [],
  ]);

  const listed = page > (data.total_pages || 0) ? [] : await Promise.all((data.results || []).map((it) => toMeta(it, type, apiKey)));
  const partial = arrivals === null;
  if (!arrivals || !arrivals.length) return { metas: listed.map(clean), partial };

  const have = new Set(listed.map((x) => x._tmdb));
  let extra_ = arrivals.filter((a) => !have.has(a._tmdb));
  if (range) {
    extra_ = extra_.filter((a) => a._date >= range[0] && a._date <= range[1]);
    return { metas: [...extra_, ...listed].map(clean), partial };
  }
  // Newest: slot arrivals into release-date order, but only those that belong on this first page.
  const full = listed.length >= PAGE_SIZE;
  const oldest = full ? listed[listed.length - 1]._date : '';
  extra_ = extra_.filter((a) => a._date >= oldest);
  return { metas: [...listed, ...extra_].sort((a, b) => (a._date < b._date ? 1 : a._date > b._date ? -1 : 0)).map(clean), partial };
}

// Public address of this server, for badged poster links (Render sets RENDER_EXTERNAL_URL).
const BASE_URL = (process.env.PUBLIC_URL || process.env.RENDER_EXTERNAL_URL || '').replace(/\/$/, '');

// Adds IMDb and Rotten Tomatoes ratings: a badge on the poster, a line at the top of the
// description, and Stremio's imdbRating field. Titles without a known score are queued for lookup.
function withRatings(meta) {
  if (!/^tt\d+$/.test(meta.id)) return meta;
  const imdb = imdbRatings.get(meta.id);
  const rt = mdblist.rt(meta.type, meta.id);
  const rtScore = typeof rt === 'number' ? rt : null;
  if (imdb == null && rtScore == null) return meta;
  const line = [imdb != null && `IMDb ${imdb.toFixed(1)}`, rtScore != null && `Rotten Tomatoes ${rtScore}%`].filter(Boolean).join(' · ');
  return {
    ...meta,
    imdbRating: imdb != null ? imdb.toFixed(1) : undefined,
    description: meta.description ? `${line}\n\n${meta.description}` : line,
    poster: poster.posterUrl(BASE_URL, meta.id, meta.poster, imdb, rtScore),
  };
}

builder.defineCatalogHandler(async ({ type, id, extra, config }) => {
  try {
    const { metas, partial } = await getCatalog(type, id, extra, keyFrom(config));
    // If new arrivals weren't ready, ask Stremio to check back in 2 minutes instead of keeping
    // this incomplete row for half an hour.
    if (partial) return { metas: metas.map(withRatings), cacheMaxAge: 120 };
    return { metas: metas.map(withRatings), cacheMaxAge: 1800, staleRevalidate: 2 * 3600, staleError: 7 * 24 * 3600 };
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
        behaviorHints: m[1] === 'movie' ? { defaultVideoId: id } : undefined,
      },
      cacheMaxAge: 24 * 3600,
    };
  } catch (e) {
    console.error(`meta ${id} failed:`, e.message);
    return { meta: null };
  }
});

// Loads the first page of every row (default view) plus recent arrivals, so rows open instantly.
// Loads the first page of every row (default view) so rows open instantly. New arrivals are
// prepared first, and only for rows whose default view uses them (Newest), Indian rows first.
async function warmUp() {
  if (!ENV_KEY) return;
  const started = Date.now();
  for (const r of ROWS.filter((r) => (r.edition.defaultSort || 'Newest') === 'Newest')) {
    await recentArrivals(r, ENV_KEY).catch((e) => console.error('arrivals:', e.message));
  }
  const results = await Promise.allSettled(
    ROWS.map((r) => getCatalog(r.type, r.id, {}, ENV_KEY).then(({ metas }) => metas.map(withRatings))) // also queues rating lookups
  );
  const ok = results.filter((r) => r.status === 'fulfilled').length;
  console.log(`warm-up: ${ok}/${results.length} rows loaded in ${((Date.now() - started) / 1000).toFixed(1)}s`);
}

module.exports = builder.getInterface();
module.exports.EDITIONS = EDITIONS;
module.exports.warmUp = warmUp;
module.exports.arrivalStats = (id) => arrivalStats.get(id) || null;
module.exports.manifestFor = manifestFor;
module.exports.languagesFrom = languagesFrom;
module.exports.hasServerKey = !!ENV_KEY;
