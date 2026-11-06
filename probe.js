const A = 'https://tamil-ott-catalogs.onrender.com';
const j = async (u) => (await fetch(A + u)).json();
(async () => {
  console.log('version', (await j('/manifest.json')).version);
  await new Promise((r) => setTimeout(r, 45000)); // IMDb download + warm-up + some MDBList batches
  const d = await j('/debug/ratings/movie/tt38097205');
  console.log('MM2:', d.imdb, '|', d.rottenTomatoes);
  console.log('IMDb dataset:', JSON.stringify(d.imdbDataset));
  const m = d.mdblist; console.log('MDBList:', JSON.stringify({ enabled: m.enabled, known: m.known, queued: m.queued, requestsToday: m.requestsToday, paused: m.paused }));
  console.log('MDBList last response:', JSON.stringify(m.lastResponse));
  for (const [type, id] of [['movie', 'ta-sonyliv-movie'], ['movie', 'en-us-netflix-movie'], ['series', 'en-us-hbomax-series']]) {
    const c = await j(`/${encodeURIComponent(JSON.stringify({ languages: 'ta,en-us' }))}/catalog/${type}/${id}.json`);
    const badged = c.metas.filter((x) => (x.poster || '').includes('/poster/'));
    console.log(`\n${id}: ${c.metas.length} items, ${badged.length} badged`);
    for (const x of c.metas.slice(0, 4)) console.log('  ', x.name, '|', (x.description || '').split('\n')[0].slice(0, 60), '|', (x.poster || '').replace(A, ''));
    if (badged[0]) {
      const t0 = Date.now(); const r = await fetch(badged[0].poster); const b = await r.arrayBuffer();
      console.log(`  poster: ${r.status} ${r.headers.get('content-type')} ${b.byteLength} bytes in ${Date.now() - t0}ms`);
      require('fs').writeFileSync(`poster-${id}.jpg`, Buffer.from(b));
    }
  }
})();
