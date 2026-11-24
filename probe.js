const A = 'https://tamil-ott-catalogs.onrender.com';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const show = (m) => `${m.name} (${m.releaseInfo}) [${(/\/poster\/[^/]+\/[^/]+\/([^/]+)\//.exec(m.poster || '') || [])[1] || '-'}]${/[?&]n=\d/.test(m.poster || '') ? ' NEW' : ''}`;
(async () => {
  for (let i = 0; i < 18; i++) {
    try { const m = await (await fetch(`${A}/manifest.json?x=${Date.now()}`)).json(); if (m.version === '2.9.0') { console.log('live', m.version); break; } } catch (e) {}
    await sleep(10000);
  }
  for (const [t, g] of [['movie', ''], ['series', ''], ['series', 'Popular'], ['movie', 'Netflix']]) {
    const url = `${A}/catalog/${t}/hi-${t}${g ? `/genre=${encodeURIComponent(g)}` : ''}.json`;
    let c; for (let i = 0; i < 6; i++) { c = await (await fetch(url)).json(); if (c.metas.length) break; await sleep(8000); }
    console.log(`ROW hi-${t} [${g || 'default'}] ${c.metas.length}: ${c.metas.slice(0, 12).map(show).join(' | ')}`);
  }
})();
