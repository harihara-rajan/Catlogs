const JW = 'https://apis.justwatch.com/graphql';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function q(query, variables = {}) {
  for (let i = 0; i < 3; i++) {
    const r = await fetch(JW, { method: 'POST', headers: { 'content-type': 'application/json', 'user-agent': 'Mozilla/5.0' }, body: JSON.stringify({ query, variables }) });
    if (r.status === 429) { await sleep(20000); continue; }
    const j = await r.json(); await sleep(2200); return j;
  }
}
const FIND = `query($q: String!) { popularTitles(country: IN, filter: { searchQuery: $q, objectTypes: [MOVIE] }, first: 1) { edges { node { id content(country: IN, language: en) { title originalReleaseDate externalIds { tmdbId } } offers(country: IN, platform: WEB) { monetizationType dateCreated package { shortName } } } } } }`;
(async () => {
  const ids = {};
  for (const name of ['Hi :)', 'Nooru Kodi Vaanavil', 'Meesaya Murukku 2', 'All Pass']) {
    const r = await q(FIND, { q: name });
    const n = r.data.popularTitles.edges[0].node; ids[n.content.externalIds.tmdbId] = n.content.title;
    console.log(n.content.title, n.content.originalReleaseDate, n.content.externalIds.tmdbId, n.offers.map((o) => `${o.package.shortName}/${o.monetizationType}@${o.dateCreated}`).join(' '));
  }
  // Does JustWatch's "new on ZEE5" for past days still list titles it re-dated on 6 Nov?
  const day = (d) => new Date(Date.parse('2026-11-06') - d * 864e5).toISOString().slice(0, 10);
  for (const d of [1, 3, 7, 14, 21, 30, 45, 60, 75, 90, 120]) {
    const date = day(d);
    const r = await q(`query($d: Date!) { newTitles(country: IN, date: $d, first: 100, filter: { packages: ["zee","aha","snl","jhs","prv","nfx","snx"] }) { totalCount edges { node { ... on Movie { content(country: IN, language: en) { title externalIds { tmdbId } } } } newOffer(platform: WEB) { package { shortName } } } } }`, { d: date });
    if (!r.data) { console.log(date, JSON.stringify(r).slice(0, 300)); continue; }
    const nt = r.data.newTitles;
    const per = {}; nt.edges.forEach((e) => { const p = e.newOffer && e.newOffer.package.shortName; per[p] = (per[p] || 0) + 1; });
    const hits = nt.edges.filter((e) => e.node.content && ids[e.node.content.externalIds.tmdbId]).map((e) => e.node.content.title + '@' + (e.newOffer && e.newOffer.package.shortName));
    console.log(date, 'total', nt.totalCount, JSON.stringify(per), hits.length ? 'HITS ' + hits.join(', ') : '');
  }
})();
