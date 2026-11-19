const A = 'https://tamil-ott-catalogs.onrender.com';
(async () => {
  const c = await (await fetch(`${A}/catalog/movie/en-new-movie.json`)).json();
  for (const m of c.metas.filter((m) => !m.imdbRating)) {
    const r = await (await fetch(`${A}/debug/ratings/movie/${m.id}`)).json();
    console.log(`R ${m.name} ${m.id} ${JSON.stringify(r).slice(0, 300)}`);
  }
})();
