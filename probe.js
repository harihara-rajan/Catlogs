const A = 'https://tamil-ott-catalogs.onrender.com';
const j = async (u) => (await fetch(A + u)).json();
(async () => {
  for (let i = 0; i < 16; i++) {
    let v = '?'; try { v = (await j('/manifest.json')).version; } catch { v = 'unreachable'; }
    if (v === '1.9.1') { console.log('live', v); break; }
    await new Promise((r) => setTimeout(r, 10000));
  }
  await new Promise((r) => setTimeout(r, 40000));
  for (const [t, id] of [['movie', 'ta-sonyliv-movie'], ['movie', 'ta-new-movie'], ['movie', 'en-us-netflix-movie']]) {
    const c = await j(`/catalog/${t}/${id}.json`);
    const codes = c.metas.map((m) => ((m.poster || '').match(/\/poster\/tt\d+\/([\dn]+-[\dn]+)/) || [])[1]).filter(Boolean);
    console.log(id.padEnd(20), c.metas.length, 'items | with RT on poster:', codes.filter((x) => !x.endsWith('-n')).length, '| e.g.', codes.slice(0, 4).join(' '));
  }
})();
