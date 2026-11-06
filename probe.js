const A = 'https://tamil-ott-catalogs.onrender.com';
const t = async (u, ms = 30000) => { const t0 = Date.now(); try { const r = await fetch(A + u, { signal: AbortSignal.timeout(ms) }); const b = await r.text(); return `${r.status} in ${Date.now() - t0}ms: ${b.slice(0, 250).replace(/\s+/g, ' ')}`; } catch (e) { return `FAILED after ${Date.now() - t0}ms: ${e.message}`; } };
(async () => {
  for (let i = 0; i < 6; i++) {
    console.log(new Date().toISOString().slice(11, 19), 'manifest', await t('/manifest.json'));
    console.log('   dubs ', await t('/debug/dubs/ta-dub-movie'));
    console.log('   row  ', await t('/catalog/movie/ta-netflix-movie.json'));
    await new Promise((r) => setTimeout(r, 15000));
  }
})();
