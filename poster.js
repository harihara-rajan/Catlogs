// Posters with badges, drawn on the TMDB poster: an IMDb (/ Rotten Tomatoes) strip along the
// bottom, a service tag in the top-right corner (rows that mix services), and a "NEW · 2d" ribbon
// for recent arrivals. Text is turned into vector shapes from the bundled font
// (assets/Inter-Bold.otf), so it doesn't depend on fonts being installed on the server.
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
const DESIGN = 3; // bump when the badge drawing changes (2: service tag right; 3: NEW ribbon)
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

// Service tags: the service's name as text in a colour close to its brand (no logos).
const TAGS = {
  prime:       { label: 'Prime',       bg: '#00A8E1', fg: '#fff' },
  netflix:     { label: 'Netflix',     bg: '#E50914', fg: '#fff' },
  jiohotstar:  { label: 'JioHotstar',  bg: '#1F3BC9', fg: '#fff' },
  sonyliv:     { label: 'SonyLIV',     bg: '#262626', fg: '#F2C14E' },
  zee5:        { label: 'ZEE5',        bg: '#8230C6', fg: '#fff' },
  aha:         { label: 'aha',         bg: '#FF6A00', fg: '#fff' },
  sunnxt:      { label: 'Sun NXT',     bg: '#F39200', fg: '#1a1a1a' },
  manoramamax: { label: 'ManoramaMAX', bg: '#D71920', fg: '#fff' },
  appletv:     { label: 'Apple TV',    bg: '#111',    fg: '#fff' },
  lionsgate:   { label: 'Lionsgate',   bg: '#1F1F1F', fg: '#fff' },
};

// Tag in the top-right corner (Stremio puts its own library tick top-left): first service, plus
// "+N" if it's on more.
function serviceTag(k, w, services) {
  const known = services.filter((s) => TAGS[s]);
  if (!known.length) return '';
  const tag = TAGS[known[0]];
  const label = known.length > 1 ? `${tag.label} +${known.length - 1}` : tag.label;
  const size = 19.5 * k;
  const h = 37 * k;
  const tw = textWidth(label, size) + 24 * k;
  const x = w - 9 * k - tw;
  const y = 9 * k;
  return `<rect x="${x}" y="${y}" width="${tw}" height="${h}" rx="${8 * k}" fill="${tag.bg}"/>
    <rect x="${x}" y="${y}" width="${tw}" height="${h}" rx="${8 * k}" fill="none" stroke="#000" stroke-opacity="0.25" stroke-width="${1.5 * k}"/>
    ${textPath(label, x + 12 * k, y + h / 2 + size * 0.36, size, tag.fg)}`;
}

// "NEW · today" / "NEW · 3d"
const newLabel = (days) => `NEW · ${days === 0 ? 'today' : `${days}d`}`;

// White "NEW · 2d" chip in a top corner (right, unless a service tag is there).
function newRibbon(k, w, days, left) {
  if (days == null) return '';
  const label = newLabel(days);
  const size = 18 * k;
  const h = 35 * k;
  const tw = textWidth(label, size) + 22 * k;
  const x = left ? 9 * k : w - 9 * k - tw;
  const y = 9 * k;
  return `<rect x="${x}" y="${y}" width="${tw}" height="${h}" rx="${8 * k}" fill="#fff"/>
    <rect x="${x}" y="${y}" width="${tw}" height="${h}" rx="${8 * k}" fill="none" stroke="#000" stroke-opacity="0.18" stroke-width="${1.5 * k}"/>
    ${textPath(label, x + 11 * k, y + h / 2 + size * 0.36, size, '#15121c')}`;
}

// SVG overlay (same size as the poster): ratings strip at the bottom, service tag at the top.
function overlay(w, h, imdb, rt, services = [], newDays = null) {
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
  const strip = imdb != null || rt != null
    ? `<rect x="${pad}" y="${y0}" width="${stripW}" height="${stripH}" rx="${stripH / 2}" fill="#000" fill-opacity="0.78"/>
      ${parts.join('\n')}`
    : '';
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
      ${strip}
      ${serviceTag(k, w, services)}
      ${newRibbon(k, w, newDays, services.length > 0)}
    </svg>`
  );
}

async function render(file, imdb, rt, services, newDays) {
  const res = await fetch(`${TMDB_IMG}/${SIZE}/${file}`, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`poster ${res.status}`);
  const img = sharp(Buffer.from(await res.arrayBuffer()));
  const { width, height } = await img.metadata();
  return img
    .composite([{ input: overlay(width, height, imdb, rt, services, newDays), top: 0, left: 0 }])
    .jpeg({ quality: 82, progressive: true })
    .toBuffer();
}

// "78-92" -> { imdb: 7.8, rt: 92 }; "n" means none.
function parseRatings(s) {
  const m = /^(\d{1,3}|n)-(\d{1,3}|n)$/.exec(s || '');
  if (!m) return null;
  return { imdb: m[1] === 'n' ? null : Number(m[1]) / 10, rt: m[2] === 'n' ? null : Number(m[2]) };
}

// "prime+zee5" -> ['prime', 'zee5'] (known services only); "-" means none.
function parseServices(s) {
  if (!s || s === '-') return [];
  if (!/^[a-z0-9]+(\+[a-z0-9]+)*$/.test(s)) return null;
  const list = s.split('+');
  return list.every((x) => TAGS[x]) ? list : null;
}

// Address of the badged poster for a meta, or the plain poster if there's nothing to show.
// services: service keys to tag the poster with (only for rows that mix services).
// newDays: days since it arrived on the service (0 = today) for a "NEW" ribbon, or null.
function posterUrl(baseUrl, tt, tmdbPosterUrl, imdb, rt, services = [], newDays = null) {
  const m = /\/([A-Za-z0-9_-]+\.(?:jpg|png))$/.exec(tmdbPosterUrl || '');
  const tags = services.filter((x) => TAGS[x]);
  if (!baseUrl || !m || !/^tt\d+$/.test(tt || '') || (imdb == null && rt == null && !tags.length && newDays == null)) return tmdbPosterUrl;
  const code = `${imdb == null ? 'n' : Math.round(imdb * 10)}-${rt == null ? 'n' : rt}`;
  // ?v= changes whenever the drawing changes, so apps re-fetch posters they've cached for good.
  const q = `?v=${DESIGN}${newDays != null ? `&n=${newDays}` : ''}`;
  return tags.length
    ? `${baseUrl}/poster/${tt}/${code}/${tags.join('+')}/${m[1]}${q}`
    : `${baseUrl}/poster/${tt}/${code}/${m[1]}${q}`;
}

// Express handler for /poster/:tt/:ratings/:file and /poster/:tt/:ratings/:services/:file
async function handler(req, res) {
  const { tt, ratings, file } = req.params;
  const r = parseRatings(ratings);
  const services = parseServices(req.params.services);
  const n = req.query && req.query.n;
  const newDays = /^\d{1,2}$/.test(n || '') ? Number(n) : null;
  if (!/^tt\d+$/.test(tt) || !r || !services || !/^[A-Za-z0-9_-]+\.(jpg|png)$/.test(file)) return res.status(404).end();
  const key = `${ratings}/${services.join('+') || '-'}/${newDays ?? '-'}/${file}`;
  try {
    let buf = made.get(key);
    if (!buf) {
      buf = await rendering(() => render(file, r.imdb, r.rt, services, newDays));
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

module.exports = { handler, posterUrl, overlay, render, TAGS, textPath, textWidth, newLabel, made, MAX, rendering, TMDB_IMG };
