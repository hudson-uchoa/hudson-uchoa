// Draws every image of the profile README as an animated SVG.
// No dependencies: `node scripts/build-assets.mjs` rewrites assets/*.svg.
//
// The animations are CSS inside each SVG, so they run when GitHub shows the
// file through <img>, and they stop for readers who ask for reduced motion.

import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const OUT = fileURLToPath(new URL('../assets/', import.meta.url));

const NAME = 'Hudson Uchoa';
const TAGLINE = 'Full-stack developer · São José dos Campos, Brazil';
const TYPED = 'building software that orbits real life';

const C = {
  bg: '#090B1A',
  sky: '#151A45',
  surface: '#0D1024',
  border: '#2A2F5C',
  nebulaA: '#4B3BB8',
  nebulaB: '#8A2F7A',
  text: '#EEF0FF',
  muted: '#A4A9D1',
  accent: '#A99BFF',
  star: '#FFD27A',
  aurora: '#5FE0B4',
};
const SANS = "'Segoe UI', system-ui, -apple-system, 'Helvetica Neue', Arial, sans-serif";
const MONO = "ui-monospace, 'Cascadia Code', 'SF Mono', Consolas, Menlo, monospace";

// A small seeded generator, so every build draws the same sky.
function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const n = (value) => Number(value.toFixed(2));
const esc = (text) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const MOTION = `
  @keyframes twinkle { 0%, 100% { opacity: 0.25 } 50% { opacity: 1 } }
  @keyframes spin { to { transform: rotate(360deg) } }
  @keyframes drift { to { transform: translateX(var(--drift)) } }
  .t1 { animation: twinkle 3.1s ease-in-out infinite }
  .t2 { animation: twinkle 4.7s ease-in-out infinite }
  .t3 { animation: twinkle 6.3s ease-in-out infinite }
  @media (prefers-reduced-motion: reduce) {
    * { animation: none !important }
    .cover, .transient { display: none }
  }`;

function svg(width, height, title, style, body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img">
<title>${esc(title)}</title>
<style>${MOTION}${style}
</style>
${body}
</svg>
`;
}

function stars(random, count, width, height, { minR = 0.6, maxR = 1.9, color = '#FFFFFF' } = {}) {
  let out = '';
  for (let i = 0; i < count; i += 1) {
    const x = n(random() * width);
    const y = n(random() * height);
    const r = n(minR + random() * (maxR - minR));
    const layer = 1 + Math.floor(random() * 3);
    const delay = n(-random() * 6);
    out += `<circle class="t${layer}" style="animation-delay:${delay}s" cx="${x}" cy="${y}" r="${r}" fill="${color}"/>`;
  }
  return out;
}

// A four-point sparkle centred on (x, y), the shape of a lit star.
function sparkle(x, y, r, fill = C.star) {
  const q = n(r * 0.3);
  return `<path fill="${fill}" d="M${x} ${y - r}Q${x + q} ${y - q} ${x + r} ${y}Q${x + q} ${y + q} ${x} ${y + r}Q${x - q} ${y + q} ${x - r} ${y}Q${x - q} ${y - q} ${x} ${y - r}Z"/>`;
}

// The night panel behind the wide images: a gradient, two nebulae, clipped
// to rounded corners so it sits well on a light page too.
function sky(id, width, height, nebulae) {
  const clouds = nebulae
    .map(([cx, cy, r, color, opacity], i) => `<radialGradient id="${id}n${i}"><stop offset="0" stop-color="${color}" stop-opacity="${opacity}"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></radialGradient>`)
    .join('');
  const fills = nebulae
    .map(([cx, cy, r], i) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#${id}n${i})"/>`)
    .join('');
  return {
    defs: `<linearGradient id="${id}g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${C.sky}"/><stop offset="1" stop-color="${C.bg}"/></linearGradient>
<clipPath id="${id}c"><rect width="${width}" height="${height}" rx="24"/></clipPath>${clouds}`,
    open: `<g clip-path="url(#${id}c)"><rect width="${width}" height="${height}" fill="url(#${id}g)"/>${fills}`,
    close: `</g><rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" rx="24" fill="none" stroke="${C.border}"/>`,
  };
}

// A planet: a shaded disc whose bands drift sideways, with an optional ring
// and moons. Everything is sized from the radius.
function planet(id, cx, cy, r, look) {
  const { light, dark, band, ring, moons = [], tilt = -18, spin = 26 } = look;
  const random = seeded(look.seed);
  const span = r * 4;
  let bands = '';
  for (let i = 0; i < 7; i += 1) {
    const y = n(cy - r + (i + 0.5) * ((2 * r) / 7) + (random() - 0.5) * r * 0.12);
    const h = n(r * (0.07 + random() * 0.13));
    const wave = n(r * (0.05 + random() * 0.07));
    const opacity = n(0.2 + random() * 0.35);
    // Two identical periods, so shifting by one period loops without a seam.
    let d = `M${cx - r - span} ${y}`;
    for (let k = 0; k < 8; k += 1) {
      const x0 = cx - r - span + (k * span) / 2;
      d += `Q${n(x0 + span / 8)} ${n(y - wave)} ${n(x0 + span / 4)} ${y}Q${n(x0 + (3 * span) / 8)} ${n(y + wave)} ${n(x0 + span / 2)} ${y}`;
    }
    bands += `<path d="${d}" fill="none" stroke="${band}" stroke-width="${h}" stroke-linecap="round" opacity="${opacity}"/>`;
  }
  const defs = `<radialGradient id="${id}b" cx="0.35" cy="0.3" r="0.9"><stop offset="0" stop-color="${light}"/><stop offset="1" stop-color="${dark}"/></radialGradient>
<radialGradient id="${id}s" cx="0.3" cy="0.25" r="0.95"><stop offset="0" stop-color="#FFFFFF" stop-opacity="0.28"/><stop offset="0.45" stop-color="#FFFFFF" stop-opacity="0"/><stop offset="1" stop-color="#03040C" stop-opacity="0.72"/></radialGradient>
<radialGradient id="${id}h"><stop offset="0.72" stop-color="${light}" stop-opacity="0.34"/><stop offset="1" stop-color="${light}" stop-opacity="0"/></radialGradient>
<clipPath id="${id}d"><circle cx="${cx}" cy="${cy}" r="${r}"/></clipPath>${ring ? `<linearGradient id="${id}r" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${ring}" stop-opacity="0.15"/><stop offset="0.5" stop-color="${ring}" stop-opacity="0.95"/><stop offset="1" stop-color="${ring}" stop-opacity="0.15"/></linearGradient>` : ''}`;
  const rx = n(r * 1.78);
  const ry = n(r * 0.42);
  const ringWidth = n(r * 0.13);
  const back = ring ? `<path d="M${cx - rx} ${cy}A${rx} ${ry} 0 0 1 ${cx + rx} ${cy}" fill="none" stroke="url(#${id}r)" stroke-width="${ringWidth}" opacity="0.55" transform="rotate(${tilt} ${cx} ${cy})"/>` : '';
  const front = ring ? `<path d="M${cx - rx} ${cy}A${rx} ${ry} 0 0 0 ${cx + rx} ${cy}" fill="none" stroke="url(#${id}r)" stroke-width="${ringWidth}" transform="rotate(${tilt} ${cx} ${cy})"/>` : '';
  const orbiting = moons
    .map(([distance, size, seconds, color, start]) => `<g style="transform-origin:${cx}px ${cy}px;animation:spin ${seconds}s linear infinite;animation-delay:${-start}s"><circle cx="${n(cx + r * distance)}" cy="${cy}" r="${n(r * size)}" fill="${color}"/></g>`)
    .join('');
  const body = `<circle cx="${cx}" cy="${cy}" r="${n(r * 1.3)}" fill="url(#${id}h)"/>${back}
<circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#${id}b)"/>
<g clip-path="url(#${id}d)"><g style="--drift:${n(span / 2)}px;animation:drift ${spin}s linear infinite">${bands}</g></g>
<circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#${id}s)"/>${front}${orbiting}`;
  return { defs, body };
}

function hero() {
  const W = 1200;
  const H = 400;
  const random = seeded(20261005);
  const panel = sky('h', W, H, [
    [150, 60, 420, C.nebulaA, 0.3],
    [760, 380, 380, C.nebulaB, 0.24],
    [1080, 120, 300, C.nebulaA, 0.2],
  ]);
  const world = planet('hp', 968, 206, 112, {
    seed: 7,
    light: '#C3B8FF',
    dark: '#3A2A9E',
    band: '#EDE9FF',
    ring: C.star,
    moons: [[1.52, 0.085, 31, '#EEF0FF', 9]],
    tilt: -18,
    spin: 30,
  });
  const textX = 72;
  const pill = { x: textX, y: 286, w: 590, h: 54 };
  const typedX = pill.x + 52;
  const travel = Math.ceil(TYPED.length * 13.2);
  const style = `
  @keyframes shoot { 0% { transform: translate(0, 0); opacity: 0 } 1.5% { opacity: 1 } 9% { transform: translate(430px, 250px); opacity: 0 } 100% { transform: translate(430px, 250px); opacity: 0 } }
  @keyframes type { 0% { transform: translateX(0) } 36% { transform: translateX(${travel}px) } 100% { transform: translateX(${travel}px) } }
  @keyframes blink { 0%, 49% { opacity: 1 } 50%, 100% { opacity: 0 } }
  .shoot { opacity: 0; animation: shoot 12s linear infinite }
  .cover { transform: translateX(${travel}px); animation: type 11s steps(${TYPED.length}, end) infinite }
  .cursor { animation: blink 1s step-end infinite }`;
  const meteor = (x, y, delay) => `<g class="shoot transient" style="animation-delay:${delay}s"><line x1="${x - 88}" y1="${y - 51}" x2="${x}" y2="${y}" stroke="url(#hm)" stroke-width="2.2" stroke-linecap="round"/><circle cx="${x}" cy="${y}" r="2.6" fill="${C.star}"/></g>`;
  const body = `<defs>${panel.defs}${world.defs}
<linearGradient id="hm" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${C.star}" stop-opacity="0"/><stop offset="1" stop-color="${C.star}"/></linearGradient>
<clipPath id="hpill"><rect x="${pill.x}" y="${pill.y}" width="${pill.w}" height="${pill.h}" rx="14"/></clipPath></defs>
${panel.open}
${stars(random, 150, W, H)}
${meteor(470, 34, 1.5)}${meteor(640, 10, 7.5)}
${world.body}
${sparkle(1120, 62, 15)}${sparkle(742, 96, 7)}${sparkle(820, 332, 9)}
<text x="${textX}" y="112" font-family="${MONO}" font-size="19" letter-spacing="3" fill="${C.accent}">HELLO, WORLD. I AM</text>
<text x="${textX - 3}" y="196" font-family="${SANS}" font-size="78" font-weight="700" fill="${C.text}">${esc(NAME)}</text>
<text x="${textX}" y="244" font-family="${SANS}" font-size="25" fill="${C.muted}">${esc(TAGLINE)}</text>
<rect x="${pill.x}" y="${pill.y}" width="${pill.w}" height="${pill.h}" rx="14" fill="${C.surface}" stroke="${C.border}"/>
<text x="${pill.x + 20}" y="${pill.y + 35}" font-family="${MONO}" font-size="21" fill="${C.aurora}">&gt;</text>
<text x="${typedX}" y="${pill.y + 35}" font-family="${MONO}" font-size="21" fill="${C.text}">${esc(TYPED)}</text>
<g clip-path="url(#hpill)"><g class="cover"><rect x="${typedX}" y="${pill.y + 2}" width="${pill.w}" height="${pill.h - 4}" fill="${C.surface}"/><rect class="cursor" x="${typedX + 2}" y="${pill.y + 15}" width="11" height="25" rx="2" fill="${C.accent}"/></g></g>
${panel.close}`;
  return svg(W, H, `${NAME} — ${TAGLINE}`, style, body);
}

function divider() {
  const W = 1200;
  const H = 34;
  const style = `
  @keyframes fly { from { transform: translateX(-140px) } to { transform: translateX(1340px) } }
  .comet { animation: fly 8s linear infinite }`;
  const body = `<defs><linearGradient id="dl" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${C.accent}" stop-opacity="0"/><stop offset="0.5" stop-color="${C.accent}" stop-opacity="0.9"/><stop offset="1" stop-color="${C.accent}" stop-opacity="0"/></linearGradient>
<linearGradient id="dt" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${C.star}" stop-opacity="0"/><stop offset="1" stop-color="${C.star}"/></linearGradient></defs>
<rect x="0" y="16.25" width="${W}" height="1.5" fill="url(#dl)"/>
${sparkle(600, 17, 9)}${sparkle(300, 17, 4, C.accent)}${sparkle(900, 17, 4, C.accent)}
<g class="comet transient"><rect x="-90" y="15.75" width="90" height="2.5" rx="1.25" fill="url(#dt)"/><circle cx="0" cy="17" r="3.4" fill="${C.star}"/></g>`;
  return svg(W, H, 'A comet crossing a thin line of light', style, body);
}

// The stack, drawn as four constellations. Coordinates are relative to each
// group's corner; a label sits centred under its star.
const CONSTELLATIONS = [
  ['Languages', 44, [['TypeScript', 58, 60], ['JavaScript', 198, 36], ['Python', 112, 150], ['PHP', 226, 196]]],
  ['Front end & mobile', 334, [['React', 46, 44], ['React Native', 184, 84], ['Expo', 70, 184], ['HTML & CSS', 206, 214]]],
  ['Back end', 624, [['FastAPI', 62, 36], ['Node.js', 204, 66], ['Laravel', 92, 166], ['Slim', 214, 206]]],
  ['Data & tooling', 906, [['PostgreSQL', 54, 36], ['MySQL', 196, 48], ['Redis', 108, 124], ['SQLite', 224, 134], ['Docker', 56, 214], ['Git', 190, 224]]],
];

function constellation() {
  const W = 1200;
  const H = 430;
  const top = 112;
  const random = seeded(424242);
  const panel = sky('c', W, H, [
    [220, 420, 400, C.nebulaA, 0.24],
    [960, 20, 380, C.nebulaB, 0.2],
  ]);
  const style = `
  @keyframes draw { from { stroke-dashoffset: 900 } }
  @keyframes pulse { 0%, 100% { transform: scale(1) } 50% { transform: scale(1.28) } }
  .line { stroke-dasharray: 900; animation: draw 3.2s ease-out backwards }
  .node { transform-box: fill-box; transform-origin: center; animation: pulse 3.6s ease-in-out infinite }`;
  let groups = '';
  CONSTELLATIONS.forEach(([title, ox, points], g) => {
    const path = points.map(([, x, y], i) => `${i === 0 ? 'M' : 'L'}${ox + x} ${top + y}`).join('');
    const nodes = points
      .map(([label, x, y], i) => `<g class="node" style="animation-delay:${n(-(g * 0.7 + i * 0.45))}s">${sparkle(ox + x, top + y, i === 0 ? 11 : 8.5)}</g>
<text x="${ox + x}" y="${top + y + 32}" text-anchor="middle" font-family="${SANS}" font-size="19" fill="${C.text}" stroke="${C.bg}" stroke-width="6" stroke-linejoin="round" stroke-opacity="0.85" paint-order="stroke">${esc(label)}</text>`)
      .join('\n');
    groups += `<text x="${ox + 130}" y="70" text-anchor="middle" font-family="${MONO}" font-size="16" letter-spacing="2.5" fill="${C.accent}">${esc(title.toUpperCase())}</text>
<path class="line" style="animation-delay:${n(g * 0.5)}s" d="${path}" fill="none" stroke="${C.accent}" stroke-width="1.4" stroke-opacity="0.55" stroke-linejoin="round"/>
${nodes}
`;
  });
  const body = `<defs>${panel.defs}</defs>
${panel.open}
${stars(random, 110, W, H, { maxR: 1.5 })}
${groups}${panel.close}`;
  const names = CONSTELLATIONS.map(([title, , points]) => `${title}: ${points.map(([label]) => label).join(', ')}`).join('. ');
  return svg(W, H, `The stack as four constellations. ${names}.`, style, body);
}

const PLANETS = {
  pawlaris: { seed: 11, light: '#C3B8FF', dark: '#3A2A9E', band: '#EDE9FF', ring: '#FFD27A', tilt: -18, spin: 24 },
  bytewatch: { seed: 23, light: '#8FE9F5', dark: '#0C4E63', band: '#D9FBFF', moons: [[1.5, 0.12, 14, '#EEF0FF', 3]], spin: 20 },
  taskmate: { seed: 37, light: '#8CF0C6', dark: '#0E5A43', band: '#E1FFF3', moons: [[1.42, 0.1, 11, '#FFD27A', 1], [1.78, 0.07, 19, '#EEF0FF', 8]], spin: 28 },
  contacts: { seed: 41, light: '#9CC2FF', dark: '#1B3F8F', band: '#E4EEFF', ring: '#C8A6FF', tilt: 14, spin: 22 },
  magic: { seed: 53, light: '#FFA9E6', dark: '#7A1F66', band: '#FFE3F7', moons: [[1.55, 0.11, 16, '#C8A6FF', 5]], spin: 18 },
  transportadora: { seed: 67, light: '#FFC08F', dark: '#8C3A14', band: '#FFE9D6', ring: '#FFA47A', tilt: -30, spin: 26 },
};

function planetIcon(name) {
  const S = 180;
  const random = seeded(PLANETS[name].seed * 97);
  const world = planet(`p${PLANETS[name].seed}`, 90, 90, 46, PLANETS[name]);
  const body = `<defs>${world.defs}</defs>
${stars(random, 9, S, S, { minR: 0.9, maxR: 1.8, color: C.accent })}
${world.body}`;
  return svg(S, S, `A small planet for ${name}`, '', body);
}

function pill(label) {
  const W = Math.round(64 + label.length * 9.6);
  const H = 44;
  const body = `<rect x="0.75" y="0.75" width="${W - 1.5}" height="${H - 1.5}" rx="21.25" fill="${C.surface}" stroke="${C.accent}" stroke-width="1.5"/>
<g class="t2">${sparkle(26, 22, 8)}</g>
<text x="44" y="27.5" font-family="${SANS}" font-size="16" font-weight="600" fill="${C.text}">${esc(label)}</text>`;
  return svg(W, H, label, '', body);
}

function footer() {
  const W = 1200;
  const H = 230;
  const random = seeded(99);
  const panel = sky('f', W, H, [
    [600, 300, 520, C.nebulaA, 0.34],
    [140, 10, 300, C.nebulaB, 0.18],
  ]);
  const cx = 600;
  const cy = 1090;
  const r = 930;
  const style = `
  @keyframes pass { from { transform: rotate(-22deg) } to { transform: rotate(22deg) } }
  .satellite { transform-origin: ${cx}px ${cy}px; animation: pass 16s linear infinite }`;
  const body = `<defs>${panel.defs}
<radialGradient id="fw" cx="0.5" cy="0" r="1"><stop offset="0" stop-color="#3A2A9E"/><stop offset="1" stop-color="#151A45"/></radialGradient>
<radialGradient id="fa" cx="0.5" cy="0.5" r="0.5"><stop offset="0.975" stop-color="${C.accent}" stop-opacity="0.55"/><stop offset="1" stop-color="${C.accent}" stop-opacity="0"/></radialGradient></defs>
${panel.open}
${stars(random, 90, W, 150)}
<circle cx="${cx}" cy="${cy}" r="${r + 24}" fill="url(#fa)"/>
<circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#fw)"/>
<g class="satellite transient"><circle cx="${cx}" cy="${cy - r - 34}" r="3.6" fill="${C.star}"/><rect x="${cx - 13}" y="${cy - r - 35.2}" width="26" height="2.4" rx="1.2" fill="${C.star}" opacity="0.55"/></g>
<text x="${cx}" y="84" text-anchor="middle" font-family="${SANS}" font-size="30" font-weight="700" fill="${C.text}">Thanks for stopping by. Clear skies.</text>
<text x="${cx}" y="120" text-anchor="middle" font-family="${MONO}" font-size="16" fill="${C.muted}">every animation here is an SVG drawn by a script in this repository</text>
${panel.close}`;
  return svg(W, H, 'Thanks for stopping by. Clear skies.', style, body);
}

mkdirSync(OUT, { recursive: true });
const files = {
  'hero.svg': hero(),
  'divider.svg': divider(),
  'constellation.svg': constellation(),
  'footer.svg': footer(),
  'pill-repositories.svg': pill('All repositories'),
  'pill-linkedin.svg': pill('LinkedIn'),
  'pill-instagram.svg': pill('Instagram'),
};
for (const name of Object.keys(PLANETS)) files[`planet-${name}.svg`] = planetIcon(name);
for (const [name, content] of Object.entries(files)) {
  writeFileSync(OUT + name, content);
  console.log(`${String(content.length).padStart(6)} bytes  assets/${name}`);
}
