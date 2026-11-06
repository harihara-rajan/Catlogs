const A = 'https://tamil-ott-catalogs.onrender.com';
const JW = 'https://apis.justwatch.com/graphql';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const PK = { 'Prime Video': 'prv', aha: 'aha', Netflix: 'nfx', SonyLIV: 'snl', 'Sun NXT': 'snx', JioHotstar: 'jhs', ZEE5: 'zee', ManoramaMAX: 'mrx' };
(async () => {
  const c = await (await fetch(`${A}/catalog/movie/ta-new-movie.json`)).json();
  console.log(c.metas.length, 'titles in New This Week · Tamil');
  for (const m of c.metas.slice(0, 18)) {
    const line = (m.description || '').split('\n').find((l) => l.startsWith('New on')) || '';
    const svc = line.replace(/^New on /, '').split(' · ')[0].split(', ');
    const q = `query($q: String!) { popularTitles(country: IN, filter: { searchQuery: $q, objectTypes: [MOVIE] }, first: 1) { edges { node { content(country: IN, language: en) { title originalReleaseYear externalIds { imdbId } } offers(country: IN, platform: WEB) { monetizationType presentationType dateCreated package { shortName } } } } } }`;
    const r = await (await fetch(JW, { method: 'POST', headers: { 'content-type': 'application/json', 'user-agent': 'Mozilla/5.0' }, body: JSON.stringify({ query: q, variables: { q: m.name } }) })).json();
    const n = r.data && r.data.popularTitles.edges[0] && r.data.popularTitles.edges[0].node;
    const pk = svc.map((s) => PK[s]).filter(Boolean);
    const offers = n ? n.offers.filter((o) => pk.includes(o.package.shortName)) : [];
    const first = offers.map((o) => o.dateCreated).sort()[0];
    console.log(`${m.name.slice(0, 26).padEnd(27)} ${m.releaseInfo} | addon: ${line.slice(0, 32).padEnd(32)} | JW first offer on that service: ${first || '?'} | offers: ${offers.map((o) => o.monetizationType + '/' + o.presentationType + '@' + (o.dateCreated || '').slice(0, 10)).join(' ')}`);
    await sleep(1200);
  }
})();
