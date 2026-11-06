const A = 'https://tamil-ott-catalogs.onrender.com';
(async () => {
  for (let i = 0; i < 18; i++) {
    try {
      const m = await (await fetch(`${A}/manifest.json`)).json();
      console.log(new Date().toISOString().slice(11, 19), 'version', m.version);
      if (m.version === '1.2.0') {
        await new Promise((r) => setTimeout(r, 30000)); // let warm-up finish
        for (const id of ['ta-sonyliv-movie', 'ta-netflix-movie']) {
          const t0 = Date.now();
          const c = await (await fetch(`${A}/catalog/movie/${id}.json`)).json();
          console.log(`\n${id} (${Date.now() - t0}ms):\n` + c.metas.slice(0, 12).map((x) => `  ${x.releaseInfo} ${x.name}`).join('\n'));
        }
        return;
      }
    } catch (e) { console.log('err', e.message); }
    await new Promise((r) => setTimeout(r, 10000));
  }
})();
