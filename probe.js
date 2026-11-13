const A = 'https://tamil-ott-catalogs.onrender.com';
(async () => {
  for (const id of ['ta-new-movie', 'ta-new-series']) {
    const t = id.endsWith('series') ? 'series' : 'movie';
    const c = await (await fetch(`${A}/catalog/${t}/${id}.json`)).json();
    console.log(`ROW ${id}: ` + c.metas.map((m) => `${m.name} [${m.id}] poster=${m.poster ? m.poster.slice(-50) : 'NONE'}`).join('\n   '));
    const w = await (await fetch(`${A}/debug/week/${id}`)).json();
    for (const x of w.row.titles || []) if (x.kept) console.log(`  KEEP ${x.title} rel ${x.released} added ${x.added} ${x.services.join(',')} [${x.by}]`);
  }
})();
