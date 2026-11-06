const JW = 'https://apis.justwatch.com/graphql';
(async () => {
  const q = `query($d: Date!, $p: [String!]) { newTitles(country: IN, date: $d, first: 8, filter: { packages: $p }, pageType: NEW, priceDrops: false) {
    totalCount pageInfo { hasNextPage }
    edges { newOffer(platform: WEB) { package { shortName } monetizationType } node { objectType content(country: IN, language: en) { title externalIds { tmdbId } } } } } }`;
  const r = await fetch(JW, { method: 'POST', headers: { 'content-type': 'application/json', 'user-agent': 'Mozilla/5.0' }, body: JSON.stringify({ query: q, variables: { d: new Date().toISOString().slice(0, 10), p: ['prv', 'aha', 'nfx', 'snl', 'snx', 'jhs', 'zee', 'mrx'] } }) });
  const t = await r.text();
  console.log(r.status, t.slice(0, 1500));
})();
