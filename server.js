const express = require('express');
const { getRouter } = require('stremio-addon-sdk');
const addonInterface = require('./addon');
const configurePage = require('./configure');

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
      languages: addonInterface.EDITIONS,
      selected: addonInterface.languagesFrom(config),
      needsKey: !addonInterface.hasServerKey,
      version: addonInterface.manifest.version,
    })
  );
}
app.get('/', (_, res) => res.redirect('/configure'));
app.get('/configure', sendConfigure);
app.get('/:config/configure', sendConfigure);

// Catalogs and details: the SDK's own routes.
app.use(getRouter(addonInterface));

app.listen(port, () => console.log(`addon running: http://127.0.0.1:${port}/configure`));

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
