const JW = 'https://apis.justwatch.com/graphql';
const gql = async (query, variables) => (await (await fetch(JW, { method: 'POST', headers: { 'content-type': 'application/json', 'user-agent': 'Mozilla/5.0' }, body: JSON.stringify({ query, variables }) })).json());
(async () => {
  const s = await gql(`query { popularTitles(country: IN, filter: { searchQuery: "Nooru Kodi Vaanavil" }, first: 1) { edges { node { content(country: IN, language: en) { title originalReleaseDate externalIds { tmdbId imdbId } } offers(country: IN, platform: WEB) { monetizationType dateCreated package { clearName } } } } } }`);
  const n = s.data.popularTitles.edges[0].node;
  console.log('NKV:', JSON.stringify(n));
  // How active is JustWatch's ZEE5 / Sun NXT tracking? Additions per day over the last 30 days.
  for (const p of ['zee', 'snx', 'snl']) {
    const counts = [];
    for (let i = 0; i < 30; i++) {
      const d = new Date(Date.now() - i * 864e5).toISOString().slice(0, 10);
      const r = await gql(`query($d: Date!, $p: [String!]) { newTitles(country: IN, date: $d, first: 1, filter: { packages: $p }, pageType: NEW, priceDrops: false) { totalCount } }`, { d, p: [p] });
      counts.push(r.data ? r.data.newTitles.totalCount : 'e');
    }
    console.log(p, counts.join(' '));
  }
  // Popular Tamil-looking titles on ZEE5 per JustWatch, to see if recent ones exist at all
  const z = await gql(`query { popularTitles(country: IN, filter: { packages: ["zee"], objectTypes: [MOVIE], releaseYear: { min: 2026 } }, first: 15, sortBy: RELEASE_YEAR) { totalCount edges { node { content(country: IN, language: en) { title originalReleaseDate } offers(country: IN, platform: WEB) { dateCreated package { technicalName } } } } } }`);
  console.log('ZEE5 2026 titles on JW:', z.data ? z.data.popularTitles.totalCount : JSON.stringify(z.errors));
  if (z.data) for (const e of z.data.popularTitles.edges) console.log('  ', e.node.content.originalReleaseDate, e.node.content.title, (e.node.offers.find((o) => o.package.technicalName === 'zee5') || {}).dateCreated);
})();
