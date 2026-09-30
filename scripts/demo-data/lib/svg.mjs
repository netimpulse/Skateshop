// SVG primitives and skate-part drawings for the demo images.
// Style: design/system.md „Clean White + light Retro“ – flat colours, no gradients, no photos, no third-party logos.

export const C = {
  bg: '#F4F2EE', // --color-surface (product image background)
  line: '#E4E1DA',
  ink: '#1C1D1B',
  ink2: '#5B5A55',
  accent: '#C8401F',
  blue: '#2B4BD8',
  orange: '#F26B1D',
  lime: '#C9E43A',
  yellow: '#F6C945',
  white: '#FFFFFF',
  cream: '#FBF6EA',
  paper: '#FAFAF8',
  metal: '#C4C7CA',
  metalDark: '#8D9195',
  metalDeep: '#5E6266',
  grip: '#2A2B29',
  wood: '#D8B98A',
};

export const FONT = "'Liberation Sans','DejaVu Sans',Arial,sans-serif";
export const MONO = "'DejaVu Sans Mono','Liberation Mono',monospace";

const n = (v) => (Math.round(v * 10) / 10).toString();
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

let uidCounter = 0;
export const uid = (prefix = 'u') => `${prefix}${++uidCounter}`;

export const rect = (x, y, w, h, fill, extra = '') =>
  `<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" fill="${fill}" ${extra}/>`;
export const circle = (cx, cy, r, fill, extra = '') => `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r)}" fill="${fill}" ${extra}/>`;
export const ellipse = (cx, cy, rx, ry, fill, extra = '') =>
  `<ellipse cx="${n(cx)}" cy="${n(cy)}" rx="${n(rx)}" ry="${n(ry)}" fill="${fill}" ${extra}/>`;
export const poly = (pts, fill, extra = '') => `<polygon points="${pts.map(([x, y]) => `${n(x)},${n(y)}`).join(' ')}" fill="${fill}" ${extra}/>`;
export const path = (d, fill, extra = '') => `<path d="${d}" fill="${fill}" ${extra}/>`;
export const line = (x1, y1, x2, y2, stroke, width = 2, extra = '') =>
  `<line x1="${n(x1)}" y1="${n(y1)}" x2="${n(x2)}" y2="${n(y2)}" stroke="${stroke}" stroke-width="${width}" ${extra}/>`;
export const g = (content, transform = '', extra = '') => `<g${transform ? ` transform="${transform}"` : ''} ${extra}>${content}</g>`;

export function text(x, y, str, { size = 28, fill = C.ink, family = MONO, weight = 500, anchor = 'start', spacing = 0, extra = '' } = {}) {
  return `<text x="${n(x)}" y="${n(y)}" font-family="${family}" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}" letter-spacing="${spacing}" ${extra}>${esc(str)}</text>`;
}

/** Text along a circular arc (top arc when `bottom` is false). */
export function arcText(cx, cy, r, str, { size = 30, fill = C.ink, family = MONO, weight = 700, spacing = 4, bottom = false } = {}) {
  const id = uid('arc');
  const d = bottom
    ? `M ${n(cx - r)} ${n(cy)} A ${n(r)} ${n(r)} 0 0 0 ${n(cx + r)} ${n(cy)}`
    : `M ${n(cx - r)} ${n(cy)} A ${n(r)} ${n(r)} 0 0 1 ${n(cx + r)} ${n(cy)}`;
  return `<path id="${id}" d="${d}" fill="none"/><text font-family="${family}" font-size="${size}" font-weight="${weight}" fill="${fill}" letter-spacing="${spacing}" ${bottom ? 'dominant-baseline="hanging"' : ''}><textPath href="#${id}" startOffset="50%" text-anchor="middle">${esc(str)}</textPath></text>`;
}

export function star(cx, cy, r, fill, points = 5, inner = 0.45, rotation = -90) {
  const pts = [];
  for (let i = 0; i < points * 2; i++) {
    const radius = i % 2 === 0 ? r : r * inner;
    const angle = ((rotation + (i * 180) / points) * Math.PI) / 180;
    pts.push([cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius]);
  }
  return poly(pts, fill);
}

export const sparkle = (cx, cy, r, fill) => star(cx, cy, r, fill, 4, 0.22, -90);

export function hexagon(cx, cy, r, fill, extra = '') {
  const pts = [];
  for (let i = 0; i < 6; i++) {
    const a = ((60 * i) * Math.PI) / 180;
    pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  return poly(pts, fill, extra);
}

export function mix(a, b, t) {
  const pa = a.match(/\w\w/g).map((h) => parseInt(h, 16));
  const pb = b.match(/\w\w/g).map((h) => parseInt(h, 16));
  return `#${pa.map((v, i) => Math.round(v + (pb[i] - v) * t).toString(16).padStart(2, '0')).join('')}`;
}

/** Relative luminance check – true when a colour is light. */
export function isLight(hex) {
  const [r, gg, b] = hex.match(/\w\w/g).map((h) => parseInt(h, 16) / 255);
  return 0.2126 * r + 0.7152 * gg + 0.0722 * b > 0.6;
}

export function hash(str) {
  let h = 2166136261;
  for (const ch of String(str)) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function rng(seed) {
  let a = typeof seed === 'number' ? seed : hash(seed);
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const svgDoc = (w, h, body, bg = null) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${bg ? rect(0, 0, w, h, bg) : ''}${body}</svg>`;

/** Three short retro stripes (accent / orange / yellow). */
export function triStripe(x, y, w, h, gap = h * 0.6) {
  return rect(x, y, w, h, C.accent) + rect(x, y + h + gap, w, h, C.orange) + rect(x, y + 2 * (h + gap), w, h, C.yellow);
}

/** Grit texture as an SVG pattern definition. Returns { defs, fill }. */
export function gritPattern(seed, { dot = C.white, opacity = 0.22, density = 38, tile = 64 } = {}) {
  const id = uid('grit');
  const rand = rng(seed);
  let dots = '';
  for (let i = 0; i < density; i++) {
    dots += circle(rand() * tile, rand() * tile, 0.6 + rand() * 1.6, dot, `opacity="${(opacity * (0.5 + rand())).toFixed(2)}"`);
  }
  return { defs: `<pattern id="${id}" width="${tile}" height="${tile}" patternUnits="userSpaceOnUse">${dots}</pattern>`, fill: `url(#${id})` };
}

/* ------------------------------------------------------------------ */
/* Decks                                                               */
/* ------------------------------------------------------------------ */

/** Deck outline in portrait orientation (nose at the top). */
export function deckPath(x, y, W, L, shape = 'popsicle') {
  if (shape === 'cruiser') {
    const ry = W * 0.62;
    return `M${n(x)},${n(y + ry)} C${n(x)},${n(y + ry * 0.1)} ${n(x + W * 0.16)},${n(y)} ${n(x + W / 2)},${n(y)} C${n(x + W * 0.84)},${n(y)} ${n(x + W)},${n(y + ry * 0.1)} ${n(x + W)},${n(y + ry)} L${n(x + W)},${n(y + L * 0.72)} C${n(x + W)},${n(y + L * 0.9)} ${n(x + W * 0.78)},${n(y + L)} ${n(x + W / 2)},${n(y + L)} C${n(x + W * 0.22)},${n(y + L)} ${n(x)},${n(y + L * 0.9)} ${n(x)},${n(y + L * 0.72)} Z`;
  }
  const ry = shape === 'shaped' ? W * 0.5 : W * 0.62;
  const k = shape === 'shaped' ? 0.04 : 0.16;
  const t = shape === 'shaped' ? 0.12 : 0.2;
  return `M${n(x)},${n(y + ry)} C${n(x)},${n(y + ry * k)} ${n(x + W * t)},${n(y)} ${n(x + W / 2)},${n(y)} C${n(x + W * (1 - t))},${n(y)} ${n(x + W)},${n(y + ry * k)} ${n(x + W)},${n(y + ry)} L${n(x + W)},${n(y + L - ry)} C${n(x + W)},${n(y + L - ry * k)} ${n(x + W * (1 - t))},${n(y + L)} ${n(x + W / 2)},${n(y + L)} C${n(x + W * t)},${n(y + L)} ${n(x)},${n(y + L - ry * k)} ${n(x)},${n(y + L - ry)} Z`;
}

/** Vertical wordmark (reads top → bottom, becomes horizontal in the landscape preview layer). */
function wordmark(x, y, str, fill, size) {
  return g(text(0, 0, str.toUpperCase(), { size, fill, family: MONO, weight: 700, spacing: size * 0.18, anchor: 'middle' }), `translate(${n(x)} ${n(y)}) rotate(90)`);
}

/**
 * Deck bottom graphics. Each motif fills the box (0,0)–(w,h) in portrait orientation (nose at the top)
 * and bleeds past the edges – callers clip it to the deck outline.
 */
export const DECK_MOTIFS = {
  sunset: {
    color: C.accent,
    draw(w, h, brand) {
      const cx = w / 2;
      const cy = h * 0.4;
      const R = w * 0.44;
      let s = rect(-10, -10, w + 20, h + 20, C.yellow);
      for (let i = 0; i < 9; i++) s += rect(-10, h * 0.03 + i * h * 0.022, w + 20, h * 0.006, C.orange, 'opacity="0.55"');
      s += circle(cx, cy, R, C.accent);
      for (let i = 0; i < 6; i++) s += rect(-10, cy + R * 0.1 + i * R * 0.16, w + 20, R * 0.03 + i * R * 0.016, C.yellow);
      const gy = h * 0.58;
      s += rect(-10, gy, w + 20, h * 0.05, C.orange) + rect(-10, gy + h * 0.05, w + 20, h * 0.05, C.accent) + rect(-10, gy + h * 0.1, w + 20, h, C.ink);
      s += sparkle(cx, h * 0.14, w * 0.1, C.ink);
      s += wordmark(cx, h * 0.82, brand, C.yellow, w * 0.085);
      return s;
    },
  },
  checker: {
    color: C.ink,
    draw(w, h, brand) {
      const q = w / 5;
      let s = rect(-10, -10, w + 20, h + 20, C.cream);
      for (let row = 0; row * q < h + q; row++) {
        for (let col = -1; col * q < w + q; col++) if ((row + col) % 2 === 0) s += rect(col * q, row * q, q, q, C.ink);
      }
      const cy = h * 0.5;
      s += circle(w / 2, cy, w * 0.42, C.cream) + circle(w / 2, cy, w * 0.36, C.accent) + circle(w / 2, cy, w * 0.22, C.cream) + star(w / 2, cy, w * 0.15, C.ink);
      s += rect(-10, h * 0.76, w + 20, h * 0.1, C.accent);
      s += wordmark(w / 2, h * 0.81, brand, C.cream, w * 0.075);
      return s;
    },
  },
  orbit: {
    color: C.blue,
    draw(w, h, brand) {
      let s = rect(-10, -10, w + 20, h + 20, C.blue);
      const colors = [C.lime, C.blue, C.cream, C.blue];
      for (let i = 0; i < 12; i++) s += circle(w / 2, h * 0.5, w * 1.5 - i * w * 0.125, colors[i % 4]);
      s += circle(w / 2, h * 0.5, w * 0.08, C.ink);
      s += circle(w / 2, h * 0.13, w * 0.16, C.lime) + circle(w / 2, h * 0.13, w * 0.08, C.blue);
      s += circle(w / 2, h * 0.87, w * 0.16, C.lime) + circle(w / 2, h * 0.87, w * 0.08, C.blue);
      s += wordmark(w * 0.5, h * 0.24, brand, C.cream, w * 0.07);
      return s;
    },
  },
  voltage: {
    color: C.yellow,
    draw(w, h, brand) {
      let s = rect(-10, -10, w + 20, h + 20, C.ink);
      for (let y = h * 0.02; y < h; y += w * 0.14) for (let x = w * 0.07; x < w; x += w * 0.14) s += circle(x, y, w * 0.012, C.cream, 'opacity="0.35"');
      const bolt = [
        [0.78, 0.05], [0.18, 0.54], [0.5, 0.54], [0.24, 0.95], [0.86, 0.42], [0.54, 0.42], [0.86, 0.05],
      ].map(([x, y]) => [x * w, y * h]);
      s += g(poly(bolt, C.orange), `translate(${n(w * 0.05)} ${n(h * 0.012)})`);
      s += poly(bolt, C.yellow);
      s += wordmark(w * 0.2, h * 0.2, brand, C.cream, w * 0.07);
      return s;
    },
  },
  tristripe: {
    color: C.orange,
    draw(w, h, brand) {
      let s = rect(-10, -10, w + 20, h + 20, C.cream);
      const band = (cy) => {
        const bw = w * 0.26;
        return g(rect(-w, -bw * 1.5 - 12, w * 3, bw, C.accent) + rect(-w, -bw * 0.5, w * 3, bw, C.orange) + rect(-w, bw * 0.5 + 12, w * 3, bw, C.yellow), `translate(${n(w / 2)} ${n(cy)}) rotate(-32)`);
      };
      s += band(h * 0.3) + band(h * 0.68);
      s += rect(-10, -10, w + 20, h * 0.1 + 10, C.ink) + rect(-10, h * 0.9, w + 20, h * 0.1 + 10, C.ink);
      s += circle(w / 2, h * 0.49, w * 0.14, C.ink) + circle(w / 2, h * 0.49, w * 0.06, C.cream);
      s += wordmark(w / 2, h * 0.95, brand, C.cream, w * 0.06);
      return s;
    },
  },
  polka: {
    color: C.lime,
    draw(w, h, brand) {
      let s = rect(-10, -10, w + 20, h + 20, C.lime);
      const step = w * 0.2;
      for (let row = 0, y = step / 2; y < h + step; row++, y += step * 0.87) {
        for (let x = row % 2 ? 0 : step / 2; x < w + step; x += step) s += circle(x, y, w * 0.045, C.ink);
      }
      s += rect(-10, h * 0.41, w + 20, h * 0.18, C.ink);
      s += circle(w / 2, h * 0.5, w * 0.24, C.cream) + circle(w / 2, h * 0.5, w * 0.16, C.accent) + circle(w / 2, h * 0.5, w * 0.06, C.cream);
      s += rect(-10, h * 0.88, w + 20, h * 0.012, C.ink) + rect(-10, h * 0.9, w + 20, h * 0.012, C.ink);
      s += wordmark(w * 0.5, h * 0.2, brand, C.ink, w * 0.075);
      return s;
    },
  },
  waves: {
    color: C.blue,
    draw(w, h, brand) {
      let s = rect(-10, -10, w + 20, h + 20, C.cream);
      s += circle(w / 2, h * 0.17, w * 0.3, C.yellow);
      for (let i = 0; i < 4; i++) s += rect(-10, h * 0.17 + w * 0.06 + i * w * 0.07, w + 20, w * 0.018 + i * 0.008 * w, C.cream);
      const colors = [C.blue, C.cream, C.blue, C.ink, C.blue, C.cream, C.ink];
      colors.forEach((color, i) => {
        const y0 = h * 0.34 + i * h * 0.085;
        const amp = w * 0.06;
        const period = w / 1.5;
        let d = `M -20 ${n(y0)}`;
        for (let x = -20; x <= w + 20; x += 10) d += ` L ${n(x)} ${n(y0 + Math.sin((x / period) * Math.PI * 2 + i) * amp)}`;
        d += ` L ${n(w + 20)} ${n(h + 20)} L -20 ${n(h + 20)} Z`;
        s += path(d, color);
      });
      s += wordmark(w * 0.5, h * 0.82, brand, C.yellow, w * 0.065);
      return s;
    },
  },
  peaks: {
    color: C.accent,
    draw(w, h, brand) {
      let s = rect(-10, -10, w + 20, h + 20, C.yellow);
      s += circle(w * 0.5, h * 0.22, w * 0.3, C.orange);
      for (let i = 0; i < 5; i++) s += rect(-10, h * 0.25 + i * w * 0.06, w + 20, w * 0.016 + i * w * 0.006, C.yellow);
      s += poly([[-w * 0.7, h * 0.74], [w * 0.32, h * 0.38], [w * 1.2, h * 0.74]], C.ink);
      s += poly([[w * 0.32, h * 0.38], [w * 0.2, h * 0.43], [w * 0.32, h * 0.415], [w * 0.44, h * 0.43]], C.cream);
      s += poly([[-w * 0.1, h * 0.74], [w * 0.78, h * 0.47], [w * 1.7, h * 0.74]], C.accent);
      s += poly([[w * 0.78, h * 0.47], [w * 0.66, h * 0.51], [w * 0.78, h * 0.5], [w * 0.9, h * 0.51]], C.cream);
      s += rect(-10, h * 0.74, w + 20, h, C.ink);
      s += rect(-10, h * 0.76, w + 20, h * 0.01, C.accent) + rect(-10, h * 0.775, w + 20, h * 0.01, C.orange) + rect(-10, h * 0.79, w + 20, h * 0.01, C.yellow);
      s += wordmark(w * 0.5, h * 0.9, brand, C.yellow, w * 0.07);
      return s;
    },
  },
};

/** Bolt hole positions (8 holes) for a portrait deck. */
function boltHoles(x, y, W, L, lengthIn, wheelbaseIn) {
  const s = L / lengthIn;
  const cx = x + W / 2;
  const cy = y + L / 2;
  const holes = [];
  for (const dir of [-1, 1]) {
    for (const dy of [wheelbaseIn / 2, wheelbaseIn / 2 + 2.125]) {
      for (const dx of [-0.8125, 0.8125]) holes.push([cx + dx * s, cy + dir * dy * s]);
    }
  }
  return { holes, scale: s, mounts: [cy - (wheelbaseIn / 2 + 1.0625) * s, cy + (wheelbaseIn / 2 + 1.0625) * s] };
}

/** Deck bottom with graphic. */
export function deckBottom(x, y, W, L, { shape, motif, brand, lengthIn = 32, wheelbaseIn = 14.25, holes = true, shadow = true }) {
  const d = deckPath(x, y, W, L, shape);
  const clip = uid('deck');
  const art = DECK_MOTIFS[motif];
  let s = `<defs><clipPath id="${clip}"><path d="${d}"/></clipPath></defs>`;
  if (shadow) s += g(path(d, C.ink, 'opacity="0.08"'), `translate(${n(W * 0.05)} ${n(W * 0.04)})`);
  s += `<g clip-path="url(#${clip})">${g(art.draw(W, L, brand), `translate(${n(x)} ${n(y)})`)}</g>`;
  s += path(d, 'none', `stroke="${C.ink}" stroke-opacity="0.18" stroke-width="${n(Math.max(2, W * 0.006))}"`);
  if (holes) {
    const { holes: pts, scale } = boltHoles(x, y, W, L, lengthIn, wheelbaseIn);
    for (const [hx, hy] of pts) s += circle(hx, hy, scale * 0.16, C.ink, 'opacity="0.85"') + circle(hx, hy, scale * 0.16, 'none', `stroke="${C.cream}" stroke-opacity="0.6" stroke-width="2"`);
  }
  return s;
}

/** Deck top with griptape (shows a sliver of the graphic along the right edge). */
export function deckTop(x, y, W, L, { shape, motif, lengthIn = 32, wheelbaseIn = 14.25, seed = 'grip', gripColor = C.grip, bolts = C.metal }) {
  const d = deckPath(x, y, W, L, shape);
  const edge = DECK_MOTIFS[motif]?.color || C.wood;
  const grit = gritPattern(seed, { dot: isLight(gripColor) ? C.ink : C.white, opacity: 0.25 });
  let s = `<defs>${grit.defs}</defs>`;
  s += g(path(d, C.ink, 'opacity="0.08"'), `translate(${n(W * 0.05)} ${n(W * 0.04)})`);
  s += g(path(d, C.wood), `translate(${n(W * 0.022)} ${n(W * 0.01)})`);
  s += g(path(d, edge), `translate(${n(W * 0.03)} ${n(W * 0.018)})`);
  s += path(d, gripColor) + path(d, grit.fill);
  const { holes, scale } = boltHoles(x, y, W, L, lengthIn, wheelbaseIn);
  for (const [hx, hy] of holes) {
    s += circle(hx, hy, scale * 0.2, bolts) + circle(hx, hy, scale * 0.2, 'none', `stroke="${C.ink}" stroke-opacity="0.35" stroke-width="2"`);
    s += hexagon(hx, hy, scale * 0.07, C.ink, 'opacity="0.6"');
  }
  return s;
}

/** Trucks, wheels and deck seen from below (complete). */
export function completeBottom(x, y, W, L, { shape, motif, brand, lengthIn, wheelbaseIn, truckColor = C.metal, wheelColor = C.cream }) {
  const scale = L / lengthIn;
  const { mounts } = boltHoles(x, y, W, L, lengthIn, wheelbaseIn);
  let s = deckBottom(x, y, W, L, { shape, motif, brand, lengthIn, wheelbaseIn, holes: false, shadow: true });
  const cx = x + W / 2;
  for (const my of mounts) {
    // wheels
    for (const dir of [-1, 1]) {
      const wx = cx + dir * (W / 2 + scale * 0.35);
      s += rect(wx - scale * 0.7, my + scale * 0.35 - scale * 1.05, scale * 1.4, scale * 2.1, C.ink, `rx="${n(scale * 0.45)}" opacity="0.1" transform="translate(${n(scale * 0.2)} ${n(scale * 0.2)})"`);
      s += rect(wx - scale * 0.7, my + scale * 0.35 - scale * 1.05, scale * 1.4, scale * 2.1, wheelColor, `rx="${n(scale * 0.45)}" stroke="${C.ink}" stroke-opacity="0.25" stroke-width="2"`);
      s += rect(wx - scale * 0.7, my + scale * 0.35 - scale * 0.14, scale * 1.4, scale * 0.28, C.ink, 'opacity="0.12"');
    }
    // axle + hanger
    s += rect(cx - W / 2 - scale * 0.2, my + scale * 0.28, W + scale * 0.4, scale * 0.16, C.metalDark);
    s += rect(cx - W * 0.42, my + scale * 0.05, W * 0.84, scale * 0.6, truckColor, `rx="${n(scale * 0.28)}" stroke="${C.ink}" stroke-opacity="0.22" stroke-width="2"`);
    // baseplate + kingpin
    s += rect(cx - scale * 1.05, my - scale * 1.25, scale * 2.1, scale * 2.5, truckColor, `rx="${n(scale * 0.3)}" stroke="${C.ink}" stroke-opacity="0.22" stroke-width="2"`);
    for (const [dx, dy] of [[-0.8125, -1.0625], [0.8125, -1.0625], [-0.8125, 1.0625], [0.8125, 1.0625]]) s += hexagon(cx + dx * scale, my + dy * scale, scale * 0.13, C.metalDeep);
    s += circle(cx, my + scale * 0.35, scale * 0.3, C.yellow, `stroke="${C.ink}" stroke-opacity="0.3" stroke-width="2"`) + hexagon(cx, my + scale * 0.35, scale * 0.17, C.metalDeep);
  }
  return s;
}

/* ------------------------------------------------------------------ */
/* Trucks                                                              */
/* ------------------------------------------------------------------ */

/** Truck front view, about 1420 × 430 at scale 1, origin at top centre of the baseplate. */
export function truckFront(cx, y, scale, { color, base = C.metal, bushing = C.yellow }) {
  const stroke = `stroke="${C.ink}" stroke-opacity="0.25" stroke-width="3"`;
  let s = '';
  // axle + speed rings + nuts
  s += rect(-668, 321, 1336, 30, C.metalDark, 'rx="6"');
  s += rect(-606, 308, 14, 56, C.metal) + rect(592, 308, 14, 56, C.metal);
  s += rect(-712, 304, 50, 64, C.metalDeep, 'rx="8"') + rect(662, 304, 50, 64, C.metalDeep, 'rx="8"');
  // kingpin (behind everything else in the centre)
  s += rect(-18, 30, 36, 400, C.metalDark);
  // hanger with flat retro shading
  s += path('M -580 300 L -170 186 Q -120 170 -95 170 L 95 170 Q 120 170 170 186 L 580 300 L 580 372 L 170 345 Q 120 300 0 300 Q -120 300 -170 345 L -580 372 Z', color, stroke);
  s += path('M -580 300 L -170 186 Q -120 170 -95 170 L 95 170 Q 120 170 170 186 L 580 300 L 580 316 L 170 204 Q 120 188 95 188 L -95 188 Q -120 188 -170 204 L -580 316 Z', C.white, 'opacity="0.22"');
  s += path('M -580 352 L 170 326 L 580 352 L 580 372 L 170 345 Q 120 312 0 312 Q -120 312 -170 345 L -580 372 Z', C.ink, 'opacity="0.14"');
  // washers, bushings, nut
  s += rect(-82, 100, 164, 14, C.metalDark, 'rx="4"');
  s += rect(-70, 114, 140, 56, bushing, `rx="18" ${stroke}`);
  s += rect(-64, 300, 128, 50, bushing, `rx="18" ${stroke}`);
  s += rect(-80, 350, 160, 14, C.metalDark, 'rx="4"');
  s += rect(-44, 364, 88, 50, C.metalDeep, 'rx="8"');
  // baseplate
  s += poly([[-112, 52], [112, 52], [92, 100], [-92, 100]], base, stroke);
  s += rect(-270, 0, 540, 58, base, `rx="10" ${stroke}`);
  s += rect(-270, 0, 540, 14, C.white, 'rx="7" opacity="0.2"');
  return g(s, `translate(${n(cx)} ${n(y)}) scale(${scale})`);
}

/** Truck side view, roughly 620 × 420 at scale 1, origin at the baseplate's top centre. */
export function truckSide(cx, y, scale, { color, base = C.metal, bushing = C.yellow }) {
  const stroke = `stroke="${C.ink}" stroke-opacity="0.25" stroke-width="3"`;
  let s = '';
  // baseplate (plate + angled pivot housing)
  s += rect(-300, 0, 600, 36, base, `rx="8" ${stroke}`);
  s += poly([[-260, 36], [-40, 36], [-120, 150], [-230, 150]], base, stroke);
  s += poly([[0, 36], [190, 36], [150, 110], [40, 110]], base, stroke);
  // kingpin + bushings (angled)
  s += g(rect(-14, -10, 28, 330, C.metalDark) + rect(-60, 70, 120, 14, C.metalDark, 'rx="4"') + rect(-52, 84, 104, 50, bushing, `rx="16" ${stroke}`) + rect(-48, 210, 96, 48, bushing, `rx="16" ${stroke}`) + rect(-60, 258, 120, 14, C.metalDark, 'rx="4"') + rect(-36, 272, 72, 42, C.metalDeep, 'rx="6"'), 'translate(95 40) rotate(-35)');
  // hanger side profile
  s += path('M -215 150 Q -225 120 -190 118 L -110 128 L 150 230 Q 190 250 170 285 L 60 395 Q 30 420 0 405 L -40 380 Q -70 360 -60 330 Z', color, stroke);
  s += path('M -60 330 L 30 380 L 170 285 Q 180 300 165 315 L 60 395 Q 30 420 0 405 L -40 380 Q -70 360 -60 330 Z', C.ink, 'opacity="0.12"');
  // pivot cup
  s += ellipse(-185, 140, 34, 22, C.yellow, stroke);
  // axle end
  s += circle(20, 360, 46, C.metalDark, stroke) + hexagon(20, 360, 30, C.metalDeep) + circle(20, 360, 10, C.metal);
  return g(s, `translate(${n(cx)} ${n(y)}) scale(${scale})`);
}

/* ------------------------------------------------------------------ */
/* Wheels & bearings                                                   */
/* ------------------------------------------------------------------ */

export function wheelFace(cx, cy, R, { color, print = C.ink, brand = '', label = '', seed = 'w' }) {
  const stroke = `stroke="${C.ink}" stroke-opacity="${isLight(color) ? 0.22 : 0.12}" stroke-width="${n(Math.max(2, R * 0.012))}"`;
  let s = circle(cx + R * 0.05, cy + R * 0.06, R, C.ink, 'opacity="0.08"');
  s += circle(cx, cy, R, color, stroke);
  s += circle(cx, cy, R * 0.92, 'none', `stroke="${C.ink}" stroke-opacity="0.07" stroke-width="${n(R * 0.03)}"`);
  s += circle(cx, cy, R * 0.47, mix(color, C.ink, 0.1));
  s += circle(cx, cy, R * 0.36, C.metal, `stroke="${C.ink}" stroke-opacity="0.2" stroke-width="2"`);
  s += circle(cx, cy, R * 0.28, C.metalDark);
  s += circle(cx, cy, R * 0.12, C.ink);
  if (R >= 140) {
    if (brand) s += arcText(cx, cy, R * 0.66, brand.toUpperCase(), { size: R * 0.13, fill: print, spacing: R * 0.02 });
    if (label) s += arcText(cx, cy, R * 0.62, label, { size: R * 0.16, fill: print, spacing: R * 0.02, bottom: true });
    s += star(cx - R * 0.68, cy, R * 0.07, print) + star(cx + R * 0.68, cy, R * 0.07, print);
  }
  return s;
}

export function bearingFace(cx, cy, R, { shield = C.ink, print = C.cream, label = '', brand = '', open = false }) {
  let s = circle(cx + R * 0.05, cy + R * 0.06, R, C.ink, 'opacity="0.08"');
  s += circle(cx, cy, R, C.metal, `stroke="${C.metalDeep}" stroke-opacity="0.6" stroke-width="${n(Math.max(2, R * 0.015))}"`);
  s += circle(cx, cy, R * 0.86, C.metalDark);
  if (open) {
    s += circle(cx, cy, R * 0.83, C.grip);
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2 - Math.PI / 2;
      s += circle(cx + Math.cos(a) * R * 0.6, cy + Math.sin(a) * R * 0.6, R * 0.14, C.white, `stroke="${C.ink}" stroke-opacity="0.2" stroke-width="2"`);
    }
  } else {
    s += circle(cx, cy, R * 0.83, shield);
    if (R >= 140) {
      if (label) s += arcText(cx, cy, R * 0.6, label, { size: R * 0.15, fill: print, spacing: R * 0.02 });
      if (brand) s += arcText(cx, cy, R * 0.56, brand.toUpperCase(), { size: R * 0.11, fill: print, spacing: R * 0.02, bottom: true });
    }
  }
  s += circle(cx, cy, R * 0.4, C.metal, `stroke="${C.metalDeep}" stroke-opacity="0.5" stroke-width="2"`);
  s += circle(cx, cy, R * 0.27, C.bg, `stroke="${C.metalDeep}" stroke-opacity="0.4" stroke-width="2"`);
  return s;
}

/* ------------------------------------------------------------------ */
/* Griptape, hardware, risers, accessories                             */
/* ------------------------------------------------------------------ */

export function gripSheet(x, y, w, h, { color = C.grip, pattern = null, seed = 'sheet', peel = true }) {
  const grit = gritPattern(seed, { dot: isLight(color) ? C.ink : C.white, opacity: 0.28 });
  const clip = uid('sheet');
  let s = `<defs>${grit.defs}<clipPath id="${clip}"><rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}"/></clipPath></defs>`;
  s += rect(x + w * 0.05, y + w * 0.04, w, h, C.ink, 'opacity="0.08"');
  let body = rect(x, y, w, h, color);
  if (pattern === 'checker') {
    const q = w / 6;
    for (let row = 0; row * q < h; row++) for (let col = 0; col < 6; col++) if ((row + col) % 2 === 0) body += rect(x + col * q, y + row * q, q, q, '#4A4B48');
  }
  body += rect(x, y, w, h, grit.fill);
  // tiny perforation rows
  for (let py = y + w * 0.12; py < y + h; py += w * 0.12) for (let px = x + w * 0.1; px < x + w; px += w * 0.2) body += circle(px, py, 1.6, C.ink, 'opacity="0.35"');
  s += `<g clip-path="url(#${clip})">${body}</g>`;
  if (peel) {
    const p = w * 0.32;
    s += poly([[x + w, y + h - p], [x + w, y + h], [x + w - p, y + h]], C.bg);
    s += poly([[x + w, y + h - p], [x + w - p, y + h], [x + w - p * 0.95, y + h - p * 0.95]], '#EDE7D8', `stroke="${C.ink}" stroke-opacity="0.2" stroke-width="2"`);
  }
  return s;
}

/** Countersunk bolt lying horizontally (head on the left). */
export function boltSide(x, y, len, { color = C.ink, scale = 1 }) {
  const stroke = `stroke="${C.ink}" stroke-opacity="0.25" stroke-width="2"`;
  let s = poly([[0, -38], [22, -38], [48, -15], [48, 15], [22, 38], [0, 38]], color, stroke);
  s += rect(48, -15, len, 30, color, stroke);
  for (let tx = 70; tx < 48 + len - 4; tx += 11) s += line(tx, -15, tx - 6, 15, C.white, 2, 'opacity="0.25"');
  s += rect(0, -38, 6, 76, C.white, 'opacity="0.15"');
  return g(s, `translate(${n(x)} ${n(y)}) scale(${scale})`);
}

export function boltHead(cx, cy, r, { color = C.ink, head = 'allen' }) {
  let s = circle(cx + r * 0.06, cy + r * 0.08, r, C.ink, 'opacity="0.08"');
  s += circle(cx, cy, r, color, `stroke="${C.ink}" stroke-opacity="0.25" stroke-width="2"`);
  s += circle(cx, cy, r * 0.8, 'none', `stroke="${C.white}" stroke-opacity="0.18" stroke-width="3"`);
  if (head === 'phillips') {
    s += rect(cx - r * 0.45, cy - r * 0.09, r * 0.9, r * 0.18, C.ink, 'opacity="0.7"') + rect(cx - r * 0.09, cy - r * 0.45, r * 0.18, r * 0.9, C.ink, 'opacity="0.7"');
  } else {
    s += hexagon(cx, cy, r * 0.36, C.ink, 'opacity="0.75"');
  }
  return s;
}

export function nutFace(cx, cy, r, { color = C.metal, insert = C.blue }) {
  let s = hexagon(cx + r * 0.06, cy + r * 0.08, r, C.ink, 'opacity="0.08"');
  s += hexagon(cx, cy, r, color, `stroke="${C.ink}" stroke-opacity="0.25" stroke-width="2"`);
  s += circle(cx, cy, r * 0.62, insert) + circle(cx, cy, r * 0.4, C.bg, `stroke="${C.ink}" stroke-opacity="0.3" stroke-width="2"`);
  return s;
}

export function riserTop(cx, cy, w, h, { color, seed = 'riser' }) {
  const grit = gritPattern(seed, { dot: isLight(color) ? C.ink : C.white, opacity: 0.12, density: 14 });
  let s = `<defs>${grit.defs}</defs>`;
  s += rect(cx - w / 2 + w * 0.05, cy - h / 2 + w * 0.05, w, h, C.ink, `rx="${n(w * 0.16)}" opacity="0.08"`);
  s += rect(cx - w / 2, cy - h / 2, w, h, color, `rx="${n(w * 0.16)}" stroke="${C.ink}" stroke-opacity="0.2" stroke-width="3"`);
  s += rect(cx - w / 2, cy - h / 2, w, h, grit.fill, `rx="${n(w * 0.16)}"`);
  for (const [dx, dy] of [[-0.3, -0.33], [0.3, -0.33], [-0.3, 0.33], [0.3, 0.33], [-0.3, -0.18], [0.3, -0.18]]) {
    s += circle(cx + dx * w, cy + dy * h, w * 0.06, C.bg, `stroke="${C.ink}" stroke-opacity="0.3" stroke-width="2"`);
  }
  s += rect(cx - w * 0.12, cy - h * 0.05, w * 0.24, h * 0.22, C.ink, `rx="${n(w * 0.1)}" opacity="0.14"`);
  return s;
}

export function skateTool(cx, cy, scale, { grip = C.accent }) {
  const stroke = `stroke="${C.ink}" stroke-opacity="0.25" stroke-width="3"`;
  let s = '';
  s += g(rect(-420, -60, 840, 120, C.ink, 'rx="60" opacity="0.08"') + rect(-60, 0, 120, 540, C.ink, 'rx="40" opacity="0.08"'), 'translate(20 24)');
  s += rect(-60, 0, 120, 520, C.metal, `rx="40" ${stroke}`);
  s += rect(-68, 150, 136, 260, grip, `rx="36" ${stroke}`);
  for (let i = 0; i < 5; i++) s += rect(-68, 180 + i * 46, 136, 10, C.ink, 'opacity="0.15"');
  s += rect(-420, -60, 840, 120, C.metal, `rx="60" ${stroke}`);
  for (const [x, y, r, hex] of [[-400, 0, 110, 40], [400, 0, 118, 46], [0, 560, 124, 52]]) {
    s += circle(x, y, r, C.metal, stroke) + circle(x, y, r * 0.72, C.metalDark) + hexagon(x, y, hex, C.ink);
  }
  return g(s, `translate(${n(cx)} ${n(cy)}) scale(${scale})`);
}

export function waxPuck(cx, cy, scale, { wax = C.cream, band = C.yellow, label = 'CURB WAX', print = C.ink }) {
  const stroke = `stroke="${C.ink}" stroke-opacity="0.22" stroke-width="3"`;
  let s = ellipse(30, 250, 360, 120, C.ink, 'opacity="0.08"');
  s += path('M -330 0 L -330 220 A 330 110 0 0 0 330 220 L 330 0 Z', wax, stroke);
  s += path('M -330 70 L -330 170 A 330 110 0 0 0 330 170 L 330 70 A 330 110 0 0 1 -330 70 Z', band);
  const bandId = uid('waxband');
  s += `<path id="${bandId}" d="M -300 170 A 300 100 0 0 0 300 170" fill="none"/>`;
  s += `<text font-family="${MONO}" font-size="58" font-weight="700" fill="${print}" letter-spacing="10"><textPath href="#${bandId}" startOffset="50%" text-anchor="middle">${label}</textPath></text>`;
  s += ellipse(0, 0, 330, 110, mix(wax, C.white, 0.35), stroke);
  for (let i = 0; i < 4; i++) s += path(`M ${-200 + i * 60} ${-30 + i * 12} q 120 -30 240 0`, 'none', `stroke="${C.ink}" stroke-opacity="0.1" stroke-width="6" stroke-linecap="round"`);
  return g(s, `translate(${n(cx)} ${n(cy)}) scale(${scale})`);
}

/** Dimension line with end ticks and a mono label. */
export function dimension(x1, y1, x2, y2, label, { color = C.accent, size = 28, offset = 36 } = {}) {
  const horizontal = Math.abs(y2 - y1) < Math.abs(x2 - x1);
  let s = line(x1, y1, x2, y2, color, 3);
  if (horizontal) {
    s += line(x1, y1 - 14, x1, y1 + 14, color, 3) + line(x2, y2 - 14, x2, y2 + 14, color, 3);
    s += text((x1 + x2) / 2, y1 - offset / 2, label, { size, fill: color, anchor: 'middle', weight: 700, spacing: 2 });
  } else {
    s += line(x1 - 14, y1, x1 + 14, y1, color, 3) + line(x2 - 14, y2, x2 + 14, y2, color, 3);
    s += text(x1 + offset / 2, (y1 + y2) / 2 + size / 3, label, { size, fill: color, anchor: 'start', weight: 700, spacing: 2 });
  }
  return s;
}
