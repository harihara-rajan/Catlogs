const A = 'https://tamil-ott-catalogs.onrender.com';
const CM = 'https://v3-cinemeta.strem.io';
(async () => {
  const c = await (await fetch(`${A}/catalog/movie/ta-prime-movie.json`)).json();
  const ap = c.metas.find((m) => /all pass/i.test(m.name));
  console.log('All Pass in Prime Tamil row:', ap ? `${ap.id} ${ap.releaseInfo}` : 'not on page 1');
  const s = await (await fetch(`${CM}/catalog/movie/top/search=All%20Pass.json`)).json();
  console.log('Cinemeta search:', (s.metas || []).slice(0, 4).map((m) => `${m.id} ${m.name} ${m.releaseInfo}`).join(' | '));
  const id = ap ? ap.id : (s.metas[0] || {}).id;
  if (id) {
    const m = (await (await fetch(`${CM}/meta/movie/${id}.json`)).json()).meta || {};
    console.log(id, '-> name', m.name, '| cast', JSON.stringify(m.cast), '| director', JSON.stringify(m.director), '| links', (m.links || []).map((l) => l.category + ':' + l.name).slice(0, 6).join(', '), '| runtime', m.runtime, '| imdbRating', m.imdbRating);
  }
})();
