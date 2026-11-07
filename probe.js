const A = 'https://tamil-ott-catalogs.onrender.com';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  for (let i = 0; i < 40; i++) {
    try { const m = await (await fetch(`${A}/manifest.json?x=${Date.now()}`)).json(); if (m.version === '2.5.1') { console.log('live', m.version); break; } } catch (e) {}
    await sleep(15000);
  }
  await sleep(90000); // IMDb ratings load at start-up
  for (const id of ['ta-gems-movie', 'ml-gems-movie', 'hi-gems-movie', 'en-in-gems-movie', 'en-us-gems-movie']) {
    let c; for (let i = 0; i < 12; i++) { c = await (await fetch(`${A}/catalog/movie/${id}.json`)).json(); if (c.metas.length) break; await sleep(15000); }
    const g = await (await fetch(`${A}/debug/gems/${id}`)).json();
    console.log(`\n== ${id}: ${c.metas.length} shown; candidates ${g.row.candidates}, kept ${g.row.kept}`);
    for (const t of (g.row.titles || []).slice(0, 12)) console.log('  ' + t);
  }
  console.log('\nSTATUS', JSON.stringify(await (await fetch(`${A}/status`)).json()));
})();
