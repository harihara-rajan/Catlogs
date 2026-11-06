const A = 'https://tamil-ott-catalogs.onrender.com';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  for (let i = 0; i < 40; i++) {
    try { const m = await (await fetch(`${A}/manifest.json?x=${Date.now()}`)).json(); if (m.version === '2.3.4') { console.log('live', m.version); break; } } catch (e) {}
    await sleep(15000);
  }
  for (const id of ['ta-new-movie', 'ml-new-movie']) {
    let c; for (let i = 0; i < 20; i++) { c = await (await fetch(`${A}/catalog/movie/${id}.json`)).json(); if (c.metas.length) break; await sleep(15000); }
    const u = c.metas[0].poster; const r = await fetch(u);
    console.log(id, (/v=(\d+)/.exec(u) || [])[1], r.status, r.headers.get('content-length'));
  }
})();
