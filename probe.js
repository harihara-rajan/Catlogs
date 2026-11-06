const A = 'https://tamil-ott-catalogs.onrender.com';
(async () => {
  for (const id of ['ta-new-movie', 'ml-new-movie', 'hi-new-movie', 'ta-new-series']) {
    const t = id.endsWith('series') ? 'series' : 'movie';
    const c = await (await fetch(`${A}/catalog/${t}/${id}.json`)).json();
    console.log(id, c.metas.map((m) => (/v=(\d+)/.exec(m.poster) || [, 'plain'])[1]).join(','));
  }
  const m = await (await fetch(`${A}/manifest.json?x=${Date.now()}`)).json();
  console.log(m.version, m.catalogs.filter((c) => /new/.test(c.id)).map((c) => c.name).join(' | '));
})();
