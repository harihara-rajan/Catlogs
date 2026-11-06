const A = 'https://tamil-ott-catalogs.onrender.com';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  for (let i = 0; i < 40; i++) {
    try { const m = await (await fetch(`${A}/manifest.json?x=${Date.now()}`)).json(); console.log('version', m.version); if (m.version === '2.3.1') break; } catch (e) { console.log('wait', e.message); }
    await sleep(20000);
  }
  await sleep(30000);
  for (const id of ['ta-new-movie', 'ta-new-series', 'ml-new-movie', 'hi-new-movie']) {
    const type = id.endsWith('series') ? 'series' : 'movie';
    const c = await (await fetch(`${A}/catalog/${type}/${id}.json`)).json();
    console.log(`\n== ${id}: ${c.metas.length} titles`);
    for (const m of c.metas) {
      const line = (m.description || '').split('\n').find((l) => l.startsWith('New on')) || '';
      console.log(`${m.name.slice(0, 30).padEnd(31)} ${String(m.releaseInfo).padEnd(5)} ${line}`);
    }
  }
  const z = await (await fetch(`${A}/catalog/movie/ta-zee5-movie.json`)).json();
  console.log('\n== Tamil · ZEE5 first 20, NEW ribbons:', z.metas.slice(0, 20).filter((m) => /[?&]n=\d/.test(m.poster)).map((m) => m.name).join(', ') || 'none');
})();
