// Diagnostic round 2: discover JustWatch query shapes (introspection is off, so use error hints).
const JW = 'https://apis.justwatch.com/graphql';
const hr = (t) => console.log(`\n==================== ${t}`);

async function gql(label, query, variables = {}) {
  hr(label);
  const r = await fetch(JW, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'user-agent': 'Mozilla/5.0' },
    body: JSON.stringify({ query, variables }),
  });
  const j = await r.json();
  if (j.errors) console.log('ERRORS', j.errors.map((e) => e.message).join('\n  ').slice(0, 1500));
  if (j.data) console.log(JSON.stringify(j.data, null, 1).slice(0, 3500));
  return j.data;
}

const NODE = `id objectType
  content(country: $c, language: $l) { title originalReleaseYear originalReleaseDate externalIds { imdbId tmdbId } }
  offers(country: $c, platform: WEB) { monetizationType dateCreated package { technicalName } }`;

(async () => {
  const v = { c: 'IN', l: 'en' };
  await gql('search MM2', `query($c: Country!, $l: Language!) { popularTitles(country: $c, filter: { searchQuery: "Meesaya Murukku 2" }, first: 3) { edges { node { ${NODE} } } } }`, v);
  await gql('search Nooru Kodi Vaanavil', `query($c: Country!, $l: Language!) { popularTitles(country: $c, filter: { searchQuery: "Nooru Kodi Vaanavil" }, first: 3) { edges { node { ${NODE} } } } }`, v);

  // Error hints for filter fields / sort enums / content fields
  await gql('hint: bad TitleFilter field', `query { popularTitles(country: IN, filter: { originalLanguage: "ta" }, first: 1) { totalCount } }`);
  await gql('hint: bad TitleFilter field 2', `query { popularTitles(country: IN, filter: { languages: ["ta"] }, first: 1) { totalCount } }`);
  await gql('hint: bad sort', `query { popularTitles(country: IN, sortBy: LAST_ADDED, first: 1) { totalCount } }`);
  await gql('hint: content fields', `query { popularTitles(country: IN, first: 1) { edges { node { content(country: IN, language: en) { originalLanguage } } } } }`);

  // New titles on SonyLIV India, today and recent days
  const today = new Date().toISOString().slice(0, 10);
  await gql(
    'newTitles snl ' + today,
    `query($c: Country!, $l: Language!, $d: Date!) {
      newTitles(country: $c, date: $d, first: 40, filter: { packages: ["snl"], objectTypes: [MOVIE] }, pageType: NEW, priceDrops: false) {
        totalCount
        edges { node { ${NODE} } }
      } }`,
    { ...v, d: today }
  );
  const yday = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
  await gql(
    'newTitles snl ' + yday + ' (titles only)',
    `query($c: Country!, $l: Language!, $d: Date!) {
      newTitles(country: $c, date: $d, first: 60, filter: { packages: ["snl"] }, pageType: NEW, priceDrops: false) {
        totalCount
        edges { node { objectType content(country: $c, language: $l) { title originalReleaseYear externalIds { tmdbId } } } }
      } }`,
    { ...v, d: yday }
  );
})();
