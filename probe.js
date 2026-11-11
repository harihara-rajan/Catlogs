const A = 'https://tamil-ott-catalogs.onrender.com';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const s = await (await fetch(`${A}/status`)).json();
  console.log('STATUS', JSON.stringify({ ok: s.ok, problems: s.problems, warnings: s.warnings, version: s.version, upSince: s.upSince, arrivals: s.arrivals, dubs: s.dubs, serviceRecord: s.serviceRecord, imdb: s.imdb && s.imdb.loadedAt, rt: s.rottenTomatoes && s.rottenTomatoes.requestsToday }));
  for (const id of ['ta-new-movie', 'ta-new-series', 'ml-new-movie', 'hi-new-movie']) {
    const t = id.endsWith('series') ? 'series' : 'movie';
    for (let i = 0; i < 10; i++) { const c = await (await fetch(`${A}/catalog/${t}/${id}.json`)).json(); if (c.metas.length || i > 3) break; await sleep(10000); }
    const w = await (await fetch(`${A}/debug/week/${id}`)).json();
    console.log(`\n== ${id}: kept ${w.row.kept}`);
    for (const x of w.row.titles || []) console.log(`${x.kept ? 'KEEP' : 'drop'} ${String(x.title).slice(0, 28).padEnd(29)} rel ${x.released} added ${x.added}${x.bulk ? ' (bulk)' : ''} ${x.services.join(',')} [${x.by}]`);
  }
})();
