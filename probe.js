const A = 'https://tamil-ott-catalogs.onrender.com';
const j = async (u) => (await fetch(A + u)).json();
(async () => {
  console.log('version', (await j('/manifest.json')).version);
  for (let i = 0; i < 6; i++) {
    const st = await j('/debug/arrivals/ta-sonyliv-movie');
    const r = await fetch(`${A}/catalog/movie/ta-sonyliv-movie.json`);
    const c = await r.json();
    const names = c.metas.map((x) => x.name);
    const pos = names.indexOf('Meesaya Murukku 2');
    console.log(new Date().toISOString().slice(11, 19), '| arrivals:', JSON.stringify(st).slice(0, 260), '| row:', pos >= 0 ? `MM2 at #${pos + 1}` : 'MM2 missing', '|', r.headers.get('cache-control'), '| top:', names.slice(0, 3).join(', '));
    if (pos >= 0) {
      const m = c.metas[pos]; console.log('   MM2 meta:', m.description.split('\n')[0], '|', m.poster.replace(A, ''));
      break;
    }
    await new Promise((r) => setTimeout(r, 20000));
  }
  const z = await j('/debug/arrivals/zee5-x'); 
  for (const id of ['ml-netflix-movie', 'hi-netflix-movie', 'ta-zee5-movie']) console.log(id, JSON.stringify(await j('/debug/arrivals/' + id)).slice(0, 200));
})();
