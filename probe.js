// Diagnostic: what does the live addon return, and what can JustWatch tell us?
const ADDON = 'https://tamil-ott-catalogs.onrender.com';
const JW = 'https://apis.justwatch.com/graphql';

const hr = (t) => console.log(`\n==================== ${t}`);

async function addon() {
  hr('ADDON manifest');
  const m = await (await fetch(`${ADDON}/manifest.json`)).json();
  console.log('version', m.version, '| options', m.catalogs[0].extra[0].options.slice(0, 5));
  hr('ADDON sonyliv movie default');
  const t0 = Date.now();
  const c = await (await fetch(`${ADDON}/catalog/movie/ta-sonyliv-movie.json`)).json();
  console.log(`${Date.now() - t0}ms`, c.metas.map((x) => `${x.name} [${x.releaseInfo}] ${x.id}`).join('\n'));
}

async function gql(query, variables = {}) {
  const r = await fetch(JW, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'user-agent': 'Mozilla/5.0' },
    body: JSON.stringify({ query, variables }),
  });
  const j = await r.json();
  if (j.errors) console.log('GQL ERRORS', JSON.stringify(j.errors).slice(0, 1500));
  return j.data;
}

async function jw() {
  hr('JW packages IN');
  const p = await gql(`query { packages(country: IN, platform: WEB) { packageId clearName technicalName shortName monetizationTypes } }`);
  console.log(p && p.packages.map((x) => `${x.packageId} ${x.technicalName} ${x.shortName} "${x.clearName}" ${x.monetizationTypes}`).join('\n'));

  hr('JW introspect TitleFilter');
  const t = await gql(`query { __type(name: "TitleFilter") { inputFields { name type { kind name ofType { kind name ofType { name } } } } } }`);
  console.log(JSON.stringify(t));

  hr('JW introspect Query fields');
  const q = await gql(`query { __schema { queryType { fields { name args { name type { kind name ofType { kind name ofType { kind name } } } } } } } }`);
  if (q) for (const f of q.__schema.queryType.fields) if (/title|new|popular/i.test(f.name)) console.log(f.name, '(', f.args.map((a) => `${a.name}:${a.type.name || (a.type.ofType && (a.type.ofType.name || (a.type.ofType.ofType && a.type.ofType.ofType.name)))}`).join(', '), ')');

  for (const name of ['PopularTitlesSorting', 'NewPageType', 'Language']) {
    hr('JW enum ' + name);
    const e = await gql(`query { __type(name: "${name}") { enumValues { name } } }`);
    console.log(e && e.__type && e.__type.enumValues ? e.__type.enumValues.map((v) => v.name).join(' ').slice(0, 600) : JSON.stringify(e));
  }

  for (const name of ['NewTitlesConnection', 'NewTitlesEdge', 'Offer', 'MovieContent']) {
    hr('JW type ' + name);
    const e = await gql(`query { __type(name: "${name}") { fields { name args { name } type { kind name ofType { name } } } } }`);
    console.log(e && e.__type && e.__type.fields ? e.__type.fields.map((f) => `${f.name}${f.args && f.args.length ? '(' + f.args.map((a) => a.name).join(',') + ')' : ''}:${f.type.name || (f.type.ofType && f.type.ofType.name)}`).join(' | ') : JSON.stringify(e));
  }

  hr('JW search Meesaya Murukku 2');
  const s = await gql(
    `query($c: Country!, $l: Language!) {
      popularTitles(country: $c, filter: { searchQuery: "Meesaya Murukku 2" }, first: 5) {
        edges { node { id objectType
          content(country: $c, language: $l) { title originalReleaseYear originalReleaseDate externalIds { imdbId tmdbId } }
          offers(country: $c, platform: WEB) { monetizationType dateCreated package { technicalName clearName } }
        } }
      } }`,
    { c: 'IN', l: 'en' }
  );
  console.log(JSON.stringify(s, null, 1).slice(0, 4000));
}

(async () => {
  try { await addon(); } catch (e) { console.log('ADDON FAILED', e.message); }
  try { await jw(); } catch (e) { console.log('JW FAILED', e.message); }
})();
