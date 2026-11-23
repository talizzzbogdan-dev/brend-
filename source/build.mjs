import { build } from 'esbuild';
import fs from 'fs';

// ---- настройки, которые меняются под себя ----
const TG = process.env.TG_URL || 'https://t.me/pluuuto';
const TG_HANDLE = '@' + TG.split('/').pop();
const MAIN = process.env.MAIN_URL || 'https://tocchhka.pro/'; // основная ТОЧКА
const MAIN_LABEL = MAIN.replace(/^https?:\/\//, '').replace(/\/$/, '');
const BOT = process.env.BOT_URL || '#stylist'; // потом подставишь ссылку на бота

const out = await build({
  entryPoints: ['src/main.js'], bundle: true, minify: true, format: 'iife',
  write: false, target: 'es2020', legalComments: 'none',
});
const js = out.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');

const b64 = (p) => fs.readFileSync(p).toString('base64');
const F = 'node_modules/@fontsource';
const LAT = 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD';
const CYR = 'U+0301,U+0400-045F,U+0490-0491,U+04B0-04B1,U+2116';
const face = (fam, w, file, range) =>
  `@font-face{font-family:'${fam}';font-style:normal;font-weight:${w};font-display:swap;src:url(data:font/woff2;base64,${b64(file)}) format('woff2');unicode-range:${range}}`;
const fonts = [
  face('Unbounded', 700, `${F}/unbounded/files/unbounded-cyrillic-700-normal.woff2`, CYR),
  face('Unbounded', 700, `${F}/unbounded/files/unbounded-latin-700-normal.woff2`, LAT),
  face('Onest', 400, `${F}/onest/files/onest-cyrillic-400-normal.woff2`, CYR),
  face('Onest', 400, `${F}/onest/files/onest-latin-400-normal.woff2`, LAT),
  face('Onest', 500, `${F}/onest/files/onest-cyrillic-500-normal.woff2`, CYR),
  face('Onest', 500, `${F}/onest/files/onest-latin-500-normal.woff2`, LAT),
].join('\n');

const buttonSvg = (cls = '') =>
  `<svg class="btn ${cls}" viewBox="0 0 100 100" aria-hidden="true" focusable="false">` +
  `<circle cx="50" cy="50" r="48" fill="#2B3BFF"/>` +
  `<circle cx="50" cy="50" r="35" fill="none" stroke="rgba(255,255,255,.3)" stroke-width="3"/>` +
  [[40, 40], [60, 40], [40, 60], [60, 60]].map(([x, y]) => `<circle class="hole" cx="${x}" cy="${y}" r="5.2"/>`).join('') +
  `<path class="st" pathLength="1" d="M40 40L60 60M60 40L40 60" stroke="#F2EEE6" stroke-width="2.4" stroke-linecap="round" fill="none"/></svg>`;

const staticBtn = fs.readFileSync('brand/tochka-mark.svg', 'utf8');
const enc = (s) => encodeURIComponent(s).replace(/'/g, '%27').replace(/"/g, '%22');

let html = fs.readFileSync('src/index.template.html', 'utf8');
const map = {
  '{{FONTS}}': fonts,
  '{{BUTTON}}': buttonSvg(),
  '{{FAVICON}}': enc(staticBtn),
  '{{BTN_URI}}': enc(staticBtn),
  '{{MAIN}}': MAIN, '{{MAIN_LABEL}}': MAIN_LABEL, '{{TG}}': TG, '{{TG_HANDLE}}': TG_HANDLE, '{{BOT}}': BOT,
};
for (const [k, v] of Object.entries(map)) html = html.split(k).join(v);
html = html.split('{{JS}}').join(js); // JS последним, чтобы не трогать его содержимое
fs.mkdirSync('dist', { recursive: true });
fs.writeFileSync('dist/index.html', html);
console.log('dist/index.html', (html.length / 1024).toFixed(0) + ' KB');
