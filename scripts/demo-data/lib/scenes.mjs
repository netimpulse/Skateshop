// Full image compositions: product plates (1600×2000), preview layers (2000×520) and section images.
import {
  C, FONT, rect, circle, ellipse, poly, path, line, g, text, star, sparkle, hexagon, mix, rng, uid, svgDoc, triStripe,
  gritPattern, DECK_MOTIFS, deckBottom, deckTop, completeBottom, truckFront, truckSide, wheelFace, bearingFace,
  gripSheet, boltSide, boltHead, nutFace, riserTop, skateTool, waxPuck, dimension,
} from './svg.mjs';

const PW = 1600;
const PH = 2000;

/** Product plate: neutral surface, product centred, small mono caption like a retro catalogue. */
function plate(body, { brand, model, view }) {
  let s = rect(0, 0, PW, PH, C.bg) + body;
  s += line(96, 1868, 1504, 1868, C.line, 2);
  s += text(96, 1926, `${brand} — ${model}`.toUpperCase(), { size: 26, fill: C.ink2, spacing: 3 });
  s += text(1504, 1926, view.toUpperCase(), { size: 26, fill: C.ink2, spacing: 3, anchor: 'end' });
  return svgDoc(PW, PH, s);
}

const groundShadow = (cx, cy, rx, ry) => ellipse(cx, cy, rx, ry, C.ink, 'opacity="0.07"');

/* ------------------------------------------------------------------ */
/* Product images                                                      */
/* ------------------------------------------------------------------ */

const PRODUCT_VIEWS = {
  deck(p) {
    const a = p.art;
    const L = 1640;
    const W = (L * a.widthIn) / a.lengthIn;
    const x = PW / 2 - W / 2;
    return [
      deckBottom(x, 110, W, L, { shape: a.shape, motif: a.motif, brand: p.vendor, lengthIn: a.lengthIn, wheelbaseIn: a.wheelbaseIn }),
      deckTop(x, 110, W, L, { shape: a.shape, motif: a.motif, lengthIn: a.lengthIn, wheelbaseIn: a.wheelbaseIn, seed: p.handle }),
    ];
  },
  complete(p) {
    const a = p.art;
    const opts = { shape: a.shape, motif: a.motif, brand: p.vendor, lengthIn: a.lengthIn, wheelbaseIn: a.wheelbaseIn, truckColor: a.truckColor, wheelColor: a.wheelColor };
    const L1 = 1480;
    const W1 = (L1 * a.widthIn) / a.lengthIn;
    const angled = g(completeBottom(-W1 / 2, -L1 / 2, W1, L1, opts), `translate(800 960) rotate(-32)`);
    const L2 = 1600;
    const W2 = (L2 * a.widthIn) / a.lengthIn;
    return [angled, completeBottom(PW / 2 - W2 / 2, 130, W2, L2, opts)];
  },
  trucks(p) {
    const a = p.art;
    const opts = { color: a.color, base: a.base, bushing: a.bushing };
    return [
      groundShadow(800, 1232, 680, 34) + truckFront(800, 780, 1.0, opts),
      groundShadow(830, 1395, 420, 30) + truckSide(820, 690, 1.6, opts),
    ];
  },
  wheels(p) {
    const a = p.art;
    const opts = { color: a.color, print: a.print, brand: p.vendor, label: a.hardness, seed: p.handle };
    let set = '';
    for (const [cx, cy] of [[520, 700], [1080, 700], [520, 1260], [1080, 1260]]) set += wheelFace(cx, cy, 290, opts);
    let one = wheelFace(800, 900, 540, opts);
    one += text(800, 1660, `DUROMETER ${a.hardness}`, { size: 44, fill: C.ink, weight: 700, anchor: 'middle', spacing: 8 });
    return [set, one];
  },
  bearings(p) {
    const a = p.art;
    const opts = { shield: a.shield, print: a.print, label: a.label, brand: p.vendor, open: a.open };
    let set = '';
    for (const cy of [800, 1180]) for (const cx of [260, 620, 980, 1340]) set += bearingFace(cx, cy, 160, opts);
    return [set, bearingFace(800, 940, 540, opts)];
  },
  griptape(p) {
    const a = p.art;
    const h = 1560;
    const w = (h * 9) / 33;
    let sheets = '';
    if (a.colors.length > 1) {
      a.colors.forEach((color, i) => {
        const dx = (i - (a.colors.length - 1) / 2) * 300;
        sheets += g(gripSheet(-w / 2, -h / 2, w, h, { color, seed: `${p.handle}-${i}`, peel: i === a.colors.length - 1 }), `translate(${800 + dx} 960) rotate(${(i - 1) * 7})`);
      });
    } else {
      sheets = g(gripSheet(-w / 2, -h / 2, w, h, { color: a.colors[0], pattern: a.pattern, seed: p.handle }), 'translate(800 960) rotate(-6)');
    }
    // detail view: circular crop with coarse grit
    const color = a.colors[0];
    const clip = uid('detail');
    const grit = gritPattern(`${p.handle}-detail`, { dot: C.white, opacity: 0.4, density: 70, tile: 120 });
    let detail = `<defs>${grit.defs}<clipPath id="${clip}"><circle cx="800" cy="940" r="600"/></clipPath></defs>`;
    detail += circle(830, 975, 600, C.ink, 'opacity="0.08"');
    let inner = rect(200, 340, 1200, 1200, color);
    if (a.pattern === 'checker') {
      for (let row = 0; row < 5; row++) for (let col = 0; col < 5; col++) if ((row + col) % 2 === 0) inner += rect(200 + col * 240, 340 + row * 240, 240, 240, '#4A4B48');
    }
    const rand = rng(`${p.handle}-grains`);
    for (let i = 0; i < 900; i++) inner += circle(200 + rand() * 1200, 340 + rand() * 1200, 1.5 + rand() * 4.5, C.white, `opacity="${(0.08 + rand() * 0.3).toFixed(2)}"`);
    for (let py = 420; py < 1540; py += 110) for (let px = 260; px < 1400; px += 180) inner += circle(px + ((py / 110) % 2) * 90, py, 5, C.ink, 'opacity="0.5"');
    inner += rect(200, 340, 1200, 1200, grit.fill);
    detail += `<g clip-path="url(#${clip})">${inner}</g>` + circle(800, 940, 600, 'none', `stroke="${C.ink}" stroke-opacity="0.2" stroke-width="4"`);
    return [sheets, detail];
  },
  hardware(p) {
    const a = p.art;
    let set = '';
    let i = 0;
    for (const cy of [520, 680, 840, 1000]) {
      for (const x of [230, 850]) set += boltSide(x, cy, 330, { color: a.colors[i++ % a.colors.length], scale: 1.3 });
    }
    for (let k = 0; k < 8; k++) set += nutFace(265 + k * 153, 1290, 62, { color: C.metal, insert: a.colors.length > 1 ? a.colors[k % a.colors.length] : C.blue });
    for (let k = 0; k < 3; k++) set += boltHead(520 + k * 280, 1540, 78, { color: a.colors[k % a.colors.length], head: a.head });
    // single bolt with length marks
    const s = 2.4;
    let one = g(boltSide(0, 0, 330, { color: a.colors[0], scale: s }), 'translate(640 330) rotate(90)');
    const top = 330;
    const shaftStart = top + 48 * s;
    const inchPx = (330 * s) / 1.125;
    [['7/8"', 0.875], ['1"', 1], ['1 1/8"', 1.125]].forEach(([label, len], idx) => {
      const x = 900 + idx * 150;
      one += dimension(x, top, x, top + len * inchPx, label, { size: 34, offset: 40 });
    });
    one += nutFace(640, shaftStart + 330 * s + 180, 120, { color: C.metal, insert: C.blue });
    return [set, one];
  },
  riser(p) {
    const a = p.art;
    const pads = riserTop(560, 960, 400, 640, { color: a.color, seed: `${p.handle}-a` }) + riserTop(1040, 960, 400, 640, { color: a.color, seed: `${p.handle}-b` });
    // side view: deck, riser, baseplate
    const h = a.heightIn * 900;
    const y0 = 700;
    let side = rect(160, y0, 1280, 70, C.wood) + rect(160, y0 + 70, 1280, 14, C.accent);
    for (let k = 1; k < 7; k++) side += line(160, y0 + k * 10, 1440, y0 + k * 10, mix(C.wood, C.ink, 0.15), 2);
    side += rect(400, y0 + 84, 800, h, a.color, `stroke="${C.ink}" stroke-opacity="0.25" stroke-width="3"`);
    side += rect(420, y0 + 84 + h, 760, 64, C.metal, `rx="8" stroke="${C.ink}" stroke-opacity="0.25" stroke-width="3"`);
    side += poly([[560, y0 + 148 + h], [900, y0 + 148 + h], [840, y0 + 300 + h], [620, y0 + 300 + h]], C.metal, `stroke="${C.ink}" stroke-opacity="0.25" stroke-width="3"`);
    for (const bx of [520, 1080]) side += rect(bx - 14, y0 - 20, 28, 84 + h + 64 + 60, C.metalDark) + rect(bx - 40, y0 + 84 + h + 64 + 40, 80, 40, C.metalDeep, 'rx="6"') + rect(bx - 34, y0 - 26, 68, 16, C.ink, 'rx="4"');
    side += dimension(1300, y0 + 84, 1300, y0 + 84 + h, a.label, { size: 44, offset: 44 });
    side += text(800, y0 + 560 + h, `RISER ${a.label}`, { size: 40, fill: C.ink, weight: 700, anchor: 'middle', spacing: 8 });
    return [pads, side];
  },
  tool() {
    let detail = '';
    [[400, 150, 46, '3/8"'], [800, 175, 56, '1/2"'], [1200, 200, 64, '9/16"']].forEach(([cx, r, hx, label]) => {
      detail += circle(cx + 12, 972, r, C.ink, 'opacity="0.08"') + circle(cx, 960, r, C.metal, `stroke="${C.ink}" stroke-opacity="0.25" stroke-width="3"`);
      detail += circle(cx, 960, r * 0.74, C.metalDark) + hexagon(cx, 960, hx, C.ink);
      detail += text(cx, 960 + r + 90, label, { size: 48, fill: C.accent, weight: 700, anchor: 'middle', spacing: 4 });
    });
    return [skateTool(800, 700, 1.3, { grip: C.accent }), detail];
  },
  wax() {
    const puck = waxPuck(800, 860, 1.6, { wax: C.cream, band: C.yellow });
    // curb in simple perspective with painted stripes
    const clip = uid('curb');
    let curb = `<defs><clipPath id="${clip}"><polygon points="120,1180 1480,1180 1480,1560 120,1560"/></clipPath></defs>`;
    curb += poly([[220, 1000], [1560, 1000], [1480, 1180], [120, 1180]], '#E7E3DA', `stroke="${C.ink}" stroke-opacity="0.2" stroke-width="3"`);
    let stripes = rect(120, 1180, 1360, 380, C.cream);
    for (let k = 0; k < 8; k++) stripes += poly([[120 + k * 340, 1180], [290 + k * 340, 1180], [120 + k * 340, 1560], [-50 + k * 340, 1560]], C.accent);
    curb += `<g clip-path="url(#${clip})">${stripes}</g>` + rect(120, 1180, 1360, 380, 'none', `stroke="${C.ink}" stroke-opacity="0.2" stroke-width="3"`);
    for (let k = 0; k < 6; k++) curb += path(`M ${360 + k * 150} ${1150 - k * 4} l 220 -2`, 'none', `stroke="${C.white}" stroke-opacity="0.8" stroke-width="10" stroke-linecap="round"`);
    curb += waxPuck(1140, 880, 0.6, { wax: C.cream, band: C.yellow });
    return [puck, curb];
  },
};

const VIEW_LABELS = {
  deck: ['Unterseite', 'Oberseite'], complete: ['Complete', 'Unterseite'], trucks: ['Front', 'Seite'], wheels: ['Set 4 Stück', 'Einzeln'],
  bearings: ['Set 8 Stück', 'Einzeln'], griptape: ['Blatt 9 x 33', 'Detail'], hardware: ['Set', 'Längen'], riser: ['Set', 'Seite'],
  tool: ['Tool', 'Nüsse'], wax: ['Puck', 'Curb'],
};

/** Returns [{ file, svg, width, height, transparent }] for a catalogue product. */
export function productImages(p) {
  const bodies = PRODUCT_VIEWS[p.art.kind](p);
  const labels = VIEW_LABELS[p.art.kind];
  const out = bodies.map((body, i) => ({
    file: p.images[i].file,
    svg: plate(body, { brand: p.vendor, model: p.title, view: labels[i] }),
    width: PW,
    height: PH,
  }));
  if (p.layer) out.push({ file: p.layer.file, svg: previewLayer(p), width: 2000, height: 520, transparent: true });
  return out;
}

/** Landscape preview layer: bottom graphic only, full bleed; the theme clips it to the deck outline (nose on the left). */
export function previewLayer(p) {
  const motif = DECK_MOTIFS[p.art.motif];
  return svgDoc(2000, 520, g(motif.draw(520, 2000, p.vendor), 'translate(0 520) rotate(-90)'));
}

/* ------------------------------------------------------------------ */
/* Section images                                                      */
/* ------------------------------------------------------------------ */

function sunDisc(cx, cy, r, color, bg, gaps = 6) {
  let s = circle(cx, cy, r, color);
  for (let i = 0; i < gaps; i++) s += rect(cx - r - 2, cy + r * 0.1 + i * r * 0.15, 2 * r + 4, r * 0.025 + i * r * 0.016, bg);
  return s;
}

function completeAt(cx, cy, L, rotation, { motif, shape = 'popsicle', widthIn = 8.25, lengthIn = 32, wheelbaseIn = 14.25, truckColor = C.metal, wheelColor = C.cream, brand = '' }) {
  const W = (L * widthIn) / lengthIn;
  return g(completeBottom(-W / 2, -L / 2, W, L, { shape, motif, brand, lengthIn, wheelbaseIn, truckColor, wheelColor }), `translate(${cx} ${cy}) rotate(${rotation})`);
}

function deckAt(cx, cy, L, rotation, { motif, shape = 'popsicle', widthIn = 8.25, lengthIn = 32, brand = '', top = false }) {
  const W = (L * widthIn) / lengthIn;
  const body = top
    ? deckTop(-W / 2, -L / 2, W, L, { shape, motif, lengthIn, seed: `${motif}-top` })
    : deckBottom(-W / 2, -L / 2, W, L, { shape, motif, brand, lengthIn });
  return g(body, `translate(${cx} ${cy}) rotate(${rotation})`);
}

/** Side profile of a deck with trucks and wheels. */
function boardProfile(cx, cy, len, { deck = C.accent, wheel = C.cream, truck = C.metal, bare = false }) {
  const k = len / 1000;
  const deckD = 'M -520 -84 Q -470 -46 -410 -16 L 410 -16 Q 470 -46 520 -84 L 534 -56 Q 480 -14 418 14 L -418 14 Q -480 -14 -534 -56 Z';
  let s = '';
  for (const x of bare ? [] : [-290, 290]) {
    s += poly([[x - 70, 14], [x + 70, 14], [x + 44, 52], [x - 44, 52]], truck, `stroke="${C.ink}" stroke-opacity="0.3" stroke-width="3"`);
    s += poly([[x - 50, 52], [x + 50, 52], [x + 26, 96], [x - 26, 96]], truck, `stroke="${C.ink}" stroke-opacity="0.3" stroke-width="3"`);
    s += circle(x, 122, 60, wheel, `stroke="${C.ink}" stroke-opacity="0.35" stroke-width="4"`) + circle(x, 122, 22, C.metalDark);
  }
  s += path(deckD, deck, `stroke="${C.ink}" stroke-opacity="0.35" stroke-width="4"`);
  s += path('M -534 -56 Q -480 -14 -418 14 L 418 14 Q 480 -14 534 -56 L 530 -48 Q 478 -4 418 6 L -418 6 Q -478 -4 -530 -48 Z', C.ink, 'opacity="0.18"');
  return g(s, `translate(${cx} ${cy}) scale(${k})`);
}

export function sectionImages() {
  const images = [];
  const add = (file, width, height, body, alt) => images.push({ file, width, height, svg: svgDoc(width, height, body), alt });

  // Hero 2400×2000
  {
    let s = rect(0, 0, 2400, 2000, C.bg);
    s += sunDisc(1480, 980, 780, C.accent, C.bg, 7);
    s += g(triStripe(-600, 0, 1400, 44, 28), 'translate(420 1720) rotate(-18)');
    s += circle(560, 420, 120, C.lime) + circle(560, 420, 120, 'none', `stroke="${C.ink}" stroke-width="3"`);
    s += star(560, 420, 60, C.ink);
    s += groundShadow(1480, 1790, 700, 40);
    s += completeAt(1470, 960, 1780, -30, { motif: 'voltage', truckColor: '#2E2F2D', wheelColor: C.cream, brand: 'Quarry Lane' });
    s += sparkle(2120, 380, 60, C.ink) + sparkle(2220, 520, 30, C.ink) + sparkle(820, 1400, 44, C.ink);
    add('skate-demo-hero.png', 2400, 2000, s, 'Skateboard mit Blitz-Grafik vor einer roten Retro-Sonne');
  }

  // Category tiles 1200×1500
  const tile = (disc, discColor, content) => rect(0, 0, 1200, 1500, C.bg) + sunDisc(600, 720, disc, discColor, C.bg, 0) + content;
  add('skate-demo-cat-decks.png', 1200, 1500, tile(470, C.yellow,
    deckAt(420, 760, 1180, -12, { motif: 'orbit', brand: 'Quarry Lane' }) + deckAt(600, 740, 1220, 0, { motif: 'sunset', brand: 'Nine Ply Co.' }) + deckAt(780, 760, 1180, 12, { motif: 'checker', brand: 'Nine Ply Co.' })),
  'Drei Skateboard-Decks mit Retro-Grafiken');
  add('skate-demo-cat-trucks.png', 1200, 1500, tile(460, C.blue,
    truckFront(600, 470, 0.8, { color: C.metal, bushing: C.yellow }) + groundShadow(630, 1390, 300, 22) + truckSide(620, 880, 0.95, { color: C.accent, base: C.accent, bushing: C.cream })),
  'Skateboard-Achsen in Front- und Seitenansicht');
  {
    let wheels = '';
    const cols = [[C.cream, C.accent], [C.orange, C.ink], [C.lime, C.ink], [C.blue, C.cream]];
    [[420, 560], [780, 560], [420, 920], [780, 920]].forEach(([cx, cy], i) => { wheels += wheelFace(cx, cy, 190, { color: cols[i][0], print: cols[i][1], brand: 'Rolltype', label: ['99A', '92A', '78A', '97A'][i] }); });
    add('skate-demo-cat-wheels.png', 1200, 1500, tile(470, C.orange, wheels), 'Vier Skateboard-Rollen in verschiedenen Farben');
  }
  add('skate-demo-cat-bearings.png', 1200, 1500, tile(460, C.lime,
    bearingFace(600, 700, 300, { shield: C.accent, print: C.cream, label: 'ABEC 7', brand: 'Swiftbore' }) + bearingFace(330, 1120, 150, { shield: C.ink }) + bearingFace(870, 1120, 150, { open: true })),
  'Skateboard-Kugellager mit rotem Shield');
  add('skate-demo-cat-completes.png', 1200, 1500, tile(470, C.accent,
    groundShadow(600, 1330, 420, 24) + completeAt(600, 740, 1180, -24, { motif: 'waves', shape: 'cruiser', widthIn: 8.75, lengthIn: 30.25, wheelbaseIn: 14, truckColor: C.yellow, wheelColor: C.lime })),
  'Komplettes Cruiser-Skateboard mit Wellen-Grafik');

  // Banners 2400×800 (collection headers)
  {
    let s = rect(0, 0, 2400, 800, C.bg);
    const motifs = ['sunset', 'checker', 'orbit', 'voltage', 'tristripe', 'polka', 'waves', 'peaks'];
    motifs.forEach((m, i) => { s += deckAt(260 + i * 270, 400 + (i % 2 ? 40 : -40), 1100, i % 2 ? 4 : -4, { motif: m, shape: m === 'waves' ? 'cruiser' : 'popsicle' }); });
    add('skate-demo-banner-decks.png', 2400, 800, s, 'Reihe von Skateboard-Decks mit Retro-Grafiken');
  }
  {
    let s = rect(0, 0, 2400, 800, C.bg) + rect(0, 560, 2400, 240, C.line);
    [[C.metal, C.yellow, C.yellow], [C.blue, C.yellow, C.lime], [C.accent, C.cream, C.yellow]].forEach(([color, bushing, disc], i) => {
      s += circle(420 + i * 780, 380, 250, disc) + truckFront(420 + i * 780, 250, 0.5, { color, base: color === C.metal ? C.metal : color, bushing });
    });
    add('skate-demo-banner-trucks.png', 2400, 800, s, 'Vier Skateboard-Achsen in verschiedenen Farben');
  }
  {
    let s = rect(0, 0, 2400, 800, C.bg);
    const cols = [[C.cream, C.accent], [C.orange, C.ink], [C.lime, C.ink], [C.blue, C.cream], [C.yellow, C.ink], [C.cream, C.blue], [C.accent, C.cream]];
    cols.forEach(([color, print], i) => { s += wheelFace(230 + i * 325, 400 + (i % 2 ? 50 : -50), 190, { color, print, brand: 'Rolltype', label: ['99A', '92A', '78A', '97A', '101A', '84B', '95A'][i] }); });
    add('skate-demo-banner-wheels.png', 2400, 800, s, 'Reihe von Skateboard-Rollen in Retro-Farben');
  }

  // Editorial 1600×2000
  {
    let s = rect(0, 0, 1600, 2000, C.yellow);
    s += sunDisc(1060, 700, 420, C.accent, C.yellow, 6);
    s += rect(0, 1500, 1600, 500, C.orange);
    s += path('M 0 1500 L 0 700 L 80 700 Q 90 1360 760 1500 Z', C.ink);
    s += path('M 80 700 Q 90 1360 760 1500 L 700 1500 Q 40 1390 40 700 Z', C.cream);
    s += rect(20, 660, 80, 40, C.metal) + rect(0, 1500, 1600, 30, C.ink);
    s += g(boardProfile(0, 0, 700, { deck: C.blue, wheel: C.cream }), 'translate(620 520) rotate(-28)');
    s += sparkle(1380, 260, 50, C.ink) + sparkle(1460, 380, 24, C.ink);
    add('skate-demo-editorial-ramp.png', 1600, 2000, s, 'Grafik einer Quarterpipe vor einer Retro-Sonne');
  }
  {
    let s = rect(0, 0, 1600, 2000, C.bg) + rect(0, 0, 1600, 900, C.blue);
    for (let i = 0; i < 6; i++) s += rect(0, 120 + i * 120, 1600, 10, C.bg, 'opacity="0.18"');
    const clip = uid('ledge');
    s += poly([[120, 1040], [1600, 1040], [1600, 1180], [60, 1180]], '#E7E3DA', `stroke="${C.ink}" stroke-opacity="0.25" stroke-width="3"`);
    let stripes = rect(60, 1180, 1540, 360, C.cream);
    for (let k = 0; k < 10; k++) stripes += poly([[60 + k * 320, 1180], [220 + k * 320, 1180], [60 + k * 320, 1540], [-100 + k * 320, 1540]], C.accent);
    s += `<defs><clipPath id="${clip}"><rect x="60" y="1180" width="1540" height="360"/></clipPath></defs><g clip-path="url(#${clip})">${stripes}</g>`;
    s += rect(0, 1540, 1600, 460, C.ink2) + rect(0, 1540, 1600, 20, C.ink);
    s += g(boardProfile(0, 0, 820, { deck: C.orange, wheel: C.cream }), 'translate(820 900) rotate(-4)');
    for (let k = 0; k < 5; k++) s += rect(80 + k * 40, 960 + k * 22, 280 - k * 40, 10, C.ink, 'opacity="0.7"');
    add('skate-demo-editorial-curb.png', 1600, 2000, s, 'Grafik eines Skateboards auf einem rot-weißen Curb');
  }
  {
    let s = rect(0, 0, 1600, 2000, C.orange);
    s += sunDisc(800, 820, 380, C.yellow, C.orange, 6);
    const rand = rng('city');
    const layer = (baseY, color, win, minH, maxH) => {
      let out = '';
      for (let x = -40; x < 1640;) {
        const w = 120 + rand() * 160;
        const h = minH + rand() * (maxH - minH);
        out += rect(x, baseY - h, w, h + 700, color);
        if (win) for (let wy = baseY - h + 40; wy < baseY - 30; wy += 70) for (let wx = x + 24; wx < x + w - 30; wx += 56) if (rand() > 0.35) out += rect(wx, wy, 26, 34, win);
        x += w + 8;
      }
      return out;
    };
    s += layer(1400, C.blue, null, 260, 620) + layer(1500, C.ink, C.yellow, 180, 520);
    s += rect(0, 1500, 1600, 500, C.ink2) + rect(0, 1500, 1600, 16, C.ink);
    for (let x = 40; x < 1600; x += 220) s += rect(x, 1740, 120, 18, C.yellow);
    s += boardProfile(1100, 1560, 520, { deck: C.accent, wheel: C.lime });
    add('skate-demo-editorial-city.png', 1600, 2000, s, 'Grafik einer Stadt-Silhouette mit Sonne und Straße');
  }

  // Community 1200×1200
  const community = [
    ['Wand mit fünf Skateboard-Decks in Retro-Farben', () => {
      let s = rect(0, 0, 1200, 1200, C.cream) + rect(0, 1080, 1200, 120, C.line);
      ['tristripe', 'orbit', 'polka', 'peaks', 'checker'].forEach((motif, i) => { s += deckAt(160 + i * 220, 580, 960, i % 2 ? 3 : -3, { motif, brand: '' }); });
      return s;
    }],
    ['Nahaufnahme von Skateboard-Rollen als Grafik', () => {
      let s = rect(0, 0, 1200, 1200, C.ink);
      const cols = [C.cream, C.orange, C.lime, C.blue, C.yellow, C.accent];
      for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) s += wheelFace(200 + c * 400, 200 + r * 400, 170, { color: cols[(r * 3 + c) % 6], print: C.ink, brand: 'Rolltype', label: ['99A', '92A', '78A'][c] });
      return s;
    }],
    ['Skateboard über einer Treppe als Grafik', () => {
      let s = rect(0, 0, 1200, 1200, C.lime);
      let stairs = 'M 0 1200 L 0 640';
      for (let i = 0; i < 6; i++) stairs += ` L ${i * 200 + 200} ${640 + i * 90} L ${i * 200 + 200} ${730 + i * 90}`;
      stairs += ' L 1200 1200 Z';
      s += path(stairs, C.ink);
      for (let i = 0; i < 6; i++) s += rect(i * 200, 640 + i * 90, 200, 12, C.cream);
      s += line(0, 470, 1200, 1010, C.ink, 14, 'stroke-linecap="round"') + line(200, 560, 200, 730, C.ink, 10) + line(800, 830, 800, 1000, C.ink, 10);
      s += g(boardProfile(0, 0, 560, { deck: C.accent, wheel: C.cream }), 'translate(520 300) rotate(16)');
      s += path('M 120 420 Q 300 120 560 190', 'none', `stroke="${C.ink}" stroke-width="6" stroke-dasharray="18 16" stroke-linecap="round"`);
      return s;
    }],
    ['Skateboard-Oberseite auf Schachbrett-Boden', () => {
      let s = rect(0, 0, 1200, 1200, C.cream);
      for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) if ((r + c) % 2 === 0) s += rect(c * 150, r * 150, 150, 150, C.ink);
      s += deckAt(600, 600, 1060, 38, { motif: 'sunset', top: true });
      return s;
    }],
    ['Retro-Sonne mit Rampe', () => {
      let s = rect(0, 0, 1200, 1200, C.blue);
      s += sunDisc(600, 520, 330, C.orange, C.blue, 6);
      s += path('M 0 1200 L 0 820 Q 400 820 600 1000 Q 800 820 1200 820 L 1200 1200 Z', C.cream) + rect(0, 1100, 1200, 100, C.ink);
      s += g(boardProfile(0, 0, 440, { deck: C.yellow, wheel: C.cream }), 'translate(600 700) rotate(-8)');
      return s;
    }],
    ['Sticker-Collage mit Stern, Blitz und Streifen', () => {
      let s = rect(0, 0, 1200, 1200, C.bg);
      s += circle(360, 360, 240, C.accent) + star(360, 360, 150, C.cream);
      s += circle(860, 330, 170, C.yellow, `stroke="${C.ink}" stroke-width="4"`) + text(860, 350, 'SKATE', { size: 64, fill: C.ink, family: FONT, weight: 800, anchor: 'middle', spacing: 4 });
      s += g(poly([[0.62, 0], [0.1, 0.55], [0.42, 0.55], [0.2, 1], [0.9, 0.4], [0.56, 0.4], [0.82, 0]].map(([x, y]) => [x * 360, y * 520]), C.blue), 'translate(700 580) rotate(8)');
      s += g(triStripe(0, 0, 520, 50, 26), 'translate(120 760) rotate(-10)');
      s += circle(300, 1030, 90, C.lime, `stroke="${C.ink}" stroke-width="4"`) + sparkle(300, 1030, 50, C.ink);
      return s;
    }],
  ];
  community.forEach(([alt, draw], i) => add(`skate-demo-community-${i + 1}.png`, 1200, 1200, draw(), alt));

  // Builder promo 2000×1400: exploded parts on grid paper
  {
    let s = rect(0, 0, 2000, 1400, C.paper);
    for (let x = 0; x <= 2000; x += 40) s += line(x, 0, x, 1400, C.line, x % 200 === 0 ? 2 : 1);
    for (let y = 0; y <= 1400; y += 40) s += line(0, y, 2000, y, C.line, y % 200 === 0 ? 2 : 1);
    const L = 1500;
    const W = (L * 8.25) / 32;
    s += g(deckBottom(-W / 2, -L / 2, W, L, { shape: 'popsicle', motif: 'sunset', brand: 'Nine Ply Co.', lengthIn: 32, wheelbaseIn: 14.25 }), 'translate(1000 300) rotate(-90)');
    s += dimension(250, 110, 1750, 110, '32"', { size: 30 });
    s += dimension(1800, 300 - W / 2, 1800, 300 + W / 2, '8.25"', { size: 30, offset: 30 });
    s += truckFront(560, 640, 0.42, { color: C.metal, bushing: C.yellow });
    s += truckFront(1040, 640, 0.42, { color: C.metal, bushing: C.yellow });
    [1380, 1520, 1660, 1800].forEach((cx) => { s += wheelFace(cx, 740, 62, { color: C.cream, print: C.accent }); });
    for (let i = 0; i < 8; i++) s += bearingFace(420 + i * 110, 1040, 44, { shield: C.accent });
    s += g(gripSheet(-90, -330, 180, 660, { color: C.grip, seed: 'promo', peel: false }), 'translate(1500 1100) rotate(-90)');
    for (let i = 0; i < 4; i++) s += boltSide(380 + i * 150, 1250, 80, { color: C.ink, scale: 0.7 });
    const labels = [['01 DECK', 250, 520], ['02 TRUCKS', 380, 870], ['03 WHEELS', 1330, 870], ['04 BEARINGS', 380, 1130], ['05 GRIP', 1180, 1230], ['06 HARDWARE', 380, 1340]];
    for (const [label, x, y] of labels) s += text(x, y, label, { size: 28, fill: C.ink, weight: 700, spacing: 4 });
    add('skate-demo-builder-promo.png', 2000, 1400, s, 'Skateboard-Teile als Explosionszeichnung auf Millimeterpapier');
  }

  return images;
}
