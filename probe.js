const KEY = process.env.TMDB_API_KEY || '';
async function tmdb(path, params = {}) {
  const u = new URL('https://api.themoviedb.org/3' + path);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  const h = {};
  if (KEY.startsWith('eyJ')) h.Authorization = `Bearer ${KEY}`; else u.searchParams.set('api_key', KEY);
  return (await fetch(u, { headers: h })).json();
}
const P = { prime: '119', netflix: '8', jiohotstar: '2336', zee5: '232', sonyliv: '237', sunnxt: '309', aha: '532', manoramamax: '482' };
(async () => {
  for (const [k, ids] of Object.entries(P)) {
    const tally = {};
    for (const lang of ['ta', 'hi', 'ml', 'te']) {
      const d = await tmdb('/discover/tv', { with_original_language: lang, watch_region: 'IN', with_watch_providers: ids, sort_by: 'popularity.desc' });
      for (const s of (d.results || []).slice(0, 12)) {
        const x = await tmdb(`/tv/${s.id}`);
        for (const n of x.networks || []) tally[`${n.name}#${n.id}`] = (tally[`${n.name}#${n.id}`] || 0) + 1;
      }
    }
    console.log(`NET ${k}: ${Object.entries(tally).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([n, c]) => `${n} ${c}`).join(', ')}`);
  }
})();
