const JW = 'https://apis.justwatch.com/graphql';
const gql = async (query, variables) => { const r = await fetch(JW, { method: 'POST', headers: { 'content-type': 'application/json', 'user-agent': 'Mozilla/5.0' }, body: JSON.stringify({ query, variables }) }); return r.json(); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  // 1. Do offers carry audio languages? Known Hindi films with Tamil dubs.
  for (const q of ['Jawan', 'Animal', 'Manjummel Boys', 'Aavesham']) {
    const r = await gql(`query($q: String!) { popularTitles(country: IN, filter: { searchQuery: $q, objectTypes: [MOVIE] }, first: 1) { edges { node { content(country: IN, language: en) { title originalReleaseYear } offers(country: IN, platform: WEB) { monetizationType audioLanguages subtitleLanguages package { shortName } } } } } }`, { q });
    if (r.errors) { console.log(q, 'ERR', JSON.stringify(r.errors).slice(0, 300)); continue; }
    const n = r.data.popularTitles.edges[0].node;
    console.log(n.content.title, n.content.originalReleaseYear, '->', n.offers.filter((o) => o.monetizationType !== 'RENT' && o.monetizationType !== 'BUY').map((o) => `${o.package.shortName}:${JSON.stringify(o.audioLanguages)}`).join(' '));
    await sleep(1500);
  }
  // 2. Can the title filter select by audio language? (error messages hint at valid fields)
  for (const f of ['audioLanguages: ["ta"]', 'languages: ["ta"]', 'originalLanguage: "ml"', 'originalLanguages: ["ml"]', 'audioLanguage: "ta"']) {
    const r = await gql(`query { popularTitles(country: IN, filter: { ${f}, packages: ["nfx"], objectTypes: [MOVIE] }, first: 3) { totalCount edges { node { content(country: IN, language: en) { title } } } } }`);
    console.log('filter', f, '->', r.errors ? 'ERR ' + r.errors.map((e) => e.message).join(' ').slice(0, 200) : `total ${r.data.popularTitles.totalCount}: ` + r.data.popularTitles.edges.map((e) => e.node.content.title).join(', '));
    await sleep(1500);
  }
  // 3. Content field for original language?
  const r = await gql(`query { popularTitles(country: IN, filter: { searchQuery: "Jawan" }, first: 1) { edges { node { content(country: IN, language: en) { title originalLanguage } } } } }`);
  console.log('content.originalLanguage ->', JSON.stringify(r).slice(0, 300));
})();
