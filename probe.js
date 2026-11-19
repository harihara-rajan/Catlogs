const A = 'https://tamil-ott-catalogs.onrender.com';
(async () => {
  const w = await (await fetch(`${A}/debug/week/ml-new-movie`)).json();
  for (const x of w.row.titles || []) console.log(`T ${x.kept ? 'KEEP' : 'drop'} ${x.title} rel ${x.released} added ${x.added}${x.bulk ? ' bulk' : ''} ${x.services.join(',')} [${x.by}]`);
  const KEY = process.env.TMDB_API_KEY;
  for (const q of ['Bandra', 'The Third Murder']) {
    const u = new URL('https://api.themoviedb.org/3/search/movie'); u.searchParams.set('query', q);
    const h = {}; if (KEY.startsWith('eyJ')) h.Authorization = `Bearer ${KEY}`; else u.searchParams.set('api_key', KEY);
    const r = await (await fetch(u, { headers: h })).json();
    for (const m of (r.results || []).filter((m) => m.original_language === 'ml').slice(0, 3)) {
      const p = new URL(`https://api.themoviedb.org/3/movie/${m.id}/watch/providers`); if (!KEY.startsWith('eyJ')) p.searchParams.set('api_key', KEY);
      const pr = await (await fetch(p, { headers: h })).json();
      const inn = (pr.results && pr.results.IN) || {};
      console.log(`S ${q} -> ${m.title} ${m.release_date} id=${m.id} poster=${!!m.poster_path} IN: ${[...(inn.flatrate || []), ...(inn.ads || []), ...(inn.free || [])].map((x) => x.provider_name).join(',') || '-'}`);
    }
  }
})();
