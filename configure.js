// The install page: pick languages, then install in Stremio or copy the link.

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// languages: [{ code, name, desc }]
module.exports = function configurePage({ languages, selected, needsKey, version }) {
  const boxes = languages
    .map(
      (l) => `
      <label class="opt">
        <input type="checkbox" name="lang" value="${esc(l.code)}" ${selected.includes(l.code) ? 'checked' : ''}>
        <span class="box" aria-hidden="true"></span>
        <span class="txt"><span class="lbl">${esc(l.name)}</span>${l.desc ? `<span class="desc">${esc(l.desc)}</span>` : ''}</span>
      </label>`
    )
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
  .opt { display:flex; align-items:flex-start; gap:14px; padding:14px 12px; border-radius:12px; cursor:pointer; position:relative; }
  .opt + .opt::before { content:""; position:absolute; top:0; left:12px; right:12px; border-top:1px solid var(--line); }
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
  <p class="intro">Pick the rows you want in Stremio. Each gives one row per service, with IMDb ratings on the posters.</p>

  <div class="card" role="group" aria-label="Languages">${boxes}
  </div>
  ${needsKey ? `<div class="field"><label for="key">TMDB API key</label><input id="key" autocomplete="off" placeholder="Paste your key"></div>` : ''}

  <a id="install" class="btn primary" href="#">Install in Stremio</a>
  <button id="copy" class="btn secondary" type="button">Copy link</button>
  <div class="msg" id="msg" role="status"></div>
  <div class="link" id="link"></div>

  <div class="notes">
    <p>The more you tick, the shorter the year list in each row's dropdown (Stremio limits how big an addon can be); newest-first sorting always works.</p>
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

  function manifestUrl() {
    const langs = boxes.filter((b) => b.checked).map((b) => b.value);
    if (!langs.length) return null;
    const cfg = {};
    if (!(langs.length === 1 && langs[0] === 'ta')) cfg.languages = langs.join(',');
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

  boxes.forEach((b) => b.addEventListener('change', update));
  if (key) key.addEventListener('input', update);
  update();
</script>
</body>
</html>`;
};
