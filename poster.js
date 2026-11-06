// Posters with rating badges: the TMDB poster with an IMDb / Rotten Tomatoes strip drawn along
// the bottom. Text is turned into vector shapes from the bundled font (assets/Inter-Bold.otf), so
// it doesn't depend on fonts being installed on the server.
//
// The ratings are part of the poster's address (/poster/tt123/78-92/abc.jpg), so a poster never
// changes once made: Stremio and the server can cache it for good, and when a score arrives the
// catalog simply points at a new address.

const path = require('path');
const sharp = require('sharp');
const opentype = require('opentype.js');
const { limiter } = require('./cache');

sharp.concurrency(1);
sharp.cache(false);

const font = opentype.loadSync(path.join(__dirname, 'assets', 'Inter-Bold.otf'));
const TMDB_IMG = process.env.TMDB_IMG_BASE || 'https://image.tmdb.org/t/p';
const SIZE = 'w342';
const rendering = limiter(2);

// Rendered posters, newest last; oldest dropped beyond MAX.
const made = new Map();
const MAX = 1500;

const textWidth = (s, size) => font.getAdvanceWidth(s, size);
const textPath = (s, x, y, size, fill) => `<path fill="${fill}" d="${font.getPath(s, x, y, size).toPathData(1)}"/>`;

// Fresh tomato (60%+) or rotten splat, drawn in a size×size box at (x, y).
function tomato(x, y, size, fresh) {
  const s = size / 24;
  if (fresh) {
    return `<g transform="translate(${x},${y}) scale(${s})">
      <circle cx="12" cy="13.5" r="9.5" fill="#FA320A"/>
      <path fill="#00912D" d="M12 6.2c-1.6-2.4-4.6-2.7-6.2-1.6 1.9.2 3.3 1.1 4 2.5-2.2-.6-4.4.3-5.3 1.9 2.1-.7 4.4-.3 5.9.9-.9 1.1-1.1 2.6-.6 3.8.8-1.4 1.9-2.4 3.3-2.8 1.3.6 2.3 1.7 2.8 3.1.6-1.3.4-2.8-.4-3.9 1.6-1 3.8-1.2 5.7-.3-.9-1.7-3-2.6-5.2-2.1.9-1.3 2.4-2 4.2-2-1.8-1.1-4.7-.6-6.2 1.4l-.2-.9H12z"/>
    </g>`;
  }
  return `<g transform="translate(${x},${y}) scale(${s})">
    <path fill="#0AC855" d="M12 2.5l2 4.6 4.7-2.1-1.4 4.9 5 1.4-4.3 2.8 3 4.1-5.1-.2.2 5.1-4.1-3-2.8 4.3-1.4-5-4.9 1.4 2.1-4.7L.5 13l4.3-2.6L1.6 6.3l5 .7L6.4 2l4.2 3z"/>
  </g>`;
}

// SVG overlay (same size as the poster) with the ratings strip at the bottom.
function overlay(w, h, imdb, rt) {
  const k = w / 342; // designed at 342 px wide
  const pad = 9 * k;
  const stripH = 48 * k;
  const y0 = h - stripH - pad;
  const midY = y0 + stripH / 2;
  const num = 24 * k; // number size
  const parts = [];
  let x = pad + 12 * k;

  if (imdb != null) {
    const label = 'IMDb';
    const lSize = 15.5 * k;
    const lw = textWidth(label, lSize) + 12 * k;
    const lh = 25 * k;
    parts.push(`<rect x="${x}" y="${midY - lh / 2}" width="${lw}" height="${lh}" rx="${4 * k}" fill="#F5C518"/>`);
    parts.push(textPath(label, x + 6 * k, midY + lSize * 0.36, lSize, '#000'));
    x += lw + 7 * k;
    const t = imdb.toFixed(1);
    parts.push(textPath(t, x, midY + num * 0.36, num, '#fff'));
    x += textWidth(t, num) + 16 * k;
  }
  if (rt != null) {
    const icon = 28 * k;
    parts.push(tomato(x, midY - icon / 2, icon, rt >= 60));
    x += icon + 6 * k;
    const t = `${rt}%`;
    parts.push(textPath(t, x, midY + num * 0.36, num, '#fff'));
    x += textWidth(t, num) + 4 * k;
  }
  const stripW = x - pad + 8 * k;
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
      <rect x="${pad}" y="${y0}" width="${stripW}" height="${stripH}" rx="${stripH / 2}" fill="#000" fill-opacity="0.78"/>
      ${parts.join('\n')}
    </svg>`
  );
}

async function render(file, imdb, rt) {
  const res = await fetch(`${TMDB_IMG}/${SIZE}/${file}`, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`poster ${res.status}`);
  const img = sharp(Buffer.from(await res.arrayBuffer()));
  const { width, height } = await img.metadata();
  return img
    .composite([{ input: overlay(width, height, imdb, rt), top: 0, left: 0 }])
    .jpeg({ quality: 82, progressive: true })
    .toBuffer();
}

// "78-92" -> { imdb: 7.8, rt: 92 }; "n" means none.
function parseRatings(s) {
  const m = /^(\d{1,3}|n)-(\d{1,3}|n)$/.exec(s || '');
  if (!m) return null;
  return { imdb: m[1] === 'n' ? null : Number(m[1]) / 10, rt: m[2] === 'n' ? null : Number(m[2]) };
}

// Address of the badged poster for a meta, or the plain poster if there's nothing to show.
function posterUrl(baseUrl, tt, tmdbPosterUrl, imdb, rt) {
  const m = /\/([A-Za-z0-9_-]+\.(?:jpg|png))$/.exec(tmdbPosterUrl || '');
  if (!baseUrl || !m || !/^tt\d+$/.test(tt || '') || (imdb == null && rt == null)) return tmdbPosterUrl;
  const code = `${imdb == null ? 'n' : Math.round(imdb * 10)}-${rt == null ? 'n' : rt}`;
  return `${baseUrl}/poster/${tt}/${code}/${m[1]}`;
}

// Express handler for /poster/:tt/:ratings/:file
async function handler(req, res) {
  const { tt, ratings, file } = req.params;
  const r = parseRatings(ratings);
  if (!/^tt\d+$/.test(tt) || !r || !/^[A-Za-z0-9_-]+\.(jpg|png)$/.test(file)) return res.status(404).end();
  const key = `${ratings}/${file}`;
  try {
    let buf = made.get(key);
    if (!buf) {
      buf = await rendering(() => render(file, r.imdb, r.rt));
      made.set(key, buf);
      if (made.size > MAX) made.delete(made.keys().next().value);
    }
    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=2592000, immutable');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.end(buf);
  } catch (e) {
    console.error(`poster ${key} failed:`, e.message);
    res.redirect(302, `${TMDB_IMG}/w500/${file}`);
  }
}

module.exports = { handler, posterUrl, overlay, render };
