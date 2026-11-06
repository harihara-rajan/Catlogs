const A = 'https://tamil-ott-catalogs.onrender.com';
const j = async (u) => (await fetch(A + u)).json();
(async () => {
  for (let i = 0; i < 20; i++) {
    let v = '?'; try { v = (await j('/manifest.json')).version; } catch { v = 'unreachable'; }
    if (v === '2.0.0') { console.log('live', v); break; }
    await new Promise((r) => setTimeout(r, 10000));
  }
  await new Promise((r) => setTimeout(r, 60000));
  const cfg = '/' + encodeURIComponent(JSON.stringify({ languages: 'ta,ml,hi' }));
  const m = await j(cfg + '/manifest.json');
  console.log('rows:', m.catalogs.slice(0, 7).map((c) => c.name).join(' | '), '| logo', (await fetch(m.logo)).status, '| bg', (await fetch(m.background)).status);
  const w = await j(`${cfg}/catalog/movie/ta-new-movie.json`);
  console.log(`\nNew This Week · Tamil: ${w.metas.length} items, shape ${w.metas[0] && w.metas[0].posterShape}`);
  for (const x of w.metas.slice(0, 3)) {
    const t0 = Date.now(); const r = await fetch(x.poster); const b = await r.arrayBuffer();
    console.log('   ', x.name, '|', x.poster.replace(A, ''), '|', r.status, b.byteLength, 'bytes,', Date.now() - t0, 'ms');
  }
  for (const id of ['ta-sonyliv-movie', 'ta-zee5-movie', 'hi-jiohotstar-movie']) {
    const c = await j(`${cfg}/catalog/movie/${id}.json`);
    const r = c.metas.filter((x) => /[?&]n=\d/.test(x.poster || ''));
    console.log(`${id}: NEW ribbons on ${r.length}: ${r.slice(0, 5).map((x) => x.name + ' (' + x.poster.match(/n=(\d+)/)[1] + 'd)').join(', ')}`);
    if (r[0]) { const rr = await fetch(r[0].poster); console.log('    ribbon poster', rr.status, rr.headers.get('content-type')); }
  }
})();
