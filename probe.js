const JW = 'https://apis.justwatch.com/graphql';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  for (const [p, min, max] of [['prv', 2024, 2026], ['prv', 2020, 2023], ['prv', 2010, 2019], ['prv', 1900, 2009], ['jhs', 1900, 2009], ['zee', 2015, 2026]]) {
    const q = `query($p: [String!], $min: Int, $max: Int) { popularTitles(country: IN, filter: { packages: $p, objectTypes: [MOVIE], releaseYear: { min: $min, max: $max } }, first: 1) { totalCount } }`;
    const r = await (await fetch(JW, { method: 'POST', headers: { 'content-type': 'application/json', 'user-agent': 'Mozilla/5.0' }, body: JSON.stringify({ query: q, variables: { p: [p], min, max } }) })).json();
    console.log(p, min, max, r.errors ? 'ERR ' + JSON.stringify(r.errors).slice(0, 200) : r.data.popularTitles.totalCount);
    await sleep(2500);
  }
})();
