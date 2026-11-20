const A = 'https://tamil-ott-catalogs.onrender.com';
const JW = 'https://apis.justwatch.com/graphql';
const KEY = process.env.TMDB_API_KEY;
(async () => {
  const q = `query($q: String!) { popularTitles(country: IN, filter: { searchQuery: $q, objectTypes: [MOVIE] }, first: 3) { edges { node { content(country: IN, language: en) { title originalReleaseYear originalReleaseDate externalIds { imdbId tmdbId } } offers(country: IN, platform: WEB) { monetizationType dateCreated package { shortName } } } } } }`;
  const r = await (await fetch(JW, { method: 'POST', headers: { 'content-type': 'application/json', 'user-agent': 'Mozilla/5.0' }, body: JSON.stringify({ query: q, variables: { q: 'Haiku' } }) })).json();
  for (const e of r.data.popularTitles.edges) { const n = e.node; console.log('JW', n.content.title, n.content.originalReleaseDate, JSON.stringify(n.content.externalIds), n.offers.map((o) => `${o.package.shortName}/${o.monetizationType}@${(o.dateCreated || '').slice(0, 10)}`).join(' ')); }
  const u = new URL('https://api.themoviedb.org/3/search/movie'); u.searchParams.set('query', 'Haiku'); u.searchParams.set('year', '2026');
  const h = {}; if (KEY.startsWith('eyJ')) h.Authorization = `Bearer ${KEY}`; else u.searchParams.set('api_key', KEY);
  const t = await (await fetch(u, { headers: h })).json();
  for (const m of (t.results || []).slice(0, 4)) console.log('TMDB', m.id, m.title, m.original_language, m.release_date, 'poster', !!m.poster_path);
  for (const [ty, id] of [['movie', 'ta-new-movie'], ['movie', 'ta-netflix-movie']]) {
    const c = await (await fetch(`${A}/catalog/${ty}/${id}.json`)).json();
    console.log('ROW', id, c.metas.slice(0, 8).map((m) => m.name).join(' | '));
  }
})();
