const KEY = process.env.TMDB_API_KEY || '';
async function tmdb(path, params = {}) {
  const u = new URL('https://api.themoviedb.org/3' + path);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  const h = {};
  if (KEY.startsWith('eyJ')) h.Authorization = `Bearer ${KEY}`; else u.searchParams.set('api_key', KEY);
  return (await fetch(u, { headers: h })).json();
}
(async () => {
  for (const id of [338683, 338687, 339004, 339001, 339213]) {
    const d = await tmdb(`/tv/${id}`);
    console.log(`SHOW ${d.name} | networks: ${(d.networks || []).map((n) => `${n.name}#${n.id}`).join(', ')} | first ${d.first_air_date} | eps ${d.number_of_episodes}`);
  }
  // Big Tamil channels: which TMDB network ids, and how many current Tamil shows each has
  for (const name of ['Sony Vizha', 'Star Vijay', 'Vijay Television', 'Zee Tamil', 'Sun TV', 'Colors Tamil', 'Kalaignar TV', 'Sony LIV']) {
    const r = await tmdb('/search/company', { query: name });
    console.log(`COMPANY? ${name}: ${(r.results || []).slice(0, 3).map((c) => c.name + '#' + c.id).join(', ')}`);
  }
})();
