// The addon's own artwork, drawn at start-up: an icon (shown in Stremio's addon list) and a
// background (shown on the addon's page in Stremio). Text is turned into shapes from the bundled
// font, so nothing depends on fonts installed on the server.

const path = require('path');
const sharp = require('sharp');
const opentype = require('opentype.js');

const font = opentype.loadSync(path.join(__dirname, 'assets', 'Inter-Bold.otf'));
const text = (s, x, y, size, fill, extra = '') =>
  `<path fill="${fill}" ${extra} d="${font.getPath(s, x, y, size).toPathData(1)}"/>`;
const width = (s, size) => font.getAdvanceWidth(s, size);

// Icon: rounded square in a violet-to-coral gradient, three "rows" on the left and a play mark.
const ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#6D4AFF"/>
      <stop offset="0.55" stop-color="#B248D8"/>
      <stop offset="1" stop-color="#FF6B5A"/>
    </linearGradient>
    <linearGradient id="shine" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#fff" stop-opacity="0.22"/>
      <stop offset="0.5" stop-color="#fff" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="112" fill="url(#bg)"/>
  <rect width="512" height="512" rx="112" fill="url(#shine)"/>
  <rect x="96"  y="150" width="120" height="40" rx="20" fill="#fff" fill-opacity="0.95"/>
  <rect x="96"  y="236" width="88"  height="40" rx="20" fill="#fff" fill-opacity="0.75"/>
  <rect x="96"  y="322" width="56"  height="40" rx="20" fill="#fff" fill-opacity="0.55"/>
  <path d="M262 150 Q262 124 285 136 L410 236 Q430 256 410 276 L285 376 Q262 388 262 362 Z" fill="#fff"/>
</svg>`;

// Background: dark with soft colour glows, the icon and a wordmark.
function backgroundSvg() {
  const W = 1920;
  const H = 1080;
  const title = 'OTT Catalogs';
  const sub = 'Tamil · Malayalam · Hindi · English — newest first, rated, on your services';
  const tSize = 120;
  const sSize = 38;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <defs>
      <radialGradient id="a" cx="0.18" cy="0.25" r="0.55"><stop offset="0" stop-color="#6D4AFF" stop-opacity="0.55"/><stop offset="1" stop-color="#6D4AFF" stop-opacity="0"/></radialGradient>
      <radialGradient id="b" cx="0.85" cy="0.8" r="0.6"><stop offset="0" stop-color="#FF6B5A" stop-opacity="0.42"/><stop offset="1" stop-color="#FF6B5A" stop-opacity="0"/></radialGradient>
      <radialGradient id="c" cx="0.62" cy="0.12" r="0.45"><stop offset="0" stop-color="#1FB6C9" stop-opacity="0.30"/><stop offset="1" stop-color="#1FB6C9" stop-opacity="0"/></radialGradient>
    </defs>
    <rect width="${W}" height="${H}" fill="#0E0C15"/>
    <rect width="${W}" height="${H}" fill="url(#a)"/>
    <rect width="${W}" height="${H}" fill="url(#b)"/>
    <rect width="${W}" height="${H}" fill="url(#c)"/>
    <g transform="translate(${(W - 220) / 2}, 300) scale(${220 / 512})">${ICON_SVG.replace(/<\/?svg[^>]*>/g, '')}</g>
    ${text(title, (W - width(title, tSize)) / 2, 660, tSize, '#fff')}
    ${text(sub, (W - width(sub, sSize)) / 2, 740, sSize, '#CFCBE0')}
  </svg>`;
}

let made = null;
async function build() {
  if (!made) {
    made = Promise.all([
      sharp(Buffer.from(ICON_SVG)).resize(256, 256).png().toBuffer(),
      sharp(Buffer.from(backgroundSvg())).jpeg({ quality: 84, progressive: true }).toBuffer(),
    ]).then(([logo, background]) => ({ logo, background }));
  }
  return made;
}

function route(kind, type) {
  return async (req, res) => {
    try {
      const a = await build();
      res.setHeader('Content-Type', type);
      res.setHeader('Cache-Control', 'public, max-age=604800');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.end(a[kind]);
    } catch (e) {
      console.error(`${kind} failed:`, e.message);
      res.status(500).end();
    }
  };
}

module.exports = { build, logoRoute: route('logo', 'image/png'), backgroundRoute: route('background', 'image/jpeg'), ICON_SVG };
