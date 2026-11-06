(async () => {
  const q = `query { popularTitles(country: IN, filter: { searchQuery: "Meesaya Murukku 2" }, first: 1) { edges { node { content(country: IN, language: en) { title } offers(country: IN, platform: WEB) { monetizationType dateCreated package { clearName } } } } } }`;
  const r = await (await fetch('https://apis.justwatch.com/graphql', { method: 'POST', headers: { 'content-type': 'application/json', 'user-agent': 'Mozilla/5.0' }, body: JSON.stringify({ query: q }) })).json();
  const n = r.data.popularTitles.edges[0].node;
  console.log(new Date().toISOString(), n.content.title, JSON.stringify(n.offers.map((o) => `${o.package.clearName} ${o.monetizationType} ${o.dateCreated}`)));
})();
