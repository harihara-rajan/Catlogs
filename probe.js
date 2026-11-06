const A = 'https://tamil-ott-catalogs.onrender.com';
const CM = 'https://v3-cinemeta.strem.io/meta';
(async () => {
  const rows = ['ta-new-movie', 'ta-sonyliv-movie', 'ml-new-movie', 'ta-dub-movie'];
  const seen = new Set(); let n = 0, noCast = 0, noDir = 0, noMeta = 0; const missing = [];
  for (const id of rows) {
    const c = await (await fetch(`${A}/catalog/movie/${id}.json`)).json();
    for (const m of c.metas.slice(0, 15)) {
      if (seen.has(m.id) || !m.id.startsWith('tt')) continue; seen.add(m.id); n++;
      const r = await fetch(`${CM}/movie/${m.id}.json`); const j = await r.json().catch(() => ({}));
      const meta = j.meta;
      if (!meta || !meta.name) { noMeta++; missing.push(`${m.name} (no Cinemeta entry)`); continue; }
      const cast = (meta.cast || []).length || (meta.links || []).filter((l) => l.category === 'Cast').length;
      const dir = (meta.director || []).length || (meta.links || []).filter((l) => l.category === 'Directors').length;
      if (!cast) noCast++; if (!dir) noDir++;
      if (!cast || !dir) missing.push(`${m.name} [${m.releaseInfo}] cast:${cast} director:${dir}`);
    }
  }
  console.log(`checked ${n} films: no Cinemeta entry ${noMeta}, no cast ${noCast}, no director ${noDir}`);
  console.log(missing.slice(0, 15).join('\n'));
  const ok = await (await fetch(`${CM}/movie/tt15354916.json`)).json(); // Jawan, for comparison
  console.log('Jawan cast:', (ok.meta.cast || []).slice(0, 3).join(', '), '| director:', (ok.meta.director || []).join(', '));
})();
