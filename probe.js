const JW = 'https://apis.justwatch.com/graphql';
(async () => {
  for (const c of ['IN', 'US', 'DK']) {
    const q = `query($q: String!) { popularTitles(country: ${c}, filter: { searchQuery: $q, objectTypes: [MOVIE] }, first: 1) { edges { node { content(country: ${c}, language: en) { title originalReleaseYear } offers(country: ${c}, platform: WEB) { monetizationType presentationType retailPrice(language: en) dateCreated package { clearName shortName } } } } } }`;
    const r = await (await fetch(JW, { method: 'POST', headers: { 'content-type': 'application/json', 'user-agent': 'Mozilla/5.0' }, body: JSON.stringify({ query: q, variables: { q: 'The Odyssey Nolan' } }) })).json();
    const n = r.data && r.data.popularTitles.edges[0] && r.data.popularTitles.edges[0].node;
    if (!n) { console.log('O', c, JSON.stringify(r).slice(0, 200)); continue; }
    console.log('O', c, n.content.title, n.content.originalReleaseYear, '|', [...new Set(n.offers.map((o) => `${o.package.clearName}:${o.monetizationType}${o.retailPrice ? ' ' + o.retailPrice : ''}@${(o.dateCreated || '').slice(0, 10)}`))].join(' ; '));
    await new Promise((s) => setTimeout(s, 2000));
  }
})();
