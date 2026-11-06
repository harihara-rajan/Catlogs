const A = 'https://tamil-ott-catalogs.onrender.com';
const fs = require('fs');
(async () => {
  const c = await (await fetch(`${A}/catalog/movie/ta-new-movie.json`)).json();
  const z = await (await fetch(`${A}/catalog/movie/ta-zee5-movie.json`)).json();
  const list = [...c.metas.slice(0, 2), ...z.metas.filter((m) => /[?&]n=\d/.test(m.poster)).slice(0, 1)];
  let i = 0;
  for (const m of list) {
    console.log(m.name, m.poster);
    const r = await fetch(m.poster);
    fs.writeFileSync(`poster-${i++}.jpg`, Buffer.from(await r.arrayBuffer()));
  }
})();
