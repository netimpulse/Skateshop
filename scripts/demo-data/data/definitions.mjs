// Metafield definitions from plan section 2e (+ Revision 1: custom.hidden_filters).
// The description suffix marks definitions created by this seed; cleanup --definitions only deletes those.

export const DEF_MARKER = '[skate-demo]';

export const DEFINITIONS = [
  {
    key: 'builder_category', name: 'Builder-Kategorie', type: 'single_line_text_field', owners: ['PRODUCT'],
    choices: ['deck', 'trucks', 'wheels', 'bearings', 'griptape', 'hardware', 'riser', 'complete', 'accessory'],
    description: 'Teiletyp für Board-Builder, Tech-Specs und Platzhalter.',
  },
  { key: 'deck_width', name: 'Deckbreite', type: 'number_decimal', owners: ['PRODUCT', 'PRODUCTVARIANT'], description: 'Deckbreite in Zoll, z. B. 8.25.' },
  { key: 'deck_length', name: 'Decklänge', type: 'number_decimal', owners: ['PRODUCT', 'PRODUCTVARIANT'], description: 'Decklänge in Zoll, z. B. 32.' },
  { key: 'wheelbase', name: 'Radstand', type: 'number_decimal', owners: ['PRODUCT', 'PRODUCTVARIANT'], description: 'Radstand (innere Bohrungen) in Zoll.' },
  { key: 'concave', name: 'Concave', type: 'single_line_text_field', owners: ['PRODUCT'], choices: ['Low', 'Medium', 'High'], description: 'Wölbung des Decks.' },
  { key: 'deck_shape', name: 'Deck-Shape', type: 'single_line_text_field', owners: ['PRODUCT'], choices: ['Popsicle', 'Shaped', 'Cruiser'], description: 'Form des Decks.' },
  { key: 'truck_width', name: 'Achsbreite', type: 'number_decimal', owners: ['PRODUCT', 'PRODUCTVARIANT'], description: 'Achsbreite in Zoll (passend zur Deckbreite).' },
  { key: 'truck_height', name: 'Achshöhe', type: 'single_line_text_field', owners: ['PRODUCT'], choices: ['Low', 'Mid', 'High'], description: 'Bauhöhe der Achse.' },
  { key: 'wheel_size', name: 'Rollendurchmesser', type: 'number_integer', owners: ['PRODUCT', 'PRODUCTVARIANT'], description: 'Rollendurchmesser in mm.' },
  { key: 'wheel_hardness', name: 'Rollenhärte', type: 'single_line_text_field', owners: ['PRODUCT'], description: 'Härte (Durometer), z. B. 99A, 101A oder 84B.' },
  {
    key: 'bearing_rating', name: 'Kugellager-Klasse', type: 'single_line_text_field', owners: ['PRODUCT'],
    choices: ['ABEC 5', 'ABEC 7', 'ABEC 9', 'Swiss', 'Ceramic'], description: 'Präzisionsklasse bzw. Bauart der Kugellager.',
  },
  { key: 'grip_style', name: 'Griptape-Stil', type: 'single_line_text_field', owners: ['PRODUCT'], choices: ['Standard', 'Color', 'Pattern'], description: 'Art des Griptapes.' },
  { key: 'hardware_length', name: 'Schraubenlänge', type: 'number_decimal', owners: ['PRODUCT', 'PRODUCTVARIANT'], description: 'Schraubenlänge in Zoll (7/8" = 0.875).' },
  { key: 'riser_height', name: 'Riser-Höhe', type: 'number_decimal', owners: ['PRODUCT'], description: 'Höhe der Riser Pads in Zoll (1/8" = 0.125).' },
  {
    key: 'preview_layer', name: 'Vorschau-Layer', type: 'file_reference', owners: ['PRODUCT', 'PRODUCTVARIANT'],
    validations: [{ name: 'file_type_options', value: JSON.stringify(['Image']) }],
    description: 'Transparentes PNG/WebP im Querformat für die Builder-Vorschau.',
  },
  { key: 'preview_color', name: 'Vorschau-Farbe', type: 'color', owners: ['PRODUCT', 'PRODUCTVARIANT'], description: 'Farbe der Vektor-Vorschau im Builder, Fallback für die Farbfacette.' },
  { key: 'features', name: 'Features', type: 'list.single_line_text_field', owners: ['PRODUCT'], description: 'Stichpunkte für den Bereich „Features“ der Produktseite.' },
  { key: 'seo_text', name: 'SEO-Text', type: 'rich_text_field', owners: ['COLLECTION'], description: 'Längerer Text im Collection-Kopf.' },
  {
    key: 'banner', name: 'Banner', type: 'file_reference', owners: ['COLLECTION'],
    validations: [{ name: 'file_type_options', value: JSON.stringify(['Image']) }],
    description: 'Bannerbild im Collection-Kopf.',
  },
  {
    key: 'hidden_filters', name: 'Ausgeblendete Filter', type: 'list.single_line_text_field', owners: ['COLLECTION'],
    description: 'filter.param_name-Werte, die hier ausgeblendet werden, z. B. filter.p.m.custom.concave.',
  },
];

/** Metafield type per key (products/variants use the same types). */
export const TYPE_OF = Object.fromEntries(DEFINITIONS.map((d) => [d.key, d.type]));
