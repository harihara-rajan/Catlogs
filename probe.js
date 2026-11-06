const A = 'https://tamil-ott-catalogs.onrender.com';
const j = async (u) => (await fetch(A + u)).json();
(async () => {
  const titles = [['series', 'tt3581920', 'The Last of Us'], ['series', 'tt0108778', 'Friends'], ['series', 'tt2356777', 'True Detective'], ['series', 'tt0903747', 'Breaking Bad'],
                  ['movie', 'tt1745960', 'Top Gun Maverick'], ['movie', 'tt36931126', 'Immortal (Tamil)'], ['movie', 'tt15354916', 'Jawan'], ['movie', 'tt0111161', 'Shawshank']];
  let st;
  for (const [t, id, name] of titles) { const d = await j(`/debug/ratings/${t}/${id}`); st = d.mdblist; console.log(name.padEnd(18), 'IMDb', d.imdb, '| RT', d.rottenTomatoes); }
  console.log('MDBList:', JSON.stringify({ known: st.known, queued: st.queued, requestsToday: st.requestsToday, paused: st.paused }));
  console.log('last:', JSON.stringify(st.lastResponse).slice(0, 700));
  // Ask MDBList's public item page format? Not possible without key. Wait for queue then recheck shows.
  await new Promise((r) => setTimeout(r, 40000));
  for (const [t, id, name] of titles.slice(0, 4)) { const d = await j(`/debug/ratings/${t}/${id}`); console.log('after 40s:', name.padEnd(18), '| RT', d.rottenTomatoes); }
  const d = await j('/debug/ratings/movie/tt0111161'); console.log('last:', JSON.stringify(d.mdblist.lastResponse).slice(0, 900));
})();
