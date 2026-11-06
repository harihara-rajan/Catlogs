// The install page: pick languages, then install in Stremio or copy the link.

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// languages: [{ code, name, desc, chips: [{ key, name, types: ['movie','series'] }] }];
// selected: [code]; chips: { code: [keys like "netflix", "netflix:m"] | null (= all) }
module.exports = function configurePage({ languages, selected, chips = {}, needsKey, version }) {
  const T = { movie: { s: 'm', label: 'Movies' }, series: { s: 's', label: 'Series' } };
  const boxes = languages
    .map((l) => {
      const saved = chips[l.code];
      const on = (key, type) => !saved || saved.includes(key) || saved.includes(`${key}:${T[type].s}`);
      const pill = (c, type, label) =>
        `<button type="button" class="chip${on(c.key, type) ? ' on' : ''}" data-key="${esc(c.key)}" data-type="${T[type].s}" aria-pressed="${on(c.key, type)}">${esc(label)}</button>`;
      let chipRow = '';
      if (l.chips && l.chips.length) {
        const split = l.chips[0].types.length > 1;
        chipRow = split
          // Movies and series: one line per service with two switches.
          ? `<div class="chips grid" data-for="${esc(l.code)}" role="group" aria-label="${esc(l.name)} rows">
              ${l.chips.map((c) => `<div class="svc"><span class="svc-name">${esc(c.name)}</span><span class="pills">${c.types.map((t) => pill(c, t, T[t].label)).join('')}</span></div>`).join('')}
             </div>`
          // Movies only: one switch per service.
          : `<div class="chips" data-for="${esc(l.code)}" role="group" aria-label="${esc(l.name)} rows">
              ${l.chips.map((c) => pill(c, c.types[0], c.name)).join('')}
             </div>`;
      }
      return `
      <div class="item">
        <label class="opt">
          <input type="checkbox" name="lang" value="${esc(l.code)}" ${selected.includes(l.code) ? 'checked' : ''}>
          <span class="box" aria-hidden="true"></span>
          <span class="txt"><span class="lbl">${esc(l.name)}</span>${l.desc ? `<span class="desc">${esc(l.desc)}</span>` : ''}</span>
        </label>
        ${chipRow}
      </div>`;
    })
    .join('');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>OTT Catalogs</title>
<link rel="icon" href="/logo.png">
<style>
  :root { --bg:#0E0C15; --card:#1A1724; --card2:#211D2E; --line:#2E2A3D; --text:#F1EEF8; --muted:#A8A3BC;
          --violet:#6D4AFF; --pink:#B248D8; --coral:#FF6B5A; --ok:#3ECF8E; }
  * { box-sizing:border-box; }
  html { background:var(--bg); }
  body { margin:0; color:var(--text); font:16px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif; min-height:100vh;
         background-color:var(--bg);
         background-image:radial-gradient(1200px 600px at 10% -10%, rgba(109,74,255,.35), transparent 60%),
                          radial-gradient(900px 500px at 110% 110%, rgba(255,107,90,.22), transparent 60%);
         background-attachment:fixed; }
  main { max-width:480px; margin:0 auto; padding:32px 16px 48px; }
  header { display:flex; align-items:center; gap:14px; margin-bottom:8px; }
  header img { width:56px; height:56px; border-radius:14px; box-shadow:0 8px 24px rgba(109,74,255,.35); }
  h1 { font-size:28px; line-height:1.1; margin:0; letter-spacing:-.02em; }
  .tag { margin:2px 0 0; color:var(--muted); font-size:14px; }
  .intro { color:var(--muted); margin:18px 0 18px; font-size:15px; }
  .card { background:var(--card); border:1px solid var(--line); border-radius:16px; padding:6px; margin-bottom:20px; }
  .item { position:relative; }
  .item + .item::before { content:""; position:absolute; top:0; left:12px; right:12px; border-top:1px solid var(--line); }
  .opt { display:flex; align-items:flex-start; gap:14px; padding:14px 12px; border-radius:12px; cursor:pointer; position:relative; }
  .chips { display:none; flex-wrap:wrap; gap:8px; padding:0 12px 14px 50px; }
  .item.open .chips { display:flex; }
  .item.open .desc { display:none; }
  .chip { font:inherit; font-size:14px; font-weight:600; padding:7px 12px; border-radius:999px; cursor:pointer;
          border:1px solid var(--line); background:transparent; color:var(--muted); transition:.15s; }
  .chip.on { background:rgba(109,74,255,.22); border-color:rgba(155,133,255,.7); color:var(--text); }
  .chip.on::before { content:"✓ "; }
  .chip:focus-visible { outline:2px solid var(--pink); outline-offset:2px; }
  .chips.grid { flex-direction:column; flex-wrap:nowrap; gap:6px; }
  .svc { display:flex; align-items:center; justify-content:space-between; gap:10px; }
  .svc-name { font-size:15px; font-weight:600; color:var(--text); }
  .pills { display:flex; gap:6px; flex:none; }
  .pills .chip { font-size:13px; padding:5px 0; width:92px; text-align:center; }
  .hint { font-size:12.5px; color:var(--muted); padding:0 12px 12px 50px; display:none; }
  .item.open .hint { display:block; }
  .opt:hover { background:var(--card2); }
  .opt input { position:absolute; opacity:0; pointer-events:none; }
  .box { width:24px; height:24px; margin-top:1px; border-radius:7px; border:2px solid var(--muted); flex:none; display:grid; place-items:center; transition:.15s; }
  .opt input:checked + .box { background:linear-gradient(135deg,var(--violet),var(--pink)); border-color:transparent; }
  .opt input:checked + .box::after { content:""; width:6px; height:11px; border:solid #fff; border-width:0 2.5px 2.5px 0; transform:translateY(-1px) rotate(45deg); }
  .opt input:focus-visible + .box { outline:2px solid var(--pink); outline-offset:2px; }
  .txt { display:flex; flex-direction:column; min-width:0; }
  .lbl { font-size:17px; font-weight:600; }
  .desc { font-size:13px; color:var(--muted); line-height:1.4; margin-top:2px; }
  .field { margin-bottom:20px; }
  .field label { display:block; font-size:14px; color:var(--muted); margin-bottom:6px; }
  .field input { width:100%; padding:12px; border-radius:10px; border:1px solid var(--line); background:var(--card); color:var(--text); font:inherit; }
  .btn { display:block; width:100%; text-align:center; padding:15px; border-radius:14px; font-weight:700; font-size:17px; text-decoration:none; border:0; cursor:pointer; font-family:inherit; }
  .primary { background:linear-gradient(135deg,var(--violet),var(--pink) 60%,var(--coral)); color:#fff; margin-bottom:10px; box-shadow:0 10px 30px rgba(178,72,216,.35); }
  .secondary { background:transparent; color:var(--text); border:1px solid var(--line); }
  .btn[aria-disabled="true"], .btn:disabled { opacity:.4; pointer-events:none; }
  .link { margin-top:16px; font-size:12.5px; color:var(--muted); word-break:break-all; background:var(--card); border:1px solid var(--line); border-radius:10px; padding:10px 12px; }
  .msg { min-height:1.5em; font-size:14px; color:var(--ok); text-align:center; margin-top:8px; }
  .notes { margin-top:22px; font-size:13.5px; color:var(--muted); }
  .notes p { margin:0 0 10px; }
  .ver { font-size:12px; color:#6f6a84; margin-top:18px; }
</style>
</head>
<body>
<main>
  <header>
    <img src="/logo.png" alt="">
    <div>
      <h1>OTT Catalogs</h1>
      <p class="tag">What's on your streaming services, newest first</p>
    </div>
  </header>
  <p class="intro">Tick a language, then switch off any services, movies or series you don't want. Each one gives its own row, with IMDb ratings on the posters.</p>

  <div class="card" role="group" aria-label="Languages">${boxes}
  </div>
  ${needsKey ? `<div class="field"><label for="key">TMDB API key</label><input id="key" autocomplete="off" placeholder="Paste your key"></div>` : ''}

  <a id="install" class="btn primary" href="#">Install in Stremio</a>
  <button id="copy" class="btn secondary" type="button">Copy link</button>
  <div class="msg" id="msg" role="status"></div>
  <div class="link" id="link"></div>

  <div class="notes">
    <p>The fewer rows you pick, the longer the year list in each row's dropdown (Stremio limits how big an addon can be); newest-first sorting always works.</p>
    <p>Changing your choice? Uninstall the old version in Stremio first, then install again. If “Install” doesn't open Stremio, copy the link and paste it into the search box on Stremio's Addons page.</p>
  </div>
  <p class="ver">v${esc(version)}</p>
</main>
<script>
  const boxes = [...document.querySelectorAll('input[name=lang]')];
  const key = document.getElementById('key');
  const install = document.getElementById('install');
  const copy = document.getElementById('copy');
  const link = document.getElementById('link');
  const msg = document.getElementById('msg');

  const chipsFor = (code) => document.querySelector('.chips[data-for="' + code + '"]');

  // Open the chip list of ticked languages.
  function syncOpen() {
    boxes.forEach((b) => b.closest('.item').classList.toggle('open', b.checked));
  }

  document.querySelectorAll('.chip').forEach((c) => c.addEventListener('click', () => {
    const on = !c.classList.contains('on');
    c.classList.toggle('on', on);
    c.setAttribute('aria-pressed', on);
    // All switched off: untick the language.
    const group = c.closest('.chips');
    if (!group.querySelector('.chip.on')) {
      const box = boxes.find((b) => b.value === group.dataset.for);
      box.checked = false;
      group.querySelectorAll('.chip').forEach((x) => { x.classList.add('on'); x.setAttribute('aria-pressed', true); });
      syncOpen();
    }
    update();
  }));

  function manifestUrl() {
    const langs = boxes.filter((b) => b.checked).map((b) => b.value);
    if (!langs.length) return null;
    const cfg = {};
    if (!(langs.length === 1 && langs[0] === 'ta')) cfg.languages = langs.join(',');
    // Only save a choice when something is switched off (none saved = all rows). Per service:
    // "netflix" = movies and series, "netflix:m" = movies only, "netflix:s" = series only.
    for (const code of langs) {
      const group = chipsFor(code);
      if (!group) continue;
      const all = [...group.querySelectorAll('.chip')];
      if (all.every((c) => c.classList.contains('on'))) continue;
      const byKey = {};
      all.forEach((c) => { (byKey[c.dataset.key] = byKey[c.dataset.key] || { all: 0, on: [] }).all++; if (c.classList.contains('on')) byKey[c.dataset.key].on.push(c.dataset.type); });
      const keys = Object.entries(byKey).filter(([, v]) => v.on.length).map(([k, v]) => (v.on.length === v.all ? k : k + ':' + v.on[0]));
      if (keys.length) cfg[code] = keys.join(',');
    }
    if (key && key.value.trim()) cfg.tmdbApiKey = key.value.trim();
    const prefix = Object.keys(cfg).length ? '/' + encodeURIComponent(JSON.stringify(cfg)) : '';
    return location.origin + prefix + '/manifest.json';
  }

  function update() {
    const url = manifestUrl();
    msg.textContent = '';
    install.setAttribute('aria-disabled', url ? 'false' : 'true');
    copy.disabled = !url;
    if (!url) { link.textContent = 'Pick at least one.'; return; }
    link.textContent = url;
    install.href = url.replace(/^https?:/, 'stremio:');
  }

  copy.addEventListener('click', async () => {
    const url = manifestUrl();
    if (!url) return;
    try { await navigator.clipboard.writeText(url); msg.textContent = 'Link copied'; }
    catch { msg.textContent = 'Copy failed — press and hold the link below to copy it.'; }
  });

  boxes.forEach((b) => b.addEventListener('change', () => { syncOpen(); update(); }));
  syncOpen();
  if (key) key.addEventListener('input', update);
  update();
</script>
</body>
</html>`;
};
