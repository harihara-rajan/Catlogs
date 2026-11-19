const A = 'https://tamil-ott-catalogs.onrender.com';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {

  for (const [t, id] of [['movie', 'en-new-movie'], ['series', 'en-new-series']]) {
    await fetch(`${A}/catalog/${t}/${id}.json`); await sleep(20000);
    const w = await (await fetch(`${A}/debug/week/${id}`)).json();
    console.log(`\nROW ${id}: candidates ${w.row.candidates}, judged ${w.row.titles.length}, kept ${w.row.kept}, at ${w.row.at}`);
    const titles = w.row.titles.sort((a, b) => b.pop - a.pop);
    for (const x of titles.slice(0, 45)) console.log(`  ${x.kept ? 'KEEP' : 'drop'} ${x.region} ${String(x.title).slice(0, 34).padEnd(35)} rel ${x.released} added ${x.added}${x.bulk ? ' bulk' : ''} votes ${x.votes} pop ${x.pop} ${x.services.join(',')}`);
  }
})();
