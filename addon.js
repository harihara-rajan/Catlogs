const { addonBuilder } = require('stremio-addon-sdk');
const tmdb = require('./tmdb');
const justwatch = require('./justwatch');
const { cached, within } = require('./cache');
const imdbRatings = require('./imdb-ratings');
const mdblist = require('./mdblist');
const poster = require('./poster');
const banner = require('./banner');

const { SERVICES, EDITIONS, DUB_EDITIONS } = require('./services');
const dubs = require('./dubs');

// Every tick box on the install page: language rows first, then the "dubbed" rows.
const TICK_BOXES = [...EDITIONS, ...DUB_EDITIONS];

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
// Each language's "New This Week" rows, then one row per service (manifestFor puts all the
// "New This Week" rows at the very top).
const ROWS = EDITIONS.flatMap((e) => [
  ...(e.newThisWeek
    ? e.types.map((type) => ({ id: `${e.code}-new-${type}`, type, name: `New This Week · ${e.rowLabel || e.name}`, edition: e, newWeek: true }))
    : []),
  ...e.services.flatMap((key) =>
    e.types.map((type) => ({
      id: `${e.code}-${key}-${type}`,
      type,
      name: `${e.rowLabel || e.name} · ${SERVICES[key].name}`,
      edition: e,
      serviceKey: key,
      service: SERVICES[key][e.region],
    }))
  ),
]);
// One movies row per "dubbed" tick box, e.g. ta-dub-movie.
for (const e of DUB_EDITIONS) {
  ROWS.push({ id: `${e.code}-movie`, type: 'movie', name: e.rowName, edition: e, dub: true });
}
const ROW_BY_ID = new Map(ROWS.map((r) => [r.id, r]));
// The row's default sort goes first in its dropdown.
function catalogEntry(r, options) {
  if (r.newWeek) return { type: r.type, id: r.id, name: r.name, extra: [{ name: 'skip' }] }; // no dropdown
  const first = r.edition.defaultSort || 'Newest';
  const opts = options && [first, ...options.filter((o) => o !== first)];
  return {
    type: r.type,
    id: r.id,
    name: r.name,
    extra: opts ? [{ name: 'genre', options: opts }, { name: 'skip' }] : [{ name: 'skip' }],
  };
}

// This server's public address (Render sets RENDER_EXTERNAL_URL), for links to its own images.
const PUBLIC_BASE = (process.env.PUBLIC_URL || process.env.RENDER_EXTERNAL_URL || 'https://tamil-ott-catalogs.onrender.com').replace(/\/$/, '');

// Base manifest. server.js sends each install its own version via manifestFor().
const manifest = {
  id: 'community.tamil.ott.catalogs',
  version: '2.3.5',
  name: 'Tamil OTT Catalogs',
  description: 'Tamil movies and series on streaming services, newest first. Data: TMDB and JustWatch.',
  logo: `${PUBLIC_BASE}/logo.png`,
  background: `${PUBLIC_BASE}/background.jpg`,
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
  const codes = TICK_BOXES.filter((e) => picked.includes(e.code)).map((e) => e.code);
  return codes.length ? codes : ['ta'];
}

// Manifest for one install: only the chosen rows, named after them, with the richest dropdown
// that still fits.
// Which rows of each tick box were chosen: config["ta"] = "new,prime:m,netflix:s" (keys: "new" for
// New This Week, otherwise service keys; ":m" = movies only, ":s" = series only, no suffix = both).
// A tick box without a choice gets all its rows, so older install links keep working.
// -> code -> Set of keys (null = all)
function chipsFrom(config) {
  const out = {};
  for (const code of languagesFrom(config)) {
    const raw = config && typeof config[code] === 'string' ? config[code] : null;
    out[code] = raw ? new Set(raw.split(',').map((x) => x.trim()).filter(Boolean)) : null;
  }
  return out;
}

// Chips a tick box offers on the install page: New This Week (if it has it), then its services.
function chipsOf(e) {
  if (e.audio) return [];
  return [
    ...(e.newThisWeek ? [{ key: 'new', name: 'New This Week', types: e.types }] : []),
    ...e.services.map((k) => ({ key: k, name: SERVICES[k].name, types: e.types })),
  ];
}

function rowChosen(r, chips) {
  const set = chips[r.edition.code];
  if (set === undefined) return false; // tick box not chosen
  if (set === null || r.dub) return true; // all rows
  const key = r.newWeek ? 'new' : r.serviceKey;
  return set.has(key) || set.has(`${key}:${r.type === 'movie' ? 'm' : 's'}`);
}

function manifestFor(config) {
  const codes = languagesFrom(config);
  const chips = chipsFrom(config);
  const names = TICK_BOXES.filter((e) => codes.includes(e.code)).map((e) => e.shortName || e.name);
  const m = JSON.parse(JSON.stringify(manifest));
  m.name = names.length === 1 ? `${names[0]} OTT Catalogs` : `OTT Catalogs (${names.join(', ')})`;
  m.description = `${names.join(', ')} movies and series on streaming services, newest first. Data: TMDB and JustWatch.`;
  const hasKey = ENV_KEY || (config && config.tmdbApiKey);
  m.behaviorHints = { configurable: true, configurationRequired: !hasKey };
  // All "New This Week" rows go to the very top, then every other row in its usual order.
  let chosen = ROWS.filter((r) => rowChosen(r, chips));
  if (!chosen.length) chosen = ROWS.filter((r) => codes.includes(r.edition.code)); // nothing valid picked: all
  const rows = [...chosen.filter((r) => r.newWeek), ...chosen.filter((r) => !r.newWeek)];
  for (const options of DROPDOWN_TIERS) {
    m.catalogs = rows.map((r) => catalogEntry(r, options));
    if (Buffer.byteLength(JSON.stringify(m)) <= MAX_MANIFEST) break;
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
  return cached(`arrivals:${row.id}`, 20 * 60 * 1000, async () => {
    let items;
    try {
      items = await justwatch.recent(row.edition.region, row.service.jw, row.type);
    } catch (e) {
      arrivalStats.set(row.id, { at: new Date().toISOString(), error: e.message });
      throw e; // not cached: tried again on the next request
    }
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

// Is a title that turned up on a service on `added` (YYYY-MM-DD) genuinely new there?
// JustWatch's "added" dates aren't reliable: it sometimes re-dates titles that have been on a
// service for months (e.g. ~600 ZEE5 titles on 6 Nov 2026, Pariwar on Prime Video), and doesn't
// keep the real dates. Indian films usually reach OTT 4-8 weeks after the cinema release (and OTT
// originals on their release day), so a title only counts if it came out in the 90 days before
// it turned up, or 45 days on a "bulk" day (a service getting an unusually large number of titles,
// i.e. JustWatch catching up on its catalogue). Films that reach OTT later are missed.
const NEW_WINDOW = 90;
const NEW_WINDOW_BULK = 45;
function looksNew(released, added, bulk) {
  if (!released) return false;
  const days = bulk ? NEW_WINDOW_BULK : NEW_WINDOW;
  return released >= new Date(Date.parse(added) - days * 24 * HOUR).toISOString().slice(0, 10);
}

// Days since a YYYY-MM-DD date (0 = today).
const daysSince = (d) => Math.max(0, Math.round((Date.parse(today()) - Date.parse(d)) / (24 * HOUR)));

// Marks titles that arrived on this row's service in the last 7 days (m._newDays) for a "NEW"
// ribbon, if they look genuinely new (see looksNew). If the arrivals file isn't available,
// nothing is marked.
async function markNew(row, metas) {
  if (!row.service) return metas;
  try {
    const found = await justwatch.arrivalsByTitle(row.edition.region, [{ key: row.serviceKey, jw: row.service.jw }], row.type);
    const since = new Date(Date.now() - 6 * 24 * HOUR).toISOString().slice(0, 10);
    for (const m of metas) {
      const x = found.get(m._tmdb);
      if (!x || x.added < since) continue;
      if (!looksNew(m._date, x.added, x.bulk)) continue; // re-listed older title
      m._newDays = daysSince(x.added);
    }
  } catch {
    // no ribbons this time
  }
  return metas;
}

// -> { metas, partial }; partial = new arrivals should have been merged in but weren't ready yet.
async function getCatalog(type, id, extra, apiKey) {
  const row = ROW_BY_ID.get(id);
  if (!row || row.type !== type || !apiKey) return { metas: [], partial: false };
  if (row.dub) return getDubCatalog(row, extra, apiKey);
  if (row.newWeek) return getWeekCatalog(row, extra, apiKey);
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
  if (!arrivals || !arrivals.length) return { metas: (await markNew(row, listed)).map(clean), partial };

  const have = new Set(listed.map((x) => x._tmdb));
  let extra_ = arrivals.filter((a) => !have.has(a._tmdb));
  if (range) {
    extra_ = extra_.filter((a) => a._date >= range[0] && a._date <= range[1]);
    return { metas: (await markNew(row, [...extra_, ...listed])).map(clean), partial };
  }
  // Newest: slot arrivals into release-date order, but only those that belong on this first page.
  const full = listed.length >= PAGE_SIZE;
  const oldest = full ? listed[listed.length - 1]._date : '';
  extra_ = extra_.filter((a) => a._date >= oldest);
  const merged = [...listed, ...extra_].sort((a, b) => (a._date < b._date ? 1 : a._date > b._date ? -1 : 0));
  return { metas: (await markNew(row, merged)).map(clean), partial };
}

// Public address of this server, for badged poster links (Render sets RENDER_EXTERNAL_URL).
const BASE_URL = (process.env.PUBLIC_URL || process.env.RENDER_EXTERNAL_URL || '').replace(/\/$/, '');

// Rotten Tomatoes rarely reviews Indian films, so only English rows show it; Indian-language rows
// show IMDb alone, which keeps them uniform (and saves MDBList lookups).
const showsRottenTomatoes = (row) => !!row && row.edition.lang === 'en';

// Adds ratings: a badge on the poster, a line at the top of the description, and Stremio's
// imdbRating field. With withRt, Rotten Tomatoes too (titles without a known score are queued for
// lookup). meta._services (rows that mix services) adds a service tag to the poster.
function withRatings({ _services, _newDays, _banner, ...meta }, withRt) {
  const isImdb = /^tt\d+$/.test(meta.id);
  const imdb = isImdb ? imdbRatings.get(meta.id) : null;
  const rt = isImdb && withRt ? mdblist.rt(meta.type, meta.id) : null;
  const rtScore = typeof rt === 'number' ? rt : null;
  const services = _services || [];
  const line = [imdb != null && `IMDb ${imdb.toFixed(1)}`, rtScore != null && `Rotten Tomatoes ${rtScore}%`].filter(Boolean).join(' · ');
  const out = {
    ...meta,
    imdbRating: imdb != null ? imdb.toFixed(1) : undefined,
    description: !line ? meta.description : meta.description ? `${line}\n\n${meta.description}` : line,
  };
  // Wide "hero" banners (banner.js) are switched off: New This Week uses posters like the other
  // rows. To bring them back, set m._banner in weekList and use banner.bannerUrl here.
  if (isImdb) {
    out.poster = poster.posterUrl(BASE_URL, meta.id, meta.poster, imdb, rtScore, services, _newDays ?? null);
  }
  return out;
}

builder.defineCatalogHandler(async ({ type, id, extra, config }) => {
  try {
    const { metas, partial } = await getCatalog(type, id, extra, keyFrom(config));
    const withRt = showsRottenTomatoes(ROW_BY_ID.get(id));
    const rated = metas.map((m) => withRatings(m, withRt));
    // If new arrivals weren't ready, ask Stremio to check back in 2 minutes instead of keeping
    // this incomplete row for half an hour.
    if (partial) return { metas: rated, cacheMaxAge: 120 };
    // Short caching so changes (new arrivals, new poster designs) reach the apps within ~30 minutes.
    return { metas: rated, cacheMaxAge: 900, staleRevalidate: 900, staleError: 7 * 24 * 3600 };
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

// ---------------------------------------------------------------------------------------------
// "Dubbed" rows: films originally in other languages (e.g. Malayalam, Hindi) that have an audio
// track in the row's language (e.g. Tamil) on one of the row's services. The list comes from
// JustWatch (dubs.js); each film's original language, date and popularity from TMDB. The whole
// row is built here, sorted, and handed to Stremio a page at a time.
// ---------------------------------------------------------------------------------------------
const DUB_PAGE = 40;
const LANG_NAMES = { ta: 'Tamil', te: 'Telugu', ml: 'Malayalam', hi: 'Hindi', kn: 'Kannada' };
const dubStats = new Map();

function dubList(row, apiKey) {
  return cached(`dub-list:${row.id}`, 3 * HOUR, async () => {
    const e = row.edition;
    const services = e.services.map((key) => ({ key, jw: SERVICES[key][e.region].jw }));
    const found = await dubs.films(e.region, e.audio, services);
    let failed = 0;
    const metas = await Promise.all(
      [...found].map(async ([tmdbId, info]) => {
        try {
          const d = await tmdb.details('movie', tmdbId, apiKey);
          if (!e.originalLangs.includes(d.original_language) || !dateOf(d) || dateOf(d) > today()) return null;
          const m = await toMeta(d, 'movie', apiKey, info.imdbId);
          const keys = e.services.filter((k) => info.services.has(k));
          m.description = `${LANG_NAMES[e.audio] || e.audio} audio on ${keys.map((k) => SERVICES[k].name).join(', ')}.${m.description ? '\n\n' + m.description : ''}`;
          m._services = keys;
          m._pop = d.popularity || 0;
          m._vote = d.vote_count >= 10 ? d.vote_average || 0 : 0;
          return m;
        } catch (err) {
          if (!/ 404 /.test(err.message)) failed++;
          return null;
        }
      })
    );
    const list = metas.filter(Boolean);
    dubStats.set(row.id, { at: new Date().toISOString(), candidates: found.size, kept: list.length, failed });
    if (failed > found.size * 0.05) throw new Error(`${failed} of ${found.size} TMDB lookups failed for ${row.id}`);
    return list;
  });
}

async function getDubCatalog(row, extra, apiKey) {
  const choice = (extra && extra.genre) || 'Newest';
  const range = rangeOf(choice);
  const list = await within(8000, dubList(row, apiKey), null);
  if (!list) return { metas: [], partial: true };
  let items = range ? list.filter((m) => m._date >= range[0] && m._date <= range[1]) : list.slice();
  const byDate = (a, b) => (a._date < b._date ? 1 : a._date > b._date ? -1 : 0);
  if (choice === 'Popular' || range) items.sort((a, b) => b._pop - a._pop);
  else if (choice === 'Top rated') items = items.filter((m) => m._vote > 0).sort((a, b) => b._vote - a._vote);
  else items.sort(byDate);
  const skip = Number((extra && extra.skip) || 0);
  return {
    metas: items.slice(skip, skip + DUB_PAGE).map(({ _pop, _vote, ...m }) => clean(m)),
    partial: false,
  };
}

// ---------------------------------------------------------------------------------------------
// "New This Week" rows: titles in the row's language that arrived on any of its services in the
// last 7 days (from the new-arrivals file), most recent arrival first, if they look genuinely new
// (see looksNew).
// ---------------------------------------------------------------------------------------------
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const shortDate = (d) => `${Number(d.slice(8, 10))} ${MONTHS[Number(d.slice(5, 7)) - 1]}`;
const weekStats = new Map();

function weekList(row, apiKey) {
  return cached(`week:${row.id}`, 20 * 60 * 1000, async () => {
    const e = row.edition;
    const services = e.services.map((key) => ({ key, jw: SERVICES[key][e.region].jw }));
    const found = await justwatch.arrivalsByTitle(e.region, services, row.type);
    const since = new Date(Date.now() - 6 * 24 * HOUR).toISOString().slice(0, 10);
    let failed = 0;
    const seen = [];
    const metas = await Promise.all(
      [...found].filter(([, x]) => x.added >= since).map(async ([tmdbId, x]) => {
        try {
          const d = await tmdb.details(row.type, tmdbId, apiKey);
          const released = dateOf(d);
          if (d.original_language !== e.lang || !released || released > today()) return null;
          const ok = looksNew(released, x.added, x.bulk);
          seen.push({ title: d.title || d.name, released, added: x.added, bulk: x.bulk, services: [...x.services], kept: ok });
          if (!ok) return null;
          const m = await toMeta(d, row.type, apiKey, x.imdbId);
          const keys = e.services.filter((k) => x.services.has(k));
          m.description = `New on ${keys.map((k) => SERVICES[k].name).join(', ')} · ${shortDate(x.added)}${m.description ? '\n\n' + m.description : ''}`;
          m._services = keys;
          m._newDays = daysSince(x.added); // "NEW · 2d" ribbon
          m._added = x.added;
          m._pop = d.popularity || 0;
          return m;
        } catch (err) {
          if (!/ 404 /.test(err.message)) failed++;
          return null;
        }
      })
    );
    const list = metas.filter(Boolean).sort((a, b) => (a._added < b._added ? 1 : a._added > b._added ? -1 : b._pop - a._pop));
    weekStats.set(row.id, { at: new Date().toISOString(), candidates: found.size, kept: list.length, failed, titles: seen.sort((a, b) => (a.added < b.added ? 1 : -1)) });
    if (failed) throw new Error(`${failed} TMDB lookups failed for ${row.id}`);
    return list;
  });
}

async function getWeekCatalog(row, extra, apiKey) {
  if (Number((extra && extra.skip) || 0) > 0) return { metas: [], partial: false }; // one page
  const list = await within(8000, weekList(row, apiKey), null);
  if (!list) return { metas: [], partial: true };
  return { metas: list.map(({ _added, _pop, ...m }) => clean(m)), partial: false };
}

// Loads the first page of every row (default view) so rows open instantly. New arrivals are
// prepared first, and only for rows whose default view uses them (Newest), Indian rows first.
async function warmUp() {
  if (!ENV_KEY) return;
  const started = Date.now();
  for (const r of ROWS.filter((r) => r.newWeek)) await weekList(r, ENV_KEY).catch((e) => console.error('new this week:', e.message));
  for (const r of ROWS.filter((r) => r.dub)) await dubList(r, ENV_KEY).catch((e) => console.error('dubs:', e.message));
  for (const r of ROWS.filter((r) => !r.dub && !r.newWeek && (r.edition.defaultSort || 'Newest') === 'Newest')) {
    await recentArrivals(r, ENV_KEY).catch((e) => console.error('arrivals:', e.message));
  }
  const results = await Promise.allSettled(
    ROWS.map((r) => getCatalog(r.type, r.id, {}, ENV_KEY).then(({ metas }) => metas.map((m) => withRatings(m, showsRottenTomatoes(r))))) // also queues rating lookups
  );
  const ok = results.filter((r) => r.status === 'fulfilled').length;
  console.log(`warm-up: ${ok}/${results.length} rows loaded in ${((Date.now() - started) / 1000).toFixed(1)}s`);
}

module.exports = builder.getInterface();
module.exports.EDITIONS = TICK_BOXES;
// One line for the install page, e.g. "7 services · New This Week · Prime Video, aha, …"
module.exports.describe = (e) => {
  const names = e.services.map((k) => SERVICES[k].name).join(', ');
  if (e.audio) return `${e.originalLangs.map((l) => ({ ml: 'Malayalam', hi: 'Hindi', te: 'Telugu', kn: 'Kannada' }[l] || l)).join(' & ')} films with Tamil audio on ${names}`;
  const bits = [e.types.length === 1 ? 'Movies' : 'Movies & series'];
  if (e.newThisWeek) bits.push('New This Week');
  if (e.defaultSort === 'Popular') bits.push('popular first');
  return `${bits.join(' · ')} — ${names}`;
};
module.exports.weekStats = (id) => ({ row: weekStats.get(id) || 'not built yet', file: justwatch.status() });
module.exports.dubStats = (id) => ({ row: dubStats.get(id) || 'not built yet', file: dubs.status() });
module.exports.warmUp = warmUp;
module.exports.arrivalStats = (id) => ({ row: arrivalStats.get(id) || 'not checked yet', justwatch: justwatch.status() });
module.exports.manifestFor = manifestFor;
module.exports.languagesFrom = languagesFrom;
module.exports.chipsFrom = chipsFrom;
module.exports.chipsOf = chipsOf;
module.exports.hasServerKey = !!ENV_KEY;
