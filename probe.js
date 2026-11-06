const A = 'https://tamil-ott-catalogs.onrender.com';
const j = async (u) => (await fetch(A + u)).json();
(async () => {
  for (let i = 0; i < 16; i++) {
    let v = '?'; try { v = (await j('/manifest.json')).version; } catch { v = 'unreachable'; }
    console.log(new Date().toISOString().slice(11, 19), 'version', v);
    if (v === '1.9.0') break;
    await new Promise((r) => setTimeout(r, 15000));
  }
  await new Promise((r) => setTimeout(r, 45000));
  for (const [t, id] of [['movie', 'ta-new-movie'], ['movie', 'ta-dub-movie']]) {
    const c = await j(`/catalog/${t}/${id}.json`);
    console.log(`\n${id}: ${c.metas.length}`);
    for (const x of c.metas.slice(0, 5)) console.log('   ', x.name, '|', (x.poster || '').replace(A, ''));
    const p = c.metas.find((x) => (x.poster || '').includes('/poster/'));
    if (p) { const r = await fetch(p.poster); console.log('   poster:', r.status, r.headers.get('content-type')); }
  }
})();
