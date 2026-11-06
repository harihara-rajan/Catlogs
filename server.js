const { serveHTTP } = require('stremio-addon-sdk');
const addonInterface = require('./addon');

const port = Number(process.env.PORT) || 7000;
const MIN = 60 * 1000;

// Short cache on the manifest so a new version reaches browsers and Stremio quickly.
serveHTTP(addonInterface, { port, cacheMaxAge: 300 });

// Load every row once at start-up, then again every 2 hours, so the Board opens instantly.
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
