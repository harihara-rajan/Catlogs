const JW = 'https://apis.justwatch.com/graphql';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function q(name, query, variables = {}) {
  const r = await fetch(JW, { method: 'POST', headers: { 'content-type': 'application/json', 'user-agent': 'Mozilla/5.0' }, body: JSON.stringify({ query, variables }) });
  const t = await r.text();
  console.log(`\n### ${name} (${r.status})\n${t.slice(0, 2500)}`);
  await sleep(2500);
}
(async () => {
  await q('suggest root', '{ upcoming }');
  await q('suggest root2', '{ upcomingTitles }');
  await q('node upcoming', `{ popularTitles(country: IN, first: 1, filter: { searchQuery: "Kantara" }) { edges { node { id upcomingReleases { releaseDate } } } } }`);
  await q('node upcoming fields', `{ popularTitles(country: IN, first: 1, filter: { searchQuery: "Kantara" }) { edges { node { id upcomingReleases(releaseTypes: [DIGITAL]) { releaseCountDown releaseDate label package { shortName clearName } } } } } }`);
  await q('newTitles future', `{ newTitles(country: IN, date: "2026-11-14", first: 10, filter: { packages: ["nfx","prv","jhs","zee","snl","aha","snx"] }) { totalCount edges { node { content(country: IN, language: en) { title originalReleaseYear } } } } }`);
  await q('newTitles pageType', `{ newTitles(country: IN, date: "2026-11-14", first: 10, pageType: UPCOMING, filter: { packages: ["nfx","prv","jhs","zee","snl","aha","snx"] }) { totalCount edges { node { content(country: IN, language: en) { title } } } } }`);
  await q('newTitles upcoming arg', `{ newTitles(country: IN, date: "2026-11-14", first: 10, upcoming: true) { totalCount } }`);
})();
