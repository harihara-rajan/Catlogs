const A = 'https://tamil-ott-catalogs.onrender.com';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  for (let i = 0; i < 40; i++) {
    try { const m = await (await fetch(`${A}/manifest.json?x=${Date.now()}`)).json(); if (m.version === '2.6.1') { console.log('live', m.version); break; } } catch (e) {}
    await sleep(15000);
  }
  for (const id of ['ta-new-movie', 'ta-new-series', 'ml-new-movie', 'hi-new-movie']) {
    const t = id.endsWith('series') ? 'series' : 'movie';
    let c; for (let i = 0; i < 10; i++) { c = await (await fetch(`${A}/catalog/${t}/${id}.json`)).json(); if (c.metas.length) break; await sleep(10000); }
    console.log(`ROW ${id}: ${c.metas.map((m) => `${m.name} (${m.releaseInfo})`).join(' | ')}`);
  }
})();
