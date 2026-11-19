const A = 'https://tamil-ott-catalogs.onrender.com';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  let s; for (let i = 0; i < 6; i++) { try { s = await (await fetch(`${A}/status`)).json(); break; } catch (e) { await sleep(15000); } }
  console.log('STATUS', JSON.stringify({ ok: s.ok, problems: s.problems, warnings: s.warnings, version: s.version, upSince: s.upSince, arrivals: s.arrivals, dubs: s.dubs, serviceRecord: s.serviceRecord }));
  for (const id of ['ta-new-movie', 'ta-new-series', 'ml-new-movie', 'hi-new-movie']) {
    const t = id.endsWith('series') ? 'series' : 'movie';
    let c; for (let i = 0; i < 8; i++) { c = await (await fetch(`${A}/catalog/${t}/${id}.json`)).json(); if (c.metas.length || i > 3) break; await sleep(10000); }
    const w = await (await fetch(`${A}/debug/week/${id}`)).json();
    console.log(`ROW ${id}: ${c.metas.map((m) => `${m.name} (${m.releaseInfo})`).join(' | ')}`);
    for (const x of w.row.titles || []) if (x.kept) console.log(`  KEEP ${x.title} rel ${x.released} added ${x.added} ${x.services.join(',')} [${x.by}]`);
  }
})();
