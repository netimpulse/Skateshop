// Demo catalogue: 33 products. Texts in German, prices in USD.
// Every product gets the tag `skate-demo`; builder-capable parts additionally `builder`.
import { C, hash } from '../lib/svg.mjs';

const DECK_DIMS = {
  '7.75': [31.5, 14.0], '8.0': [31.75, 14.25], '8.125': [31.875, 14.25], '8.25': [32.0, 14.25], '8.38': [32.125, 14.38],
  '8.5': [32.25, 14.38], '8.75': [32.5, 14.5], '9.0': [32.75, 14.63],
};
const CRUISER_DIMS = { '8.75': [30.25, 14.0], '9.0': [30.5, 14.25], '9.25': [31.0, 14.5] };

const inch = (w) => `${w}"`;
const LENGTH_LABEL = { 0.875: '7/8"', 1: '1"', 1.125: '1 1/8"' };

export function slugify(value) {
  return value
    .toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const html = (intro, bullets) => `<p>${intro}</p>\n<ul>\n${bullets.map((b) => `  <li>${b}</li>`).join('\n')}\n</ul>`;

/* ------------------------------------------------------------------ */

function deck({ vendor, title, motif, shape, concave, widths, price, compareAt, tags = [], intro, features, stock = {} }) {
  const dims = shape === 'Cruiser' ? CRUISER_DIMS : DECK_DIMS;
  const variants = widths.map((w) => {
    const [length, wheelbase] = dims[w];
    return {
      options: { Breite: inch(w) },
      metafields: { deck_width: w, deck_length: length, wheelbase },
      stock: stock[w],
    };
  });
  const lengths = widths.map((w) => dims[w][0]);
  return {
    type: 'Deck', category: 'deck', vendor, title, price, compareAt, tags: ['builder', ...tags],
    options: [{ name: 'Breite', values: widths.map(inch) }],
    variants,
    metafields: { concave, deck_shape: shape, preview_color: MOTIF_COLOR[motif] },
    features,
    descriptionHtml: html(intro, [
      'Material: 7 Lagen kanadischer Ahorn',
      `Shape: ${shape} · Concave: ${concave}`,
      `Breiten: ${widths.map(inch).join(' · ')}`,
      `Länge: ${Math.min(...lengths)}"–${Math.max(...lengths)}" je nach Breite`,
    ]),
    art: { kind: 'deck', motif, shape: shape.toLowerCase(), lengthIn: dims[widths[1] || widths[0]][0], wheelbaseIn: dims[widths[1] || widths[0]][1], widthIn: Number(widths[1] || widths[0]) },
    previewLayer: true,
  };
}

const MOTIF_COLOR = { sunset: C.accent, checker: C.ink, orbit: C.blue, voltage: C.yellow, tristripe: C.orange, polka: C.lime, waves: C.blue, peaks: C.accent };

function trucks({ vendor, title, color, base, bushing = C.yellow, height, widths, price, compareAt, tags = [], intro, features }) {
  return {
    type: 'Trucks', category: 'trucks', vendor, title, price, compareAt, tags: ['builder', ...tags],
    options: [{ name: 'Breite', values: widths.map(inch) }],
    variants: widths.map((w) => ({ options: { Breite: inch(w) }, metafields: { truck_width: w } })),
    metafields: { truck_height: height, preview_color: color },
    features,
    descriptionHtml: html(intro, [
      'Hanger und Baseplate aus Aluminium, Kingpin und Achse aus Stahl',
      `Bauhöhe: ${height}`,
      `Achsbreiten: ${widths.map(inch).join(' · ')}`,
      'Lieferumfang: 1 Paar (2 Achsen)',
    ]),
    art: { kind: 'trucks', color, base: base || color, bushing },
  };
}

function wheels({ vendor, title, color, print, hardness, sizes, price, compareAt, tags = [], intro, features }) {
  return {
    type: 'Wheels', category: 'wheels', vendor, title, price, compareAt, tags: ['builder', ...tags],
    options: [{ name: 'Durchmesser', values: sizes.map((s) => `${s} mm`) }],
    variants: sizes.map((s) => ({ options: { Durchmesser: `${s} mm` }, metafields: { wheel_size: s } })),
    metafields: { wheel_hardness: hardness, preview_color: color },
    features,
    descriptionHtml: html(intro, [`Härte: ${hardness}`, `Durchmesser: ${sizes.map((s) => `${s} mm`).join(' · ')}`, 'Lieferumfang: 4 Rollen']),
    art: { kind: 'wheels', color, print, hardness },
  };
}

function single(base) {
  return { ...base, options: null, variants: [{ options: {}, metafields: {}, stock: base.stock }] };
}

/* ------------------------------------------------------------------ */

const RAW = [
  // ---------------- Decks (8) ----------------
  deck({
    vendor: 'Nine Ply Co.', title: 'Sunset Stripe Deck', motif: 'sunset', shape: 'Popsicle', concave: 'Medium',
    widths: ['8.0', '8.25', '8.5'], price: '64.95', tags: ['bestseller', 'featured'],
    intro: 'Das Sunset Stripe Deck ist unser Allrounder für Park und Street: mittlerer Concave, gleichmäßiger Pop und eine Retro-Sonne auf der Unterseite. Gepresst aus sieben Lagen kanadischem Ahorn, bleibt es auch nach vielen Sessions formstabil.',
    features: ['7 Lagen kanadischer Ahorn', 'Mittlerer Concave für kontrollierten Pop', 'Symmetrischer Popsicle-Shape', 'Retro-Grafik mit Sonne und Streifen'],
  }),
  deck({
    vendor: 'Nine Ply Co.', title: 'Checker Classic Deck', motif: 'checker', shape: 'Popsicle', concave: 'Medium',
    widths: ['7.75', '8.0', '8.25'], price: '59.95', tags: ['bestseller'], stock: { '7.75': 0 },
    intro: 'Schachbrett, rote Kokarde, klassischer Popsicle-Shape: Das Checker Classic ist ein Deck ohne Schnickschnack. Die schmaleren Breiten machen es zum idealen Board für Einsteiger und technische Flip-Tricks.',
    features: ['Leicht und wendig in schmalen Breiten', 'Mittlerer Concave', '7 Lagen kanadischer Ahorn', 'Zeitlose Schachbrett-Grafik'],
  }),
  deck({
    vendor: 'Nine Ply Co.', title: 'Peak Deck', motif: 'peaks', shape: 'Shaped', concave: 'Medium',
    widths: ['8.25', '8.5', '9.0'], price: '67.95', tags: ['limited'],
    intro: 'Das Peak Deck hat eine geshapte Nose mit etwas mehr Standfläche vorn – ideal für Transition und Pool. Die Berg-Grafik mit Tri-Stripe gibt es nur in limitierter Auflage.',
    features: ['Shaped-Nose mit mehr Standfläche', 'Breiten bis 9.0"', 'Stabiler mittlerer Concave', 'Limitierte Grafik-Edition'],
  }),
  deck({
    vendor: 'Quarry Lane', title: 'Orbit Deck', motif: 'orbit', shape: 'Popsicle', concave: 'High',
    widths: ['8.25', '8.5', '8.75'], price: '69.95', compareAt: '79.95', tags: ['featured'],
    intro: 'Konzentrische Kreise in Blau und Lime – das Orbit Deck ist nicht zu übersehen. Der hohe Concave sorgt für schnellen Flick und viel Kontrolle bei technischen Tricks.',
    features: ['Hoher Concave für schnellen Flick', 'Popsicle-Shape mit steilen Kicks', '7 Lagen kanadischer Ahorn', 'Grafik mit Retro-Kreisen'],
  }),
  deck({
    vendor: 'Quarry Lane', title: 'Voltage Deck', motif: 'voltage', shape: 'Popsicle', concave: 'High',
    widths: ['8.0', '8.25', '8.38'], price: '64.95', tags: ['new', 'featured', 'bestseller'],
    intro: 'Ein gelber Blitz auf Anthrazit: Das Voltage Deck bringt Energie in jede Session. Steiler Concave, knackige Kicks und ein Pop, der lange hält.',
    features: ['Knackiger Pop dank steiler Kicks', 'Hoher Concave', 'Auch in 8.38" erhältlich', 'Grafik mit Blitz-Motiv'],
  }),
  deck({
    vendor: 'Quarry Lane', title: 'Tri-Stripe Deck', motif: 'tristripe', shape: 'Shaped', concave: 'Low',
    widths: ['8.5', '8.75', '9.0'], price: '72.95', tags: ['limited'],
    intro: 'Drei diagonale Streifen in Rot, Orange und Gelb – das Tri-Stripe Deck ist unsere Hommage an Retro-Skateboards. Flacher Concave und breite Shapes machen es komfortabel für Bowl und Cruisen.',
    features: ['Flacher Concave für entspanntes Fahren', 'Geshapte Nose', 'Breiten von 8.5" bis 9.0"', 'Limitierte Retro-Edition'],
  }),
  deck({
    vendor: 'Duskline', title: 'Polka Deck', motif: 'polka', shape: 'Popsicle', concave: 'Medium',
    widths: ['8.125', '8.25', '8.5'], price: '62.95', compareAt: '69.95', tags: ['new'],
    intro: 'Das Polka Deck kombiniert ein verspieltes Punktmuster mit einem mittleren Concave, der zu fast jedem Fahrstil passt. Die Zwischengröße 8.125" ist perfekt, wenn 8.0" zu schmal und 8.25" zu breit ist.',
    features: ['Auch in 8.125" erhältlich', 'Mittlerer Concave', 'Popsicle-Shape', 'Punktmuster in Lime und Anthrazit'],
  }),
  deck({
    vendor: 'Duskline', title: 'Wave Cruiser Deck', motif: 'waves', shape: 'Cruiser', concave: 'Low',
    widths: ['8.75', '9.0', '9.25'], price: '74.95', tags: ['featured'],
    intro: 'Breiter, kürzer, entspannter: Das Wave Cruiser Deck ist für Wege durch die Stadt und lange Abende am Wasser gemacht. Flacher Concave und runde Nose geben viel Standfläche, das Kicktail bleibt für schnelle Richtungswechsel.',
    features: ['Cruiser-Shape mit Kicktail', 'Flacher Concave, viel Standfläche', 'Ideal mit weichen Rollen ab 56 mm', 'Wellen-Grafik mit Retro-Sonne'],
  }),

  // ---------------- Trucks (5) ----------------
  trucks({
    vendor: 'Axlemoor', title: 'Standard Mid Trucks', color: '#B9BDC1', base: C.metal, height: 'Mid',
    widths: ['7.75', '8.0', '8.25', '8.5'], price: '54.95', tags: ['bestseller'],
    intro: 'Die Standard Mid ist die Achse für fast jedes Setup: mittlere Bauhöhe, stabiler Stand und ein gleichmäßiges Lenkverhalten. Hanger und Baseplate sind aus Aluminium, Kingpin und Achse aus Stahl.',
    features: ['Mittlere Bauhöhe für Rollen von 52 bis 56 mm', 'Lenkgummis in 92A', 'Breiten von 7.75" bis 8.5"', 'Preis gilt für ein Paar'],
  }),
  trucks({
    vendor: 'Axlemoor', title: 'Hollow Low Trucks', color: '#2E2F2D', base: '#3A3B39', bushing: C.orange, height: 'Low',
    widths: ['8.0', '8.25', '8.5'], price: '64.95', tags: ['new'],
    intro: 'Hohle Kingpins und Achsen sparen Gewicht, die niedrige Bauhöhe bringt das Board näher an den Boden. Perfekt für Flip-Tricks und kleine Rollen.',
    features: ['Hohlachse und Hohl-Kingpin', 'Niedrige Bauhöhe für Rollen von 50 bis 54 mm', 'Schwarz lackiert', 'Preis gilt für ein Paar'],
  }),
  trucks({
    vendor: 'Axlemoor', title: 'Retro Blue Trucks', color: C.blue, height: 'Mid',
    widths: ['8.0', '8.25', '8.5'], price: '59.95', compareAt: '64.95',
    intro: 'Technisch ist die Retro Blue eine Standard Mid – nur in kräftigem Retro-Blau lackiert. Sie passt farblich zu fast jeder Deck-Grafik.',
    features: ['Mittlere Bauhöhe', 'Pulverbeschichtung in Retro-Blau', 'Lenkgummis in 92A', 'Preis gilt für ein Paar'],
  }),
  trucks({
    vendor: 'Boltworks', title: 'Forged High Trucks', color: C.accent, bushing: C.cream, height: 'High',
    widths: ['8.25', '8.5'], price: '69.95', tags: ['limited'],
    intro: 'Geschmiedete Baseplates und eine hohe Bauweise machen die Forged High zur ersten Wahl für Transition und große Rollen. Die rote Lackierung ist limitiert.',
    features: ['Geschmiedete Baseplate', 'Hohe Bauweise für Rollen ab 56 mm', 'Weichere Lenkgummis (90A)', 'Limitierte Farbe'],
  }),
  trucks({
    vendor: 'Boltworks', title: 'Cruise High Trucks', color: C.yellow, bushing: C.accent, height: 'High',
    widths: ['8.0', '8.25', '8.5'], price: '57.95',
    intro: 'Weiche Lenkgummis, hohe Bauweise, sonnengelber Lack: Die Cruise High macht jedes Deck zum wendigen Cruiser. Zusammen mit weichen Rollen rollst du entspannt über jeden Belag.',
    features: ['Viel Platz für große Rollen', 'Weiche Lenkgummis (88A)', 'Gelb lackiert', 'Preis gilt für ein Paar'],
  }),

  // ---------------- Wheels (5) ----------------
  wheels({
    vendor: 'Rolltype', title: 'Classic Formula Wheels', color: '#F7F4EC', print: C.accent, hardness: '99A',
    sizes: [52, 53, 54], price: '39.95', tags: ['bestseller'],
    intro: 'Die Classic Formula ist eine harte Rolle für Park und Street: schnell auf glattem Beton, gut kontrollierbar in Slides. Die rote Retro-Bedruckung ist ein Klassiker.',
    features: ['Härte 99A', 'Klassische Form mit abgerundeter Kante', '52 bis 54 mm für Street und Park', 'Satz mit 4 Rollen'],
  }),
  wheels({
    vendor: 'Rolltype', title: 'Conical Pro Wheels', color: '#F1E4C3', print: C.blue, hardness: '84B',
    sizes: [53, 54, 56], price: '44.95', tags: ['new'],
    intro: 'Konische Form, breite Lauffläche, sehr harte 84B-Formel: Die Conical Pro hält jeden Lock-in auf Curbs und Coping. Sie bleibt auch nach vielen Powerslides rund.',
    features: ['Härte 84B (entspricht etwa 104A)', 'Konische Form für Grinds', 'Resistent gegen Flatspots', 'Satz mit 4 Rollen'],
  }),
  wheels({
    vendor: 'Rolltype', title: 'Street Soft Wheels', color: C.orange, print: C.ink, hardness: '92A',
    sizes: [54, 56], price: '42.95', compareAt: '49.95',
    intro: 'Etwas weicher als üblich: Die Street Soft dämpft rauen Asphalt, ohne beim Tricksen schwammig zu wirken. Ideal für Street-Spots mit grobem Belag.',
    features: ['Härte 92A', 'Dämpft Vibrationen auf rauem Asphalt', '54 und 56 mm', 'Satz mit 4 Rollen'],
  }),
  wheels({
    vendor: 'Rolltype', title: 'Cruiser Soft Wheels', color: C.lime, print: C.ink, hardness: '78A',
    sizes: [56, 58, 60], price: '49.95', tags: ['limited'],
    intro: 'Große, weiche Rollen für Cruiser und den Weg zur Arbeit: Die Cruiser Soft rollt über Steine und Risse, als wären sie nicht da. Ab 58 mm empfehlen wir Riser Pads gegen Wheelbite.',
    features: ['Härte 78A', '56, 58 und 60 mm', 'Ab 58 mm mit Riser Pads fahren', 'Satz mit 4 Rollen'],
  }),
  wheels({
    vendor: 'Swiftbore', title: 'Speedline Wheels', color: C.blue, print: C.cream, hardness: '97A',
    sizes: [53, 54, 56, 58], price: '46.95', tags: ['bestseller'],
    intro: 'Die Speedline ist auf Tempo ausgelegt: Die 97A-Formel und die schmale Lauffläche machen sie schnell und trotzdem griffig. Gut für Skateparks mit glatten Flächen.',
    features: ['Härte 97A', 'Schmale Lauffläche, schnelles Anrollen', '53 bis 58 mm', 'Satz mit 4 Rollen'],
  }),

  // ---------------- Bearings (3) ----------------
  single({
    type: 'Bearings', category: 'bearings', vendor: 'Swiftbore', title: 'Street 7 Bearings', price: '19.95', tags: ['builder', 'bestseller'],
    metafields: { bearing_rating: 'ABEC 7' },
    features: ['ABEC 7', 'Abnehmbarer Gummi-Shield', 'Vorgeölt und sofort einsatzbereit', '8er-Set für ein Board'],
    descriptionHtml: html('Solide Kugellager für jeden Tag: Die Street 7 laufen leise, sind vorgeölt und leicht zu reinigen. Der abnehmbare Gummi-Shield hält Staub draußen.', ['Klasse: ABEC 7', 'Größe: 608 (Standard)', 'Lieferumfang: 8 Kugellager']),
    art: { kind: 'bearings', shield: C.accent, print: C.cream, label: 'ABEC 7' },
  }),
  single({
    type: 'Bearings', category: 'bearings', vendor: 'Swiftbore', title: 'Swiss Precision Bearings', price: '59.95', tags: ['builder', 'limited'],
    metafields: { bearing_rating: 'Swiss' },
    features: ['Swiss-Qualität', 'Hochfester Stahl', 'Leicht zu reinigen', '8er-Set in limitierter Edition'],
    descriptionHtml: html('Gehärteter Stahl, präzise Käfige und hochwertige Schmierung: Die Swiss Precision gehören zu den schnellsten Lagern in unserem Sortiment. Sie halten auch harte Landungen aus.', ['Klasse: Swiss', 'Größe: 608 (Standard)', 'Lieferumfang: 8 Kugellager']),
    art: { kind: 'bearings', shield: C.ink, print: C.yellow, label: 'SWISS' },
  }),
  single({
    type: 'Bearings', category: 'bearings', vendor: 'Rolltype', title: 'Ceramic Race Bearings', price: '89.95', compareAt: '99.95', tags: ['builder', 'new'],
    metafields: { bearing_rating: 'Ceramic' },
    features: ['Keramikkugeln, rostfrei', 'Offene Bauweise, leicht zu reinigen', 'Geringer Rollwiderstand', '8er-Set'],
    descriptionHtml: html('Keramikkugeln sind leichter und härter als Stahl – die Ceramic Race rollen dadurch länger und rosten nicht. Die offene Bauweise macht das Reinigen besonders einfach.', ['Bauart: Ceramic', 'Größe: 608 (Standard)', 'Lieferumfang: 8 Kugellager']),
    art: { kind: 'bearings', shield: C.blue, print: C.cream, label: 'CERAMIC', open: true },
  }),

  // ---------------- Griptape (3) ----------------
  single({
    type: 'Griptape', category: 'griptape', vendor: 'Gritfield', title: 'Classic Black Grip', price: '8.95', tags: ['builder', 'bestseller'],
    metafields: { grip_style: 'Standard', preview_color: C.grip },
    features: ['Blatt 9" x 33"', 'Mikroperforation gegen Luftblasen', 'Mittelgrobe Körnung', 'Schwarz'],
    descriptionHtml: html('Das Classic Black ist Griptape, wie es sein soll: griffig, langlebig und dank Mikroperforation blasenfrei zu verkleben. Ein Blatt reicht für ein Deck bis 9" Breite.', ['Stil: Standard', 'Größe: 9" x 33"', 'Lieferumfang: 1 Blatt']),
    art: { kind: 'griptape', colors: [C.grip] },
  }),
  {
    type: 'Griptape', category: 'griptape', vendor: 'Gritfield', title: 'Color Grip', price: '11.95', tags: ['builder'],
    options: [{ name: 'Farbe', values: ['Blau', 'Orange', 'Lime', 'Rot'] }],
    variants: [
      { options: { Farbe: 'Blau' }, metafields: { preview_color: C.blue } },
      { options: { Farbe: 'Orange' }, metafields: { preview_color: C.orange } },
      { options: { Farbe: 'Lime' }, metafields: { preview_color: C.lime } },
      { options: { Farbe: 'Rot' }, metafields: { preview_color: C.accent } },
    ],
    metafields: { grip_style: 'Color', preview_color: C.blue },
    features: ['Blatt 9" x 33"', 'Vier Farben: Blau, Orange, Lime, Rot', 'Mikroperforation', 'Farbechte Beschichtung'],
    descriptionHtml: html('Farbe fürs Deck: Das Color Grip gibt es in vier Retro-Tönen, mit derselben Körnung wie unser Classic Black. Ideal, um dein Setup farblich abzustimmen.', ['Stil: Color', 'Größe: 9" x 33"', 'Lieferumfang: 1 Blatt']),
    art: { kind: 'griptape', colors: [C.blue, C.orange, C.lime] },
  },
  single({
    type: 'Griptape', category: 'griptape', vendor: 'Duskline', title: 'Checker Grip', price: '14.95', tags: ['builder', 'limited'],
    metafields: { grip_style: 'Pattern', preview_color: C.grip },
    features: ['Lasergeschnittenes Schachbrett-Muster', 'Blatt 9" x 33"', 'Mikroperforation', 'Limitierte Auflage'],
    descriptionHtml: html('Ein lasergeschnittenes Schachbrett in Schwarz und Grau: Das Checker Grip ist ein Hingucker auf der Oberseite deines Boards. Die Auflage ist limitiert.', ['Stil: Pattern', 'Größe: 9" x 33"', 'Lieferumfang: 1 Blatt']),
    art: { kind: 'griptape', colors: [C.grip], pattern: 'checker' },
  }),

  // ---------------- Hardware (2) ----------------
  {
    type: 'Hardware', category: 'hardware', vendor: 'Boltworks', title: 'Allen Bolts', price: '5.95', tags: ['builder', 'bestseller'],
    options: [{ name: 'Länge', values: ['7/8"', '1"', '1 1/8"'] }],
    variants: [0.875, 1, 1.125].map((l) => ({ options: { 'Länge': LENGTH_LABEL[l] }, metafields: { hardware_length: l } })),
    metafields: {},
    features: ['8 Schrauben und 8 Muttern', 'Innensechskant', 'Selbstsichernde Muttern', 'Sechskantschlüssel liegt bei'],
    descriptionHtml: html('Innensechskant-Schrauben mit selbstsichernden Muttern – ein Satz für ein Board. Die Länge richtet sich nach deinem Setup: 7/8" ohne Riser, 1" mit 1/8"-Riser, 1 1/8" mit 1/4"-Riser.', ['Kopf: Innensechskant', 'Längen: 7/8" · 1" · 1 1/8"', 'Lieferumfang: 8 Schrauben, 8 Muttern']),
    art: { kind: 'hardware', colors: [C.ink], head: 'allen' },
  },
  {
    type: 'Hardware', category: 'hardware', vendor: 'Boltworks', title: 'Phillips Color Bolts', price: '6.95', tags: ['builder'],
    options: [{ name: 'Länge', values: ['7/8"', '1"', '1 1/8"'] }, { name: 'Farbe', values: ['Schwarz', 'Silber', 'Rot'] }],
    variants: [0.875, 1, 1.125].flatMap((l) =>
      [['Schwarz', C.ink], ['Silber', C.metal], ['Rot', C.accent]].map(([farbe, color]) => ({
        options: { 'Länge': LENGTH_LABEL[l], Farbe: farbe },
        metafields: { hardware_length: l, preview_color: color },
      }))
    ),
    metafields: { preview_color: C.ink },
    features: ['8 Schrauben und 8 Muttern', 'Kreuzschlitz', 'Drei Farben', 'Drei Längen'],
    descriptionHtml: html('Kreuzschlitz-Schrauben mit farbigen Köpfen – so erkennst du auf einen Blick, wo die Nose ist. Wähle Länge und Farbe passend zu deinem Setup.', ['Kopf: Kreuzschlitz', 'Längen: 7/8" · 1" · 1 1/8"', 'Farben: Schwarz · Silber · Rot', 'Lieferumfang: 8 Schrauben, 8 Muttern']),
    art: { kind: 'hardware', colors: [C.ink, C.metal, C.accent], head: 'phillips' },
  },

  // ---------------- Riser (2) ----------------
  single({
    type: 'Riser Pads', category: 'riser', vendor: 'Boltworks', title: 'Shock Pads 1/8"', price: '6.95', tags: ['builder'],
    metafields: { riser_height: 0.125 },
    features: ['Höhe 1/8"', 'Weiches, dämpfendes Material', 'Für alte und neue Lochbilder', '2 Stück'],
    descriptionHtml: html('Dünne, elastische Shock Pads dämpfen Stöße und schonen das Deck an den Bohrungen. Mit 1/8" Höhe sind sie ideal für Rollen bis 56 mm.', ['Höhe: 1/8"', 'Passende Schrauben: 1"', 'Lieferumfang: 2 Pads']),
    art: { kind: 'riser', color: '#2E2F2D', heightIn: 0.125, label: '1/8"' },
  }),
  single({
    type: 'Riser Pads', category: 'riser', vendor: 'Axlemoor', title: 'Riser Pads 1/4"', price: '7.95', tags: ['builder'],
    metafields: { riser_height: 0.25 },
    features: ['Höhe 1/4"', 'Gegen Wheelbite bei Rollen ab 58 mm', 'Formstabiler Kunststoff', '2 Stück'],
    descriptionHtml: html('Mit 1/4" Riser Pads bekommt dein Setup mehr Abstand zwischen Rollen und Deck – das verhindert Wheelbite bei großen Rollen ab 58 mm. Das harte Material bleibt formstabil.', ['Höhe: 1/4"', 'Passende Schrauben: 1 1/8"', 'Lieferumfang: 2 Pads']),
    art: { kind: 'riser', color: C.blue, heightIn: 0.25, label: '1/4"' },
  }),

  // ---------------- Completes (3) ----------------
  single({
    type: 'Complete', category: 'complete', vendor: 'Nine Ply Co.', title: 'Sunset Complete 8.0"', price: '119.95', tags: ['bestseller', 'featured'],
    metafields: { deck_width: 8.0, deck_length: 31.75, wheelbase: 14.25, concave: 'Medium', deck_shape: 'Popsicle', truck_width: 8.0, truck_height: 'Mid', wheel_size: 53, wheel_hardness: '99A', bearing_rating: 'ABEC 7', grip_style: 'Standard', preview_color: C.accent },
    features: ['Deck 8.0" x 31.75"', 'Achsen Mid, Rollen 53 mm 99A', 'ABEC-7-Kugellager, schwarzes Griptape', 'Fertig montiert'],
    descriptionHtml: html('Fertig montiert und sofort fahrbereit: Das Sunset Complete kombiniert unser Sunset Stripe Deck in 8.0" mit Standard-Mid-Achsen, 53-mm-Rollen und ABEC-7-Lagern. Ein Board für Einsteiger und alle, die ohne Schrauben loslegen wollen.', ['Deck: Sunset Stripe, 8.0" x 31.75"', 'Achsen: Mid, 8.0"', 'Rollen: 53 mm, 99A', 'Kugellager: ABEC 7']),
    art: { kind: 'complete', motif: 'sunset', shape: 'popsicle', widthIn: 8.0, lengthIn: 31.75, wheelbaseIn: 14.25, truckColor: '#B9BDC1', wheelColor: '#F7F4EC' },
  }),
  single({
    type: 'Complete', category: 'complete', vendor: 'Quarry Lane', title: 'Voltage Complete 8.25"', price: '129.95', compareAt: '149.95', tags: ['new', 'featured'],
    metafields: { deck_width: 8.25, deck_length: 32.0, wheelbase: 14.25, concave: 'High', deck_shape: 'Popsicle', truck_width: 8.25, truck_height: 'Low', wheel_size: 54, wheel_hardness: '99A', bearing_rating: 'ABEC 7', grip_style: 'Standard', preview_color: C.yellow },
    features: ['Deck 8.25" x 32", hoher Concave', 'Achsen Low, Rollen 54 mm 99A', 'ABEC-7-Kugellager', 'Fertig montiert'],
    descriptionHtml: html('Das Voltage Complete ist für technische Street-Sessions aufgebaut: hoher Concave, leichte Hollow-Low-Achsen und harte 54-mm-Rollen. Montiert, geprüft und bereit für den ersten Kickflip.', ['Deck: Voltage, 8.25" x 32"', 'Achsen: Low, 8.25"', 'Rollen: 54 mm, 99A', 'Kugellager: ABEC 7']),
    art: { kind: 'complete', motif: 'voltage', shape: 'popsicle', widthIn: 8.25, lengthIn: 32.0, wheelbaseIn: 14.25, truckColor: '#2E2F2D', wheelColor: '#F7F4EC' },
  }),
  single({
    type: 'Complete', category: 'complete', vendor: 'Duskline', title: 'Wave Cruiser Complete 8.75"', price: '139.95', tags: ['featured'],
    metafields: { deck_width: 8.75, deck_length: 30.25, wheelbase: 14.0, concave: 'Low', deck_shape: 'Cruiser', truck_width: 8.5, truck_height: 'High', wheel_size: 58, wheel_hardness: '78A', bearing_rating: 'ABEC 7', grip_style: 'Standard', riser_height: 0.25, preview_color: C.blue },
    features: ['Cruiser-Deck 8.75" x 30.25"', 'Hohe Achsen, weiche Rollen 58 mm 78A', 'Riser Pads 1/4" gegen Wheelbite', 'Fertig montiert'],
    descriptionHtml: html('Das Wave Cruiser Complete bringt dich entspannt durch die Stadt: breites Cruiser-Deck, hohe Achsen und weiche 58-mm-Rollen auf Riser Pads. Kaum ein Board rollt komfortabler über Kopfsteinpflaster.', ['Deck: Wave Cruiser, 8.75" x 30.25"', 'Achsen: High, 8.5"', 'Rollen: 58 mm, 78A', 'Riser: 1/4"']),
    art: { kind: 'complete', motif: 'waves', shape: 'cruiser', widthIn: 8.75, lengthIn: 30.25, wheelbaseIn: 14.0, truckColor: C.yellow, wheelColor: C.lime },
  }),

  // ---------------- Zubehör (2) ----------------
  single({
    type: 'Zubehör', category: 'accessory', vendor: 'Boltworks', title: 'Skate Tool', price: '14.95', tags: ['new'],
    metafields: {},
    features: ['Nüsse 3/8", 1/2" und 9/16"', 'Ausklappbarer Sechskantschlüssel', 'Gummierter Griff', 'Passt in jede Tasche'],
    descriptionHtml: html('Das Skate Tool hat alles, was du unterwegs brauchst: Nüsse für Achsmuttern, Kingpin und Schrauben sowie einen ausklappbaren Sechskantschlüssel. Kompakt genug für jede Hosentasche.', ['Nüsse: 3/8" · 1/2" · 9/16"', 'Material: Stahl, gummierter Griff']),
    art: { kind: 'tool' },
  }),
  single({
    type: 'Zubehör', category: 'accessory', vendor: 'Gritfield', title: 'Curb Wax', price: '6.95', stock: 1,
    metafields: {},
    features: ['Für Curbs, Ledges und Rails', 'Harte Formel, schmilzt nicht so schnell', 'Runde Form, liegt gut in der Hand', 'Etwa 80 g'],
    descriptionHtml: html('Ein paar Striche Wachs auf Curbs und Ledges, und deine Slides laufen wie auf Schienen. Das Curb Wax ist hart genug für warme Tage und leicht aufzutragen.', ['Gewicht: etwa 80 g', 'Form: Puck']),
    art: { kind: 'wax' },
  }),
];

const ALT_VIEWS = {
  deck: ['Unterseite mit Grafik', 'Oberseite mit Griptape'],
  complete: ['schräge Ansicht', 'Unterseite mit Achsen und Rollen'],
  trucks: ['Frontansicht', 'Seitenansicht'],
  wheels: ['Set mit 4 Rollen', 'Einzelne Rolle mit Härteangabe'],
  bearings: ['Set mit 8 Kugellagern', 'Einzelnes Kugellager'],
  griptape: ['Griptape-Blatt', 'Detail der Körnung'],
  hardware: ['Schrauben-Set mit Muttern', 'Einzelne Schraube mit Längenangaben'],
  riser: ['Riser-Set von oben', 'Seitenansicht mit Höhenangabe'],
  tool: ['Skate Tool', 'Detail der Nüsse'],
  wax: ['Wachs-Puck', 'Wachs auf einem Curb'],
};

const TYPE_PREFIX = { Deck: 'DK', Trucks: 'TR', Wheels: 'WH', Bearings: 'BR', Griptape: 'GT', Hardware: 'HW', 'Riser Pads': 'RS', Complete: 'CP', 'Zubehör': 'AC' };

/** Final catalogue with handles, SKUs, stock and image file names. */
export const PRODUCTS = RAW.map((p, index) => {
  const handle = slugify(`${p.vendor} ${p.title}`);
  const typeCount = RAW.slice(0, index + 1).filter((q) => q.type === p.type).length;
  const skuBase = `SKD-${TYPE_PREFIX[p.type]}-${String(typeCount).padStart(2, '0')}`;
  const variants = p.variants.map((v) => {
    const suffix = Object.values(v.options).map((o) => slugify(o).toUpperCase()).join('-');
    const sku = suffix ? `${skuBase}-${suffix}` : skuBase;
    const stock = v.stock ?? 5 + (hash(sku) % 36);
    return { ...v, sku, stock, price: p.price, compareAt: p.compareAt || null };
  });
  const views = ALT_VIEWS[p.art.kind];
  const name = `${p.title} von ${p.vendor}`;
  return {
    ...p,
    handle,
    tags: ['skate-demo', ...(p.tags || [])],
    variants,
    images: views.map((view, i) => ({ file: `skate-demo-p-${handle}-${i + 1}.png`, alt: `${name} – ${view}` })),
    layer: p.previewLayer ? { file: `skate-demo-layer-${handle}.png`, alt: `Vorschau-Grafik ${name}` } : null,
  };
});

export const BY_CATEGORY = PRODUCTS.reduce((acc, p) => {
  (acc[p.category] ||= []).push(p.handle);
  return acc;
}, {});
