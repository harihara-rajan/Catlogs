const CM = 'https://v3-cinemeta.strem.io';
const A = 'https://tamil-ott-catalogs.onrender.com';
(async () => {
  const ids = [['tt15354916', 'Jawan'], ['tt39089210', 'All Pass'], ['tt38097205', 'Meesaya Murukku 2']];
  const c = await (await fetch(`${A}/catalog/movie/ta-sonyliv-movie.json`)).json();
  for (const m of c.metas.slice(0, 12)) ids.push([m.id, m.name]);
  let withLinks = 0, legacyOnly = 0, none = 0;
  for (const [id, name] of ids) {
    const m = (await (await fetch(`${CM}/meta/movie/${id}.json`)).json()).meta || {};
    const links = (m.links || []).filter((l) => ['Cast', 'Directors', 'Writers'].includes(l.category)).length;
    const legacy = (m.cast || []).length + (m.director || []).length;
    if (links) withLinks++; else if (legacy) legacyOnly++; else none++;
    console.log(name.slice(0, 26).padEnd(27), 'links(cast/dir):', String(links).padStart(2), '| cast/director fields:', legacy, '| link categories:', [...new Set((m.links || []).map((l) => l.category))].join(','));
  }
  console.log(`\nwith links ${withLinks}, only old cast/director fields ${legacyOnly}, nothing ${none}`);
})();
