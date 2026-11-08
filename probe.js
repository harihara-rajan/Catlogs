const JW = 'https://apis.justwatch.com/graphql';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function q(name, query, variables = {}, n = 600) {
  const r = await fetch(JW, { method: 'POST', headers: { 'content-type': 'application/json', 'user-agent': 'Mozilla/5.0' }, body: JSON.stringify({ query, variables }) });
  const t = await r.text(); await sleep(2500);
  let j = null; try { j = JSON.parse(t); } catch {}
  if (!j || j.errors) console.log(`\n### ${name} (${r.status}) ${t.slice(0, n)}`);
  return j;
}
const PK = ["nfx","prv","jhs","zee","snl","aha","snx"];
(async () => {
  await q('lang field', `{ popularTitles(country: IN, first: 1) { edges { node { content(country: IN, language: en) { title originalLanguage } } } } }`);
  await q('sort enum', `{ popularTitles(country: IN, first: 1, sortBy: TRENDING) { totalCount } }`);
  const fields = `edges { node { content(country: IN, language: en) { title originalReleaseYear } ... on MovieOrShow { } } }`;
  for (const [label, sort] of [['POPULAR', 'POPULAR'], ['TRENDING', 'TRENDING']]) {
    const r = await q(label, `{ popularTitles(country: IN, first: 40, sortBy: ${sort}, filter: { packages: ${JSON.stringify(PK)}, objectTypes: [MOVIE] }) { edges { node { content(country: IN, language: en) { title originalReleaseYear originalLanguage: externalIds { imdbId } } } } } }`);
    if (r && r.data) console.log(`\n== ${label} movies on Indian services:\n` + r.data.popularTitles.edges.map((e, i) => `${i + 1}. ${e.node.content.title} (${e.node.content.originalReleaseYear})`).join('\n'));
  }
})();
