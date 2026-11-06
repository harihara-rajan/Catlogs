const JW = 'https://apis.justwatch.com/graphql';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function q(name, query, variables = {}, n = 1500) {
  const r = await fetch(JW, { method: 'POST', headers: { 'content-type': 'application/json', 'user-agent': 'Mozilla/5.0' }, body: JSON.stringify({ query, variables }) });
  const t = await r.text();
  if (n) console.log(`\n### ${name} (${r.status})\n${t.slice(0, n)}`);
  await sleep(2500);
  try { return JSON.parse(t); } catch { return null; }
}
const PK = ["nfx","prv","jhs","zee","snl","aha","snx","mrx"];
(async () => {
  const counts = await q('per package', `{ ${PK.map((p) => `${p}: newTitles(country: IN, date: "2026-11-06", first: 1, pageType: UPCOMING, filter: { packages: ["${p}"] }) { totalCount }`).join(' ')} }`);
  const fields = `content(country: IN, language: en) { title originalReleaseYear originalReleaseDate externalIds { imdbId tmdbId } upcomingReleases { releaseDate releaseType label releaseCountDown package { shortName } } }`;
  const r = await q('content upcoming', `{ newTitles(country: IN, date: "2026-11-06", first: 3, pageType: UPCOMING, filter: { packages: ${JSON.stringify(PK)} }) { edges { node { id ${fields} } } } }`);
  if (r && r.data) {
    let after = null; const all = [];
    for (let i = 0; i < 4; i++) {
      const p = await q('page', `query($a: String) { newTitles(country: IN, date: "2026-11-06", first: 40, after: $a, pageType: UPCOMING, filter: { packages: ${JSON.stringify(PK)} }) { pageInfo { endCursor hasNextPage } edges { node { id __typename ... on Season { show { content(country: IN, language: en) { title } } } ${fields} } } } }`, { a: after }, 0);
      const nt = p && p.data && p.data.newTitles; if (!nt) { console.log(JSON.stringify(p).slice(0, 500)); break; }
      all.push(...nt.edges); if (!nt.pageInfo.hasNextPage) break; after = nt.pageInfo.endCursor;
    }
    for (const e of all) {
      const c = e.node.content; const show = e.node.show ? e.node.show.content.title + ' · ' : '';
      console.log(`${(show + c.title).slice(0, 40).padEnd(41)} ${c.originalReleaseYear} tmdb:${c.externalIds && c.externalIds.tmdbId} | ${(c.upcomingReleases || []).map((u) => `${u.package && u.package.shortName}@${u.releaseDate || '?'}(${u.releaseType}${u.label ? ',' + u.label : ''})`).join(' ')}`);
    }
  }
})();
