const jw = require('./justwatch');
(async () => {
  const t0 = Date.now();
  for (const k of Object.keys(jw.PACKAGES)) for (const type of ['movie', 'series']) {
    const r = await jw.recent(k, type);
    console.log(k.padEnd(11), type.padEnd(6), String(r.length).padStart(4), r.slice(0, 4).map((x) => x.tmdbId + '/' + x.imdbId).join(' '));
  }
  console.log('total seconds', ((Date.now() - t0) / 1000).toFixed(1));
  const t1 = Date.now(); await jw.recent('prime', 'movie'); console.log('cached repeat ms', Date.now() - t1);
})();
