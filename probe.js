const A = 'https://tamil-ott-catalogs.onrender.com';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  for (let i = 0; i < 40; i++) {
    try { const m = await (await fetch(`${A}/manifest.json?x=${Date.now()}`)).json(); if (m.version === '2.7.0') { console.log('live', m.version); break; } } catch (e) {}
    await sleep(15000);
  }
  await sleep(30000);
  for (const [t, id] of [['movie', 'en-new-movie'], ['series', 'en-new-series'], ['movie', 'ta-new-movie']]) {
    let c; for (let i = 0; i < 12; i++) { c = await (await fetch(`${A}/catalog/${t}/${id}.json`)).json(); if (c.metas.length) break; await sleep(10000); }
    console.log(`\nROW ${id}: ${c.metas.length}`);
    for (const m of c.metas.slice(0, 25)) console.log(`  ${m.name} (${m.releaseInfo}) ${m.imdbRating || '-'} | ${(m.description || '').split('\n').find((l) => l.startsWith('New on')) || ''}`);
    const w = await (await fetch(`${A}/debug/week/${id}`)).json();
    if (w.row && w.row.titles) console.log(`  candidates ${w.row.candidates}, judged ${w.row.titles.length}, kept ${w.row.kept}`);
  }
})();
