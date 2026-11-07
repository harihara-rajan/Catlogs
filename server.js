const express = require('express');
const { getRouter } = require('stremio-addon-sdk');
const addonInterface = require('./addon');
const configurePage = require('./configure');
const assets = require('./assets');
const poster = require('./poster');
const imdbRatings = require('./imdb-ratings');
const mdblist = require('./mdblist');

const port = Number(process.env.PORT) || 7000;
const MIN = 60 * 1000;

const app = express();

// Settings arrive as a JSON path segment: /{"languages":"ta,ml"}/manifest.json
function parseConfig(raw) {
  if (!raw) return {};
  try {
    const c = JSON.parse(raw);
    return c && typeof c === 'object' ? c : {};
  } catch {
    return {};
  }
}

// Manifest with only the chosen languages' rows. Cached for 5 minutes so updates arrive quickly.
function sendManifest(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'max-age=300, public');
  res.json(addonInterface.manifestFor(parseConfig(req.params.config)));
}
app.get('/manifest.json', sendManifest);
app.get('/:config/manifest.json', sendManifest);

// Install page (also opened by Stremio's "Configure" button, with the current settings).
function sendConfigure(req, res) {
  const config = parseConfig(req.params.config);
  res.setHeader('content-type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache');
  res.end(
    configurePage({
      languages: addonInterface.EDITIONS.map((e) => ({ code: e.code, name: e.name, desc: addonInterface.describe(e), chips: addonInterface.chipsOf(e) })),
      selected: addonInterface.languagesFrom(config),
      chips: Object.fromEntries(Object.entries(addonInterface.chipsFrom(config)).map(([k, v]) => [k, v ? [...v] : null])),
      needsKey: !addonInterface.hasServerKey,
      version: addonInterface.manifest.version,
    })
  );
}
app.get('/', (_, res) => res.redirect('/configure'));
app.get('/logo.png', assets.logoRoute);
app.get('/background.jpg', assets.backgroundRoute);
app.get('/configure', sendConfigure);
app.get('/:config/configure', sendConfigure);

// Posters with rating badges.
app.get('/poster/:tt/:ratings/:file', poster.handler);
app.get('/poster/:tt/:ratings/:services/:file', poster.handler);

// Wide banners for the New This Week rows.
app.get('/banner/:type/:tmdbId/:imdb/:services/:days.jpg', require('./banner').handler);

// What the server knows about a title's ratings, and the state of the rating sources.
app.get('/debug/ratings/:type/:tt', (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const rt = mdblist.rt(req.params.type, req.params.tt);
  res.json({
    imdb: imdbRatings.get(req.params.tt),
    rottenTomatoes: rt === undefined ? 'not looked up yet (queued)' : rt === null ? 'no Rotten Tomatoes score' : rt,
    imdbDataset: imdbRatings.status(),
    mdblist: mdblist.status(),
  });
});

// What the last new-arrivals check found for a row, e.g. /debug/arrivals/ta-sonyliv-movie
app.get('/debug/arrivals/:id', (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.json(addonInterface.arrivalStats(req.params.id));
});

// What the last build of a "New This Week" row found, e.g. /debug/week/ta-new-movie
app.get('/debug/week/:id', (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.json(addonInterface.weekStats(req.params.id));
});

// Health check: is everything the addon depends on fresh? { ok, problems, ... }. The GitHub job
// checks this after each run and fails (GitHub then emails) when something is wrong.
const justwatch = require('./justwatch');
const dubsData = require('./dubs');
const catalogueData = require('./catalogue');
const startedAt = Date.now();
const hoursSince = (iso) => (iso ? (Date.now() - Date.parse(iso)) / 3600000 : Infinity);
app.get('/status', async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const problems = [];
  const arrivals = await justwatch.file().catch((e) => ({ error: e.message }));
  const dubsFile = await dubsData.file().catch((e) => ({ error: e.message }));
  const cat = await catalogueData.file().catch((e) => ({ error: e.message }));
  const imdb = imdbRatings.status();
  if (!addonInterface.hasServerKey) problems.push('No TMDB key on Render (TMDB_API_KEY)');
  if (arrivals.error) problems.push(`New arrivals file unreadable: ${arrivals.error}`);
  else if (hoursSince(arrivals.generatedAt) > 24) problems.push(`New arrivals not updated for ${Math.round(hoursSince(arrivals.generatedAt))} h (GitHub job or JustWatch)`);
  if (dubsFile.error) problems.push(`Dubbed file unreadable: ${dubsFile.error}`);
  else if (hoursSince(dubsFile.generatedAt) > 72) problems.push(`Dubbed list not updated for ${Math.round(hoursSince(dubsFile.generatedAt))} h`);
  const warnings = [];
  if (!cat.scannedAt) warnings.push('No service record yet (TMDB_API_KEY secret on GitHub?): NEW uses the release-date rule');
  else if (hoursSince(cat.scannedAt) > 24) problems.push(`Service record not updated for ${Math.round(hoursSince(cat.scannedAt))} h`);
  if (!imdb.titles && Date.now() - startedAt > 10 * 60000) problems.push('IMDb ratings not loaded');
  res.json({
    ok: problems.length === 0,
    problems,
    warnings,
    version: addonInterface.manifest.version,
    upSince: new Date(startedAt).toISOString(),
    arrivals: arrivals.generatedAt || null,
    dubs: dubsFile.generatedAt || null,
    serviceRecord: cat.scannedAt || null,
    imdb,
    rottenTomatoes: mdblist.status(),
  });
});

// What the last build of a Hidden Gems row found, e.g. /debug/gems/ta-gems-movie
app.get('/debug/gems/:id', (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.json(addonInterface.gemsStats(req.params.id));
});

// What the last build of a dubbed row found, e.g. /debug/dubs/ta-dub-movie
app.get('/debug/dubs/:id', (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.json(addonInterface.dubStats(req.params.id));
});

// Catalogs and details: the SDK's own routes.
app.use(getRouter(addonInterface));

app.listen(port, () => console.log(`addon running: http://127.0.0.1:${port}/configure`));

imdbRatings.start();
mdblist.start();

// Load every row once at start-up, then again every 2 hours, so rows open instantly.
setTimeout(() => addonInterface.warmUp().catch((e) => console.error('warm-up failed:', e.message)), 2000);
setInterval(() => addonInterface.warmUp().catch((e) => console.error('warm-up failed:', e.message)), 120 * MIN);

// Render's free plan puts the server to sleep after 15 minutes without visitors, and waking it
// takes ~50 seconds. A visit to itself every 10 minutes keeps it awake. Render sets
// RENDER_EXTERNAL_URL automatically; set KEEP_AWAKE=0 to turn this off.
const selfUrl = process.env.RENDER_EXTERNAL_URL;
if (selfUrl && process.env.KEEP_AWAKE !== '0') {
  setInterval(() => {
    fetch(`${selfUrl}/manifest.json`, { signal: AbortSignal.timeout(30000) }).catch((e) =>
      console.error('keep-awake ping failed:', e.message)
    );
  }, 10 * MIN);
  console.log(`keep-awake: pinging ${selfUrl} every 10 minutes`);
}
