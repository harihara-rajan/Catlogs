const A = 'https://tamil-ott-catalogs.onrender.com';
const j = async (u) => (await fetch(A + u)).json();
(async () => {
  for (let i = 0; i < 16; i++) {
    let v = '?';
    try { v = (await j('/manifest.json')).version; } catch (e) { v = 'unreachable'; }
    console.log(new Date().toISOString().slice(11, 19), 'version', v);
    if (v === '1.8.1') break;
    await new Promise((r) => setTimeout(r, 15000));
  }
  await new Promise((r) => setTimeout(r, 40000)); // warm-up
  const cfg = '/' + encodeURIComponent(JSON.stringify({ languages: 'ta,ml,hi' }));
  const m = await j(cfg + '/manifest.json');
  console.log('first rows:', m.catalogs.slice(0, 6).map((c) => c.name + ' (' + c.type + ')').join(' | '));
  for (const [t, id] of [['movie', 'ta-new-movie'], ['series', 'ta-new-series'], ['movie', 'ml-new-movie'], ['movie', 'hi-new-movie']]) {
    const c = await j(`${cfg}/catalog/${t}/${id}.json`);
    console.log(`\n${id}: ${c.metas.length} titles`);
    for (const x of c.metas.slice(0, 6)) console.log('   ', x.releaseInfo, x.name, '|', (x.description || '').split('\n').filter(Boolean).slice(0, 2).join(' / ').slice(0, 110));
  }
})();
