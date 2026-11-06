const A = 'https://tamil-ott-catalogs.onrender.com';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  for (let i = 0; i < 40; i++) {
    try { const m = await (await fetch(`${A}/manifest.json?x=${Date.now()}`)).json(); if (m.version === '2.3.3') break; } catch (e) {}
    await sleep(15000);
  }
  let c; for (let i = 0; i < 20; i++) { c = await (await fetch(`${A}/catalog/movie/ta-new-movie.json`)).json(); if (c.metas.length) break; await sleep(15000); }
  const u = c.metas[0].poster; console.log(c.metas[0].name, u);
  const r = await fetch(u); const b = Buffer.from(await r.arrayBuffer()); console.log(r.status, b.length);
  const s = b.toString('base64'); for (let j = 0; j < s.length; j += 8000) console.log(`IMG0 ${s.slice(j, j + 8000)}`);
})();
