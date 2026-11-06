const JW = 'https://apis.justwatch.com/graphql';
const gql = async (query, variables) => { const r = await fetch(JW, { method: 'POST', headers: { 'content-type': 'application/json', 'user-agent': 'Mozilla/5.0' }, body: JSON.stringify({ query, variables }) }); return r.json(); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  for (const p of ['nfx', 'prv', 'jhs', 'snl', 'zee', 'aha', 'snx', 'mrx']) {
    const r = await gql(`query($p: [String!]) { popularTitles(country: IN, filter: { packages: $p, objectTypes: [MOVIE] }, first: 100, sortBy: POPULAR) { totalCount edges { node { content(country: IN, language: en) { title } offers(country: IN, platform: WEB, filter: { packages: $p }) { monetizationType audioLanguages } } } } }`, { p: [p] });
    if (r.errors) { console.log(p, 'ERR', JSON.stringify(r.errors).slice(0, 200)); await sleep(2000); continue; }
    const e = r.data.popularTitles.edges;
    const sub = e.map((x) => x.node.offers.filter((o) => ['FLATRATE', 'ADS', 'FREE'].includes(o.monetizationType)));
    const withAudio = sub.filter((os) => os.some((o) => o.audioLanguages && o.audioLanguages.length)).length;
    const withTa = e.filter((x, i) => sub[i].some((o) => (o.audioLanguages || []).includes('ta')));
    console.log(p.padEnd(4), 'catalogue', String(r.data.popularTitles.totalCount).padStart(6), '| top 100: audio listed for', String(withAudio).padStart(3), '| with Tamil audio', String(withTa.length).padStart(3), '|', withTa.slice(0, 5).map((x) => x.node.content.title).join(', '));
    await sleep(2000);
  }
})();
