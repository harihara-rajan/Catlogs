const JW = 'https://apis.justwatch.com/graphql';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function q(name, query, variables = {}, n = 3000) {
  const r = await fetch(JW, { method: 'POST', headers: { 'content-type': 'application/json', 'user-agent': 'Mozilla/5.0' }, body: JSON.stringify({ query, variables }) });
  const t = await r.text();
  console.log(`\n### ${name} (${r.status})\n${t.slice(0, n)}`);
  await sleep(2500);
  try { return JSON.parse(t); } catch { return null; }
}
const PK = '["nfx","prv","jhs","zee","snl","aha","snx","mrx"]';
(async () => {
  await q('fragments', `{ newTitles(country: IN, date: "2026-11-06", first: 3, pageType: UPCOMING, filter: { packages: ${PK} }) { edges { node { __typename ... on Movie { upcomingReleases { releaseDate releaseType label package { shortName } } } ... on Show { upcomingReleases { releaseDate releaseType label package { shortName } } } ... on Season { upcomingReleases { releaseDate releaseType label package { shortName } } } } } } }`);
  await q('edge fields', `{ newTitles(country: IN, date: "2026-11-06", first: 3, pageType: UPCOMING, filter: { packages: ${PK} }) { edges { cursor newOffer(platform: WEB) { package { shortName } } node { id } } } }`);
  await q('date variance', `{ a: newTitles(country: IN, date: "2026-11-06", first: 1, pageType: UPCOMING, filter: { packages: ${PK} }) { totalCount } b: newTitles(country: IN, date: "2026-12-20", first: 1, pageType: UPCOMING, filter: { packages: ${PK} }) { totalCount } c: newTitles(country: IN, date: "2026-11-06", first: 1, pageType: UPCOMING, filter: { packages: ["zee"] }) { totalCount } }`);
})();
