const A = 'https://tamil-ott-catalogs.onrender.com';
const JW = 'https://apis.justwatch.com/graphql';
(async () => {
  const q = `query { popularTitles(country: IN, filter: { searchQuery: "Meesaya Murukku 2" }, first: 1) { edges { node { content(country: IN, language: en) { title } offers(country: IN, platform: WEB) { monetizationType dateCreated package { clearName shortName } } } } } }`;
  const r = await (await fetch(JW, { method: 'POST', headers: { 'content-type': 'application/json', 'user-agent': 'Mozilla/5.0' }, body: JSON.stringify({ query: q }) })).json();
  console.log('JustWatch MM2 offers:', JSON.stringify(r.data.popularTitles.edges[0].node.offers.map((o) => `${o.package.shortName} ${o.monetizationType} ${o.dateCreated}`)));
  for (let i = 0; i < 2; i++) {
    const t0 = Date.now();
    const c = await (await fetch(`${A}/catalog/movie/ta-sonyliv-movie.json?n=${i}`)).json();
    const names = c.metas.map((x) => x.name);
    console.log(`row (${Date.now() - t0}ms): MM2 ${names.includes('Meesaya Murukku 2') ? 'PRESENT at #' + (names.indexOf('Meesaya Murukku 2') + 1) : 'MISSING'} | first: ${names.slice(0, 6).join(', ')}`);
    await new Promise((r) => setTimeout(r, 8000));
  }
})();
