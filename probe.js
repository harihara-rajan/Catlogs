const A = 'https://tamil-ott-catalogs.onrender.com';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  for (let i = 0; i < 40; i++) {
    try { const m = await (await fetch(`${A}/manifest.json?x=${Date.now()}`)).json(); if (m.version === '2.3.5') { console.log('live', m.version); break; } } catch (e) {}
    await sleep(15000);
  }
  for (const id of ['ta-new-movie', 'ml-new-movie', 'hi-new-movie', 'ta-new-series']) {
    const t = id.endsWith('series') ? 'series' : 'movie';
    for (let i = 0; i < 20; i++) { const c = await (await fetch(`${A}/catalog/${t}/${id}.json`)).json(); if (c.metas.length) break; await sleep(10000); }
    const w = await (await fetch(`${A}/debug/week/${id}`)).json();
    console.log(`\n== ${id}: kept ${w.row.kept}`);
    for (const x of w.row.titles || []) console.log(`${x.kept ? 'KEEP' : 'drop'} ${String(x.title).slice(0, 28).padEnd(29)} released ${x.released} added ${x.added}${x.bulk ? ' (bulk)' : ''} ${x.services.join(',')}`);
  }
})();
