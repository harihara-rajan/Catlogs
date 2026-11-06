const A = 'https://tamil-ott-catalogs.onrender.com';
const j = async (u) => (await fetch(A + u)).json();
(async () => {
  for (let i = 0; i < 8; i++) {
    const d = await j('/debug/dubs/ta-dub-movie');
    const c = await j('/catalog/movie/ta-dub-movie.json');
    console.log(new Date().toISOString().slice(11, 19), 'row items:', c.metas.length, '|', JSON.stringify(d.row), '| file:', JSON.stringify(d.file.file && d.file.file.lists).slice(0, 300), '| err:', JSON.stringify(d.file.lastError));
    if (c.metas.length) { for (const x of c.metas.slice(0, 8)) console.log('   ', x.releaseInfo, x.name, '|', (x.description || '').split('\n').filter(Boolean).slice(0, 2).join(' / ').slice(0, 90), '|', (x.poster || '').replace(A, '').slice(0, 50)); break; }
    await new Promise((r) => setTimeout(r, 20000));
  }
})();
