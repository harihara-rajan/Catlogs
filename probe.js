const A = 'https://tamil-ott-catalogs.onrender.com';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  for (let i = 0; i < 40; i++) {
    try { const m = await (await fetch(`${A}/manifest.json?x=${Date.now()}`)).json(); if (m.version === '2.7.3') { console.log('live', m.version); break; } } catch (e) {}
    await sleep(15000);
  }
  for (const id of ['en-us-netflix-movie', 'en-in-prime-movie', 'en-new-movie']) {
    let c; for (let i = 0; i < 10; i++) { c = await (await fetch(`${A}/catalog/movie/${id}.json`)).json(); if (c.metas.length) break; await sleep(10000); }
    console.log(`ROW ${id}: ${c.metas.slice(0, 8).map((m) => `${m.name} (${m.releaseInfo})`).join(' | ')}`);
  }
})();
