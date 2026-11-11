const KEY = process.env.TMDB_API_KEY || '';
const JW = 'https://apis.justwatch.com/graphql';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function tmdb(path, params = {}) {
  const u = new URL('https://api.themoviedb.org/3' + path);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  const h = {};
  if (KEY.startsWith('eyJ')) h.Authorization = `Bearer ${KEY}`; else u.searchParams.set('api_key', KEY);
  return (await fetch(u, { headers: h })).json();
}
const shows = ['Celebrity MasterChef Tamil', 'MasterChef Tamil', 'Tamil Idol', 'Notebook 90s', 'Crime Patrol Tamil', 'Madam Police', 'Sony Vizha', 'Anbil Avan', 'Asareeri', 'Sardar 2'];
(async () => {
  console.log('key?', KEY ? 'yes' : 'no');
  for (const q of shows) {
    for (const t of ['tv', 'movie']) {
      const r = await tmdb(`/search/${t}`, { query: q });
      for (const x of (r.results || []).slice(0, 3)) {
        const p = await tmdb(`/${t}/${x.id}/watch/providers`);
        const inn = (p.results && p.results.IN) || {};
        const prov = [...(inn.flatrate || []), ...(inn.free || []), ...(inn.ads || [])].map((y) => y.provider_name).join(',');
        console.log(`TMDB ${t} "${q}" -> ${x.name || x.title} (${(x.first_air_date || x.release_date || '').slice(0, 4)}) lang=${x.original_language} id=${x.id} IN: ${prov || '-'}`);
      }
    }
    const j = await (await fetch(JW, { method: 'POST', headers: { 'content-type': 'application/json', 'user-agent': 'Mozilla/5.0' }, body: JSON.stringify({ query: `query($q: String!) { popularTitles(country: IN, filter: { searchQuery: $q }, first: 3) { edges { node { __typename content(country: IN, language: en) { title originalReleaseYear externalIds { tmdbId } } offers(country: IN, platform: WEB) { monetizationType package { shortName } } } } } }`, variables: { q } }) })).json();
    for (const e of (j.data ? j.data.popularTitles.edges : [])) console.log(`JW "${q}" -> ${e.node.__typename} ${e.node.content.title} (${e.node.content.originalReleaseYear}) tmdb=${e.node.content.externalIds && e.node.content.externalIds.tmdbId} offers: ${[...new Set(e.node.offers.map((o) => o.package.shortName + '/' + o.monetizationType))].join(' ') || '-'}`);
    await sleep(1500);
  }
})();
