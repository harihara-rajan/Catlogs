const A = 'https://tamil-ott-catalogs.onrender.com';
const enc = (o) => encodeURIComponent(JSON.stringify(o));
(async () => {
  const page = await (await fetch(`${A}/configure`)).text();
  console.log('configure page:', /OTT Catalogs/.test(page) && /name="lang"/.test(page) ? 'NEW' : 'OLD', (page.match(/v\d+\.\d+\.\d+/) || [])[0]);
  for (const cfg of [null, { languages: 'ta,ml,hi' }]) {
    const m = await (await fetch(`${A}${cfg ? '/' + enc(cfg) : ''}/manifest.json`)).json();
    console.log('manifest', m.version, '|', m.name, '|', m.catalogs.length, 'rows |', JSON.stringify(m).length, 'bytes');
  }
  await new Promise((r) => setTimeout(r, 20000)); // let warm-up finish
  const all = '/' + enc({ languages: 'ta,ml,hi' });
  for (const id of ['ml-manoramamax-movie', 'ml-netflix-movie', 'ml-jiohotstar-series', 'hi-netflix-movie', 'hi-prime-series', 'ml-sunnxt-movie', 'ta-sonyliv-movie']) {
    const type = id.endsWith('series') ? 'series' : 'movie';
    const t0 = Date.now();
    const c = await (await fetch(`${A}${all}/catalog/${type}/${id}.json`)).json();
    console.log(`\n${id} (${Date.now() - t0}ms, ${c.metas.length} items): ` + c.metas.slice(0, 7).map((x) => `${x.name} [${x.releaseInfo}]`).join(', '));
  }
})();
