const A = 'https://tamil-ott-catalogs.onrender.com';
(async () => {
  for (const id of ['ta-new-movie', 'ta-prime-movie']) {
    const c = await (await fetch(`${A}/catalog/movie/${id}.json`)).json();
    console.log('ROW', id, c.metas.slice(0, 8).map((m) => m.name).join(' | '));
  }
})();
