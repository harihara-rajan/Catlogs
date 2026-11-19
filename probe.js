const A = 'https://tamil-ott-catalogs.onrender.com';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  for (let i = 0; i < 40; i++) {
    try { const m = await (await fetch(`${A}/manifest.json?x=${Date.now()}`)).json(); if (m.version === '2.7.1') { console.log('live', m.version); break; } } catch (e) {}
    await sleep(15000);
  }
  for (const [t, id] of [['movie', 'en-new-movie'], ['series', 'en-new-series'], ['series', 'ta-new-series'], ['series', 'hi-new-series']]) {
    let c; for (let i = 0; i < 15; i++) { c = await (await fetch(`${A}/catalog/${t}/${id}.json`)).json(); if (c.metas.length) break; await sleep(10000); }
    const w = await (await fetch(`${A}/debug/week/${id}`)).json();
    console.log(`\nROW ${id}: ${c.metas.length} (candidates ${w.row.candidates})`);
    for (const m of c.metas.slice(0, 20)) console.log(`  ${m.name} (${m.releaseInfo}) ${m.imdbRating || '-'} | ${(m.description || '').split('\n').find((l) => / new on |^New on/.test(l)) || ''}`);
  }
})();
