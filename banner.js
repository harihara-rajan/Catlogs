// Wide "hero" banners for the New This Week rows (1280×720): the film's TMDB backdrop (16:9) with its title,
// IMDb rating, year and genre, a "NEW · 2d" chip and the service tag. Films without a backdrop
// get a blurred, darkened version of their poster behind the poster itself.
//
// Address: /banner/<movie|series>/<tmdbId>/<imdb×10|n>/<services|->/<days>.jpg?v=<design>
// Everything that's drawn is in the address (title etc. come from TMDB by id), so a banner never
// changes once made and can be cached for good.

const sharp = require('sharp');
const tmdb = require('./tmdb');
const { TAGS, textPath, textWidth, newLabel, rendering, TMDB_IMG } = require('./poster');

const DESIGN = 2; // 2: drawn at 1280×720 for TVs
// Layout is designed at 780×439 and drawn at 1280×720 (viewBox scaling), so it's sharp on TVs.
const W = 780;
const H = 439;
const OUT_W = 1280;
const OUT_H = 720;
const made = new Map();
const MAX = 150; // ~170 KB each
const ENV_KEY = process.env.TMDB_API_KEY || '';

// Split a title into at most two lines that fit `max` px at `size`; shrink the size if needed.
function fitTitle(title, max) {
  for (let size = 60; size >= 34; size -= 4) {
    const words = title.split(/\s+/);
    const lines = [''];
    for (const w of words) {
      const next = lines[lines.length - 1] ? `${lines[lines.length - 1]} ${w}` : w;
      if (textWidth(next, size) <= max || !lines[lines.length - 1]) lines[lines.length - 1] = next;
      else lines.push(w);
    }
    if (lines.length <= 2 && lines.every((l) => textWidth(l, size) <= max)) return { lines, size };
  }
  // Still too long: two lines at the smallest size, second one cut short.
  const size = 34;
  let first = '';
  const words = title.split(/\s+/);
  while (words.length && textWidth(`${first} ${words[0]}`.trim(), size) <= max) first = `${first} ${words.shift()}`.trim();
  let second = words.join(' ');
  while (second && textWidth(`${second}…`, size) > max) second = second.slice(0, -1);
  return { lines: [first, second && `${second}…`].filter(Boolean), size };
}

function chip(x, y, label, size, bg, fg, alignRight) {
  const h = size * 1.85;
  const w = textWidth(label, size) + size * 1.2;
  const left = alignRight ? x - w : x;
  return `<rect x="${left}" y="${y}" width="${w}" height="${h}" rx="${size * 0.45}" fill="${bg}"/>
    ${textPath(label, left + size * 0.6, y + h / 2 + size * 0.36, size, fg)}`;
}

function overlay({ title, year, genre, imdb, services, days }) {
  const pad = 26;
  const { lines, size } = fitTitle(title, 470);
  const metaY = H - pad - 6;
  const titleBottom = metaY - 46;
  const parts = [];

  // Title lines (bottom-aligned above the meta line), with a soft shadow.
  lines.forEach((line, i) => {
    const y = titleBottom - (lines.length - 1 - i) * size * 1.08;
    parts.push(`<g filter="url(#shadow)">${textPath(line, pad, y, size, '#fff')}</g>`);
  });

  // IMDb chip + rating · year · genre
  let x = pad;
  if (imdb != null) {
    const s = 17;
    const w = textWidth('IMDb', s) + 14;
    parts.push(`<rect x="${x}" y="${metaY - 21}" width="${w}" height="28" rx="5" fill="#F5C518"/>`);
    parts.push(textPath('IMDb', x + 7, metaY - 7 + s * 0.36, s, '#000'));
    x += w + 9;
    const t = imdb.toFixed(1);
    parts.push(textPath(t, x, metaY, 26, '#fff'));
    x += textWidth(t, 26) + 12;
  }
  const extra = [year, genre].filter(Boolean).join(' · ');
  if (extra) parts.push(textPath(imdb != null ? `· ${extra}` : extra, x, metaY, 22, '#D6D2E4'));

  // NEW chip (top-left) and service tag (top-right)
  if (days != null) parts.push(chip(pad - 6, pad - 8, newLabel(days), 20, '#fff', '#15121c'));
  const known = services.filter((s) => TAGS[s]);
  if (known.length) {
    const t = TAGS[known[0]];
    const label = known.length > 1 ? `${t.label} +${known.length - 1}` : t.label;
    parts.push(chip(W - pad + 6, pad - 8, label, 20, t.bg, t.fg, true));
  }

  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${OUT_W}" height="${OUT_H}" viewBox="0 0 ${W} ${H}">
    <defs>
      <linearGradient id="l" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="#000" stop-opacity="0.82"/>
        <stop offset="0.55" stop-color="#000" stop-opacity="0.38"/>
        <stop offset="0.85" stop-color="#000" stop-opacity="0"/>
      </linearGradient>
      <linearGradient id="b" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0.45" stop-color="#000" stop-opacity="0"/>
        <stop offset="1" stop-color="#000" stop-opacity="0.65"/>
      </linearGradient>
      <linearGradient id="t" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#000" stop-opacity="0.35"/>
        <stop offset="0.25" stop-color="#000" stop-opacity="0"/>
      </linearGradient>
      <filter id="shadow" x="-10%" y="-30%" width="120%" height="160%"><feDropShadow dx="0" dy="2" stdDeviation="5" flood-color="#000" flood-opacity="0.55"/></filter>
    </defs>
    <rect width="${W}" height="${H}" fill="url(#l)"/>
    <rect width="${W}" height="${H}" fill="url(#b)"/>
    <rect width="${W}" height="${H}" fill="url(#t)"/>
    ${parts.join('\n')}
  </svg>`);
}

async function fetchImage(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`image ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

// The picture behind the text: backdrop, or (no backdrop) the poster on a blurred copy of itself.
async function base(d) {
  if (d.backdrop_path) return sharp(await fetchImage(`${TMDB_IMG}/w1280${d.backdrop_path}`)).resize(OUT_W, OUT_H, { fit: 'cover' }).toBuffer();
  if (d.poster_path) {
    const p = await fetchImage(`${TMDB_IMG}/w500${d.poster_path}`);
    const blurred = await sharp(p).resize(OUT_W, OUT_H, { fit: 'cover' }).blur(36).modulate({ brightness: 0.55 }).toBuffer();
    const front = await sharp(p).resize({ height: OUT_H - 66 }).toBuffer();
    const { width } = await sharp(front).metadata();
    return sharp(blurred).composite([{ input: front, left: OUT_W - width - 66, top: 33 }]).toBuffer();
  }
  return sharp({ create: { width: OUT_W, height: OUT_H, channels: 3, background: '#2A2338' } }).png().toBuffer();
}

async function render(type, tmdbId, imdb, services, days) {
  const d = await tmdb.details(type, tmdbId, ENV_KEY);
  const date = d.release_date || d.first_air_date || '';
  const info = {
    title: d.title || d.name || '',
    year: date.slice(0, 4),
    genre: (d.genres && d.genres[0] && d.genres[0].name) || '',
    imdb,
    services,
    days,
  };
  return sharp(await base(d))
    .composite([{ input: overlay(info), top: 0, left: 0 }])
    .jpeg({ quality: 84, chromaSubsampling: '4:4:4', progressive: true })
    .toBuffer();
}

function bannerUrl(baseUrl, type, tmdbId, imdb, services = [], days = null) {
  if (!baseUrl) return null;
  const code = imdb == null ? 'n' : Math.round(imdb * 10);
  const svc = services.filter((s) => TAGS[s]).join('+') || '-';
  return `${baseUrl}/banner/${type}/${tmdbId}/${code}/${svc}/${days == null ? 'x' : days}.jpg?v=${DESIGN}`;
}

// Express handler for /banner/:type/:tmdbId/:imdb/:services/:days.jpg
async function handler(req, res) {
  const { type, tmdbId, imdb, services, days } = req.params;
  const svc = services === '-' ? [] : services.split('+');
  if (!/^(movie|series)$/.test(type) || !/^\d+$/.test(tmdbId) || !/^(\d{1,3}|n)$/.test(imdb) || !/^(\d{1,2}|x)$/.test(days) || !svc.every((s) => TAGS[s])) {
    return res.status(404).end();
  }
  const key = req.path;
  try {
    let buf = made.get(key);
    if (!buf) {
      buf = await rendering(() => render(type, tmdbId, imdb === 'n' ? null : Number(imdb) / 10, svc, days === 'x' ? null : Number(days)));
      made.set(key, buf);
      if (made.size > MAX) made.delete(made.keys().next().value);
    }
    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=2592000, immutable');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.end(buf);
  } catch (e) {
    console.error(`banner ${key} failed:`, e.message);
    res.status(502).end();
  }
}

module.exports = { handler, bannerUrl, overlay, render, fitTitle };
