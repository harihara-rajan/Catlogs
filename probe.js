const A = 'https://tamil-ott-catalogs.onrender.com';
(async () => {
  const w = await (await fetch(`${A}/debug/week/ml-new-movie`)).json();
  console.log('AT', w.row.at, 'arrivals', JSON.stringify(w.arrivals || w.file || '').slice(0, 200));
  for (const x of w.row.titles || []) console.log(`T ${x.kept ? 'KEEP' : 'drop'} ${x.title} rel ${x.released} added ${x.added} ${x.services.join(',')} [${x.by}]`);
})();
