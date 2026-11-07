const A = 'https://tamil-ott-catalogs.onrender.com';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  for (let i = 0; i < 40; i++) {
    try { const m = await (await fetch(`${A}/manifest.json?x=${Date.now()}`)).json(); if (m.version === '2.4.1') { console.log('live', m.version, m.catalogs.slice(-2).map((c) => c.id)); break; } } catch (e) {}
    await sleep(15000);
  }
  await sleep(60000); // ratings file loads at start-up
  for (const [t, q] of [['movie', 'karaah'], ['movie', 'meesaya murukku'], ['series', 'the court'], ['movie', 'kara']]) {
    const r = await (await fetch(`${A}/catalog/${t}/search-${t}/search=${encodeURIComponent(q)}.json`)).json();
    console.log(`\n== ${t} "${q}": ${r.metas.length}`);
    for (const m of r.metas.slice(0, 6)) console.log(`${m.name.slice(0, 28).padEnd(29)} ${m.releaseInfo} ${m.imdbRating || '-'} | ${m.description.split('\n')[0].slice(0, 60)} | ${m.poster.replace(A, '').slice(0, 60)}`);
  }
  const r = await (await fetch(`${A}/catalog/movie/search-movie/search=karaah.json`)).json();
  const p = r.metas.find((m) => m.poster.startsWith(A));
  if (p) { const res = await fetch(p.poster); console.log('poster', res.status, res.headers.get('content-type')); }
})();
