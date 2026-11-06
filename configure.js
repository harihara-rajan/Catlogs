// The install page: pick languages, then install in Stremio or copy the link.

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

module.exports = function configurePage({ languages, selected, needsKey, version }) {
  const boxes = languages
    .map(
      (l) => `
      <label class="opt">
        <input type="checkbox" name="lang" value="${esc(l.code)}" ${selected.includes(l.code) ? 'checked' : ''}>
        <span class="box" aria-hidden="true"></span>
        <span class="lbl">${esc(l.name)}</span>
      </label>`
    )
    .join('');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>OTT Catalogs</title>
<style>
  :root { --bg:#14121c; --card:#1e1b29; --line:#2e2a3d; --text:#ece9f5; --muted:#a39fb5; --accent:#7b5cff; --accent-2:#9b85ff; --ok:#3ecf8e; }
  * { box-sizing: border-box; }
  body { margin:0; background:var(--bg); color:var(--text); font:16px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif; }
  main { max-width:460px; margin:0 auto; padding:32px 16px 48px; }
  h1 { font-size:26px; line-height:1.2; margin:0 0 6px; letter-spacing:-0.01em; }
  p.sub { color:var(--muted); margin:0 0 24px; }
  .card { background:var(--card); border:1px solid var(--line); border-radius:14px; padding:6px; margin-bottom:20px; }
  .opt { display:flex; align-items:center; gap:14px; padding:14px 12px; border-radius:10px; cursor:pointer; }
  .opt + .opt { border-top:1px solid var(--line); border-radius:0; }
  .opt input { position:absolute; opacity:0; pointer-events:none; }
  .box { width:24px; height:24px; border-radius:7px; border:2px solid var(--muted); flex:none; display:grid; place-items:center; transition:.15s; }
  .opt input:checked + .box { background:var(--accent); border-color:var(--accent); }
  .opt input:checked + .box::after { content:""; width:6px; height:11px; border:solid #fff; border-width:0 2.5px 2.5px 0; transform:translateY(-1px) rotate(45deg); }
  .opt input:focus-visible + .box { outline:2px solid var(--accent-2); outline-offset:2px; }
  .lbl { font-size:18px; }
  .field { margin-bottom:20px; }
  .field label { display:block; font-size:14px; color:var(--muted); margin-bottom:6px; }
  .field input { width:100%; padding:12px; border-radius:10px; border:1px solid var(--line); background:var(--card); color:var(--text); font:inherit; }
  .btn { display:block; width:100%; text-align:center; padding:15px; border-radius:12px; font-weight:600; font-size:17px; text-decoration:none; border:0; cursor:pointer; font-family:inherit; }
  .primary { background:var(--accent); color:#fff; margin-bottom:10px; }
  .secondary { background:transparent; color:var(--text); border:1px solid var(--line); }
  .btn[aria-disabled="true"] { opacity:.4; pointer-events:none; }
  .link { margin-top:18px; font-size:13px; color:var(--muted); word-break:break-all; background:var(--card); border:1px solid var(--line); border-radius:10px; padding:10px 12px; }
  .note { font-size:14px; color:var(--muted); margin-top:20px; }
  .msg { min-height:1.5em; font-size:14px; color:var(--ok); text-align:center; margin-top:8px; }
</style>
</head>
<body>
<main>
  <h1>OTT Catalogs</h1>
  <p class="sub">Choose the languages you want rows for in Stremio.</p>

  <div class="card" role="group" aria-label="Languages">${boxes}
  </div>
  ${needsKey ? `<div class="field"><label for="key">TMDB API key</label><input id="key" autocomplete="off" placeholder="Paste your key"></div>` : ''}

  <a id="install" class="btn primary" href="#">Install in Stremio</a>
  <button id="copy" class="btn secondary" type="button">Copy link</button>
  <div class="msg" id="msg" role="status"></div>
  <div class="link" id="link"></div>

  <p class="note">Changing languages? Uninstall the old version in Stremio first, then install again.
  If “Install” doesn't open Stremio, copy the link and paste it into the search box on Stremio's Addons page.</p>
  <p class="note">v${esc(version)}</p>
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
    if (!url) { link.textContent = 'Pick at least one language.'; return; }
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
