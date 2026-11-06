const A = 'https://tamil-ott-catalogs.onrender.com';
const j = async (u) => (await fetch(A + u)).json();
(async () => {
  for (let i = 0; i < 20; i++) {
    let v = '?'; try { v = (await j('/manifest.json')).version; } catch { v = 'unreachable'; }
    if (v === '2.2.1') { console.log('live', v); break; }
    await new Promise((r) => setTimeout(r, 10000));
  }
  await new Promise((r) => setTimeout(r, 50000));
  for (const [t, id] of [['movie', 'ta-new-movie'], ['movie', 'ta-zee5-movie']]) {
    const c = await j(`/catalog/${t}/${id}.json`);
    for (const x of c.metas.slice(0, 3)) {
      const t0 = Date.now(); const r = await fetch(x.poster); const b = Buffer.from(await r.arrayBuffer());
      // JPEG size from SOF0/SOF2 marker
      let w = 0, h = 0; for (let k = 2; k < b.length - 9; k++) if (b[k] === 0xff && (b[k + 1] === 0xc0 || b[k + 1] === 0xc2)) { h = b.readUInt16BE(k + 5); w = b.readUInt16BE(k + 7); break; }
      console.log(id.padEnd(14), x.name.slice(0, 22).padEnd(23), r.status, `${w}x${h}`, Math.round(b.length / 1024) + 'KB', (Date.now() - t0) + 'ms', x.poster.replace(A, '').slice(0, 60));
    }
  }
})();
