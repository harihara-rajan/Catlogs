const A = 'https://tamil-ott-catalogs.onrender.com';
const j = async (u) => (await fetch(A + u)).json();
(async () => {
  for (let i = 0; i < 10; i++) {
    const c = await j(`/catalog/movie/en-us-netflix-movie.json?r=${i}`);
    const codes = c.metas.map((m) => ((m.poster || '').match(/\/poster\/tt\d+\/([\dn]+-[\dn]+)/) || [])[1]).filter(Boolean);
    const st = (await j('/debug/ratings/movie/tt0111161')).mdblist;
    const rt = codes.filter((x) => !x.endsWith('-n')).length;
    console.log(new Date().toISOString().slice(11, 19), 'en-us-netflix: RT on', rt, 'of', codes.length, '| mdblist known', st.known, 'queued', st.queued, 'requests', st.requestsToday);
    if (rt >= 10) break;
    await new Promise((r) => setTimeout(r, 30000));
  }
})();
