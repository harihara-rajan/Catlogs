const A = 'https://tamil-ott-catalogs.onrender.com';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const show = (m) => `${m.name} (${m.releaseInfo}) [${(/\/poster\/[^/]+\/[^/]+\/([^/]+)\//.exec(m.poster || '') || [])[1] || '-'}]${/[?&]n=\d/.test(m.poster || '') ? ' NEW' : ''}`;
(async () => {
  for (let i = 0; i < 40; i++) {
    try { const m = await (await fetch(`${A}/manifest.json?x=${Date.now()}`)).json(); if (m.version === '2.8.0') { console.log('live', m.version); break; } } catch (e) {}
    await sleep(15000);
  }
  for (const g of ['', 'Popular', 'Top rated', 'aha', 'Netflix']) {
    const url = `${A}/catalog/movie/te-movie${g ? `/genre=${encodeURIComponent(g)}` : ''}.json`;
    let c; for (let i = 0; i < 10; i++) { c = await (await fetch(url)).json(); if (c.metas.length) break; await sleep(10000); }
    console.log(`\nROW te-movie [${g || 'default'}] ${c.metas.length}: ${c.metas.slice(0, 14).map(show).join(' | ')}`);
  }
  const p1 = await (await fetch(`${A}/catalog/movie/te-movie.json`)).json();
  const p2 = await (await fetch(`${A}/catalog/movie/te-movie/skip=${p1.metas.length}.json`)).json();
  const dup = p2.metas.filter((m) => p1.metas.some((x) => x.id === m.id)).length;
  console.log(`\nPAGE2 ${p2.metas.length} items, ${dup} repeated: ${p2.metas.slice(0, 5).map(show).join(' | ')}`);
})();
