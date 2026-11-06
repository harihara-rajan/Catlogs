// Diagnostic round 3: paging, season->show ids, daily volumes per service.
const JW = 'https://apis.justwatch.com/graphql';
const hr = (t) => console.log(`\n==================== ${t}`);

async function gql(query, variables = {}) {
  const r = await fetch(JW, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'user-agent': 'Mozilla/5.0' },
    body: JSON.stringify({ query, variables }),
  });
  const j = await r.json();
  if (j.errors) console.log('ERRORS', j.errors.map((e) => e.message).join('\n  ').slice(0, 1500));
  return j.data;
}

const Q = `query($c: Country!, $l: Language!, $d: Date!, $p: [String!], $after: String) {
  newTitles(country: $c, date: $d, first: 100, after: $after, filter: { packages: $p }, pageType: NEW, priceDrops: false) {
    totalCount
    pageInfo { endCursor hasNextPage }
    edges {
      node {
        id objectType
        content(country: $c, language: $l) { title originalReleaseYear externalIds { imdbId tmdbId } }
        ... on Season { show { id content(country: $c, language: $l) { title externalIds { imdbId tmdbId } } } }
      }
    }
  } }`;

(async () => {
  const pk = { prime: 'prv', aha: 'aha', netflix: 'nfx', sonyliv: 'snl', sunnxt: 'snx', jiohotstar: 'jhs', zee5: 'zee' };
  hr('sample sonyliv 2026-11-05');
  const s = await gql(Q, { c: 'IN', l: 'en', d: '2026-11-05', p: ['snl'] });
  console.log(JSON.stringify(s && s.newTitles.edges.slice(0, 2), null, 1));
  console.log('pageInfo', s && JSON.stringify(s.newTitles.pageInfo));

  hr('daily totals last 7 days');
  for (const [k, p] of Object.entries(pk)) {
    const counts = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(Date.now() - i * 864e5).toISOString().slice(0, 10);
      const r = await gql(Q.replace('first: 100', 'first: 1'), { c: 'IN', l: 'en', d, p: [p] });
      counts.push(r ? r.newTitles.totalCount : 'err');
    }
    console.log(k.padEnd(11), counts.join(' '));
  }

  hr('sonyliv last 10 days, all titles');
  for (let i = 0; i < 10; i++) {
    const d = new Date(Date.now() - i * 864e5).toISOString().slice(0, 10);
    const r = await gql(Q, { c: 'IN', l: 'en', d, p: ['snl'] });
    for (const e of (r ? r.newTitles.edges : [])) {
      const n = e.node;
      const show = n.show ? ` <- show "${n.show.content.title}" tmdb ${n.show.content.externalIds.tmdbId}` : '';
      console.log(d, n.objectType, `"${n.content.title}"`, n.content.originalReleaseYear, n.content.externalIds.tmdbId, n.content.externalIds.imdbId, show);
    }
  }
})();
