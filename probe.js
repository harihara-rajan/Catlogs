const A = 'https://tamil-ott-catalogs.onrender.com';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  for (let i = 0; i < 40; i++) {
    try { const m = await (await fetch(`${A}/manifest.json?x=${Date.now()}`)).json(); if (m.version === '2.6.0') { console.log('live', m.version); break; } } catch (e) {}
    await sleep(15000);
  }
  for (const id of ['ta-sonyliv-series', 'ta-jiohotstar-series', 'ta-zee5-series', 'ta-sunnxt-series', 'hi-sonyliv-series']) {
    let c; for (let i = 0; i < 6; i++) { c = await (await fetch(`${A}/catalog/series/${id}.json`)).json(); if (c.metas.length) break; await sleep(10000); }
    await sleep(8000); c = await (await fetch(`${A}/catalog/series/${id}.json`)).json();
    console.log(`ROW ${id} ${c.metas.length}: ${c.metas.slice(0, 12).map((m) => `${m.name} (${m.releaseInfo})`).join(' | ')}`);
  }
})();
