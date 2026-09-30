// Collections, pages and menus for the demo store (German texts).
import { BRANDS } from './brands.mjs';

const TYPE = (condition) => ({ column: 'TYPE', relation: 'EQUALS', condition });
const TAG = (condition) => ({ column: 'TAG', relation: 'EQUALS', condition });

const CATEGORY = [
  {
    handle: 'decks', title: 'Decks', type: 'Deck', image: 'skate-demo-cat-decks.png', banner: 'skate-demo-banner-decks.png',
    description: 'Skateboard-Decks aus kanadischem Ahorn in Breiten von 7.75" bis 9.25" – Popsicle, Shaped und Cruiser.',
    seo: [
      'Das Deck ist das Herz deines Skateboards. Die Breite richtet sich nach Schuhgröße und Fahrstil: Schmale Decks um 8.0" sind leicht und drehfreudig, breite Decks ab 8.5" geben mehr Stand in Bowl und Transition.',
      'Alle Decks im Shop sind aus sieben Lagen kanadischem Ahorn gepresst. Concave und Shape bestimmen das Fahrgefühl – unsere Größenberatung hilft dir bei der Wahl.',
    ],
  },
  {
    handle: 'trucks', title: 'Trucks', type: 'Trucks', image: 'skate-demo-cat-trucks.png', banner: 'skate-demo-banner-trucks.png',
    description: 'Skateboard-Achsen in Low, Mid und High – passend zur Breite deines Decks.',
    seo: [
      'Die Achsbreite sollte ungefähr der Deckbreite entsprechen, damit die Rollen bündig mit der Kante abschließen. Die Bauhöhe entscheidet, wie groß deine Rollen sein dürfen.',
      'Niedrige Achsen sind stabil für Flip-Tricks, hohe Achsen geben Platz für große Rollen und lenken direkter. Alle Preise gelten für ein Paar.',
    ],
  },
  {
    handle: 'wheels', title: 'Wheels', type: 'Wheels', image: 'skate-demo-cat-wheels.png', banner: 'skate-demo-banner-wheels.png',
    description: 'Skateboard-Rollen von 52 bis 60 mm in Härten von 78A bis 84B.',
    seo: [
      'Kleine, harte Rollen (52–54 mm, ab 99A) sind schnell und präzise im Park. Große, weiche Rollen ab 56 mm dämpfen raue Straßen und eignen sich für Cruiser.',
      'Ab 58 mm Durchmesser empfehlen wir Riser Pads, damit die Rollen in engen Kurven nicht am Deck schleifen (Wheelbite).',
    ],
  },
  {
    handle: 'bearings', title: 'Bearings', type: 'Bearings', image: 'skate-demo-cat-bearings.png',
    description: 'Kugellager von ABEC 7 über Swiss bis Ceramic – je acht Stück pro Set.',
    seo: [
      'Ein Board braucht acht Kugellager, zwei pro Rolle. Die ABEC-Klasse beschreibt die Fertigungstoleranz; beim Skaten zählen vor allem robuste Käfige und gute Schmierung.',
      'Keramikkugeln sind leichter, härter und rosten nicht. Regelmäßiges Reinigen verlängert die Lebensdauer aller Lager.',
    ],
  },
  {
    handle: 'griptape', title: 'Griptape', type: 'Griptape',
    description: 'Griptape in Schwarz, Farbe und Muster – Blätter im Format 9" x 33".',
    seo: ['Griptape sorgt für Halt auf dem Board. Mikroperforation lässt Luft entweichen, damit beim Aufkleben keine Blasen entstehen.'],
  },
  {
    handle: 'hardware', title: 'Hardware', type: 'Hardware',
    description: 'Schrauben-Sets in 7/8", 1" und 1 1/8" – je acht Schrauben und Muttern.',
    seo: ['Die Schraubenlänge hängt davon ab, ob du Riser Pads fährst: ohne Riser 7/8", mit 1/8"-Riser 1", mit 1/4"-Riser 1 1/8".'],
  },
  {
    handle: 'risers', title: 'Riser Pads', type: 'Riser Pads',
    description: 'Riser und Shock Pads in 1/8" und 1/4" gegen Wheelbite.',
    seo: ['Riser Pads vergrößern den Abstand zwischen Rollen und Deck. Shock Pads dämpfen zusätzlich Stöße und schonen das Holz rund um die Bohrungen.'],
  },
  {
    handle: 'completes', title: 'Completes', type: 'Complete', image: 'skate-demo-cat-completes.png',
    description: 'Fertig montierte Skateboards – sofort fahrbereit.',
    seo: [
      'Ein Complete ist ideal für den Einstieg: Deck, Achsen, Rollen, Kugellager, Griptape und Schrauben sind aufeinander abgestimmt und montiert.',
      'Wer lieber selbst kombiniert, stellt sein Board im Konfigurator Schritt für Schritt zusammen.',
    ],
  },
  {
    handle: 'accessories', title: 'Zubehör', type: 'Zubehör',
    description: 'Skate Tools, Wachs und alles, was du unterwegs brauchst.',
    seo: ['Mit einem Skate Tool stellst du Achsen nach und wechselst Rollen in wenigen Minuten. Curb-Wachs lässt Slides auf Kanten und Ledges gleichmäßig laufen.'],
  },
];

const BUILDER = [
  ['builder-decks', 'Decks', 'Deck'],
  ['builder-trucks', 'Trucks', 'Trucks'],
  ['builder-wheels', 'Wheels', 'Wheels'],
  ['builder-bearings', 'Bearings', 'Bearings'],
  ['builder-griptape', 'Griptape', 'Griptape'],
  ['builder-hardware', 'Hardware', 'Hardware'],
  ['builder-risers', 'Riser Pads', 'Riser Pads'],
];

/** Every rule set also requires the tag `skate-demo`, so products of other projects never leak in. */
export const COLLECTIONS = [
  ...CATEGORY.map((c) => ({ ...c, rules: [TYPE(c.type), TAG('skate-demo')] })),
  ...BUILDER.map(([handle, title, type]) => ({
    handle, title: `Builder: ${title}`, rules: [TYPE(type), TAG('builder'), TAG('skate-demo')],
    description: `Produktquelle für den Skateboard-Konfigurator (Schritt ${title}).`,
  })),
  { handle: 'bestsellers', title: 'Bestseller', rules: [TAG('bestseller'), TAG('skate-demo')], description: 'Die meistverkauften Boards und Teile im Shop.' },
  { handle: 'featured-boards', title: 'Featured Boards', rules: [TAG('featured'), TAG('skate-demo')], description: 'Ausgewählte Decks und Completes mit Retro-Grafiken.' },
  { handle: 'skate-all', title: 'Alle Skate-Produkte', rules: [TAG('skate-demo')], description: 'Das komplette Sortiment: Decks, Achsen, Rollen, Kugellager und Zubehör.' },
];

const demoNote = '<p><em>Hinweis: Dies ist ein Demo-Text für den Entwicklungs-Shop.</em></p>';

export const PAGES = [
  {
    handle: 'skateboard-builder', title: 'Skateboard-Konfigurator', templateSuffix: 'skateboard-builder',
    body: '<p>Stell dir dein Skateboard in sechs Schritten zusammen: Deck, Achsen, Rollen, Kugellager, Griptape und Schrauben. Der Konfigurator zeigt dir, welche Teile zusammenpassen, und legt dein Board als Build in den Warenkorb.</p>',
  },
  {
    handle: 'brands', title: 'Marken', templateSuffix: 'brands',
    body: `<p>Alle Marken im Shop auf einen Blick – von Decks über Achsen und Rollen bis zu Kleinteilen.</p>\n<ul>\n${BRANDS.map((b) => `  <li><strong>${b.name}</strong> (${b.focus}): ${b.text}</li>`).join('\n')}\n</ul>\n${demoNote}`,
  },
  {
    handle: 'contact', title: 'Kontakt', templateSuffix: 'contact',
    body: '<p>Fragen zu Größen, Teilen oder deiner Bestellung? Schreib uns – wir antworten in der Regel innerhalb eines Werktags.</p>',
  },
  {
    handle: 'versand', title: 'Versand',
    body: `<p>Wir versenden alle Bestellungen innerhalb von 1–2 Werktagen. Du erhältst eine Versandbestätigung mit Sendungsnummer.</p>
<ul>
  <li><strong>Standard (USA):</strong> 3–5 Werktage, $5.95 – kostenlos ab $75 Bestellwert</li>
  <li><strong>Express (USA):</strong> 1–2 Werktage, $14.95</li>
  <li><strong>International:</strong> 7–14 Werktage, ab $19.95</li>
</ul>
<p>Completes werden fertig montiert und gut gepolstert verschickt. Decks mit aufgeklebtem Griptape gelten als Sonderanfertigung.</p>
${demoNote}`,
  },
  {
    handle: 'rueckgabe', title: 'Rückgabe & Umtausch',
    body: `<p>Du hast 30 Tage Zeit, ungefahrene Artikel in Originalverpackung zurückzuschicken oder umzutauschen.</p>
<ol>
  <li>Schreib uns über das Kontaktformular mit deiner Bestellnummer.</li>
  <li>Du bekommst ein Rücksendeetikett per E-Mail.</li>
  <li>Nach Eingang prüfen wir die Ware und erstatten den Betrag innerhalb von 5 Werktagen.</li>
</ol>
<p>Ausgeschlossen sind Decks mit aufgeklebtem Griptape, benutzte Kugellager und individuell montierte Builds.</p>
${demoNote}`,
  },
  {
    handle: 'ueber-uns', title: 'Über uns',
    body: `<p>Wir sind ein kleiner Skateshop mit einer großen Liebe zu Retro-Grafiken und gut abgestimmten Setups. Jedes Teil im Sortiment haben wir selbst gefahren.</p>
<p>Mit dem Skateboard-Konfigurator kannst du dein Board Schritt für Schritt zusammenstellen – wir montieren es auf Wunsch und schicken es fahrbereit zu dir.</p>
${demoNote}`,
  },
  {
    handle: 'groessenberatung', title: 'Größenberatung',
    body: `<p>Die richtige Deckbreite hängt von Schuhgröße, Fahrstil und persönlichem Geschmack ab. Die Tabelle ist ein guter Startpunkt.</p>
<table>
  <thead>
    <tr><th scope="col">Deckbreite</th><th scope="col">Schuhgröße (EU)</th><th scope="col">Fahrstil</th><th scope="col">Achsbreite</th><th scope="col">Rollen</th></tr>
  </thead>
  <tbody>
    <tr><td>7.5"–7.75"</td><td>bis 38</td><td>Kids, technische Flip-Tricks</td><td>7.5"–7.75"</td><td>50–52 mm</td></tr>
    <tr><td>8.0"–8.125"</td><td>38–42</td><td>Street, Allround</td><td>8.0"</td><td>52–54 mm</td></tr>
    <tr><td>8.25"–8.38"</td><td>42–45</td><td>Allround, Park</td><td>8.25"</td><td>53–55 mm</td></tr>
    <tr><td>8.5"–8.75"</td><td>44–47</td><td>Park, Transition</td><td>8.5"</td><td>54–56 mm</td></tr>
    <tr><td>9.0" und breiter</td><td>ab 46</td><td>Bowl, Pool, Cruiser</td><td>8.5"–9.0"</td><td>56–60 mm (mit Riser)</td></tr>
  </tbody>
</table>
<h2>Faustregeln</h2>
<ul>
  <li>Die Achsbreite sollte höchstens 1/4" von der Deckbreite abweichen.</li>
  <li>Ab 58 mm Rollen: Riser Pads 1/4" und Schrauben 1 1/8".</li>
  <li>Mehr Concave bedeutet schnelleren Flick, weniger Concave mehr Komfort.</li>
</ul>
${demoNote}`,
  },
];

/** Menu item helpers: `c` = collection handle, `p` = page handle, `u` = URL. */
const c = (title, handle, items) => ({ title, collection: handle, items });
const p = (title, handle) => ({ title, page: handle });

export const MENUS = [
  {
    handle: 'skate-main-menu', title: 'Skate Hauptmenü',
    items: [
      c('Skateboards', 'skate-all', [c('Completes', 'completes'), c('Decks', 'decks'), c('Trucks', 'trucks'), c('Wheels', 'wheels'), c('Bearings', 'bearings')]),
      c('Decks', 'decks'),
      c('Trucks', 'trucks'),
      c('Wheels', 'wheels'),
      c('Bearings', 'bearings'),
      c('Zubehör', 'accessories', [c('Griptape', 'griptape'), c('Hardware', 'hardware'), c('Riser Pads', 'risers'), c('Zubehör', 'accessories')]),
      p('Konfigurator', 'skateboard-builder'),
      p('Brands', 'brands'),
    ],
  },
  {
    handle: 'skate-footer-shop', title: 'Skate Footer: Shop',
    items: [c('Completes', 'completes'), c('Decks', 'decks'), c('Trucks', 'trucks'), c('Wheels', 'wheels'), c('Bearings', 'bearings'), c('Zubehör', 'accessories'), c('Bestseller', 'bestsellers'), c('Alle Produkte', 'skate-all')],
  },
  {
    handle: 'skate-footer-help', title: 'Skate Footer: Hilfe',
    items: [p('Versand', 'versand'), p('Rückgabe', 'rueckgabe'), p('Größenberatung', 'groessenberatung'), p('Kontakt', 'contact')],
  },
  {
    handle: 'skate-footer-about', title: 'Skate Footer: Über uns',
    items: [p('Über uns', 'ueber-uns'), p('Brands', 'brands'), p('Konfigurator', 'skateboard-builder')],
  },
];
