const A = 'https://tamil-ott-catalogs.onrender.com';
(async () => {
  const c = await (await fetch(`${A}/catalog/series/ta-sonyliv-series.json`)).json();
  console.log('ROW', c.metas.length, c.metas.map((m) => `${m.name} (${m.releaseInfo})`).join(' | '));
})();
