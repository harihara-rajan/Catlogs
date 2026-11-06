const A = 'https://tamil-ott-catalogs.onrender.com';
(async () => {
  for (const u of [`${A}/manifest.json`, `${A}/manifest.json?nocache=${Date.now()}`]) {
    const r = await fetch(u, { cache: 'no-store' });
    const m = await r.json();
    console.log(u.replace(A, ''), '->', m.version, '| cache-control:', r.headers.get('cache-control'), '| age:', r.headers.get('age'), '| cf-cache:', r.headers.get('cf-cache-status'));
  }
})();
