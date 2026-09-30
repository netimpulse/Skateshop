import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyFilters,
  buildFacets,
  formatSpec,
  loadCollection,
  normalize,
  parseNumber,
  priceBuckets,
  resolveSpec,
  safeImageUrl,
  sortResults,
} from '../../assets/board-builder-data.js';

const deck = {
  id: 1,
  handle: 'sundial-deck',
  title: 'Sundial Deck',
  category: 'deck',
  vendor: 'Northline',
  options: ['Breite'],
  specs: { deck_width: null, deck_length: 31.8, concave: 'Medium' },
  preview: { color: '#c8401f' },
  variants: [
    { id: 11, title: '8.0"', available: true, price: 5995, options: ['8.0"'], specs: { deck_width: 8.0, deck_length: 31.5 } },
    { id: 12, title: '8.25"', available: true, price: 5995, options: ['8,25"'], specs: {} },
    { id: 13, title: '8.5"', available: false, price: 6495, options: ['8.5"'], specs: {} },
  ],
};

const truck = {
  id: 2,
  handle: 'stage-trucks',
  title: 'Stage Trucks',
  category: 'trucks',
  vendor: 'Ironside',
  options: ['Größe'],
  specs: { truck_height: 'Mid' },
  variants: [
    { id: 21, available: true, price: 4995, options: ['149'], specs: {} },
    { id: 22, available: true, price: 4995, options: ['8.25"'], specs: {} },
  ],
};

test('parseNumber handles decimals, commas, units and fractions', () => {
  assert.equal(parseNumber('8,25"'), 8.25);
  assert.equal(parseNumber('54mm'), 54);
  assert.equal(parseNumber('1 1/8"'), 1.125);
  assert.equal(parseNumber('7/8'), 0.875);
  assert.equal(parseNumber(8.5), 8.5);
  assert.equal(parseNumber('Mid'), null);
});

test('resolveSpec prefers variant metafield, then option value, then product metafield', () => {
  assert.equal(resolveSpec(deck, deck.variants[0], 'deck_width'), 8.0);
  assert.equal(resolveSpec(deck, deck.variants[1], 'deck_width'), 8.25);
  assert.equal(resolveSpec(deck, deck.variants[0], 'deck_length'), 31.5);
  assert.equal(resolveSpec(deck, deck.variants[1], 'deck_length'), 31.8);
  assert.equal(resolveSpec(deck, deck.variants[1], 'concave'), 'Medium');
});

test('implausible option values are ignored (hanger width is not inches)', () => {
  assert.equal(resolveSpec(truck, truck.variants[0], 'truck_width'), null);
  assert.equal(resolveSpec(truck, truck.variants[1], 'truck_width'), 8.25);
});

test('option values only count for specs of the product category', () => {
  assert.equal(resolveSpec(truck, truck.variants[1], 'deck_width'), null);
  assert.equal(resolveSpec({ ...truck, category: null }, truck.variants[1], 'deck_width'), 8.25);
});

test('facets are built from resolved variant specs and sorted numerically', () => {
  const facets = buildFacets([deck], ['deck_width', 'vendor', 'available']);
  const width = facets.find((facet) => facet.key === 'deck_width');
  assert.deepEqual(width.values.map((value) => value.value), ['8', '8.25', '8.5']);
  assert.equal(facets.find((facet) => facet.key === 'vendor').values[0].value, 'Northline');
});

test('filters combine OR within and AND across facets and pick the matching variant', () => {
  const results = applyFilters([deck, truck], { deck_width: new Set(['8.25']) });
  assert.equal(results.length, 1);
  assert.equal(results[0].variant.id, 12);
  const available = applyFilters([deck], { deck_width: new Set(['8.5']), available: new Set(['true']) });
  assert.equal(available.length, 0);
});

test('prefer() ranks compatible variants first', () => {
  const [result] = applyFilters([truck], {}, { prefer: (product, variant) => (resolveSpec(product, variant, 'truck_width') === 8.25 ? 10 : 0) });
  assert.equal(result.variant.id, 22);
});

test('price buckets span the range and sorting works', () => {
  const buckets = priceBuckets([2995, 4995, 8995, 12995]);
  assert.ok(buckets.length >= 2 && buckets.length <= 4);
  assert.equal(buckets.at(-1).max, null);
  const sorted = sortResults([{ product: deck, variant: { price: 900 } }, { product: truck, variant: { price: 100 } }], 'price-asc');
  assert.equal(sorted[0].variant.price, 100);
});

test('formatSpec formats inches and millimetres', () => {
  assert.equal(formatSpec('deck_width', 8.25), '8.25"');
  assert.equal(formatSpec('wheel_size', 54), '54 mm');
  assert.equal(formatSpec('concave', 'High'), 'High');
});

test('normalize drops invalid products and unsafe image urls', () => {
  const payload = {
    v: 1,
    products: [
      { id: 5, handle: 'ok-product', title: 'OK', url: '/products/ok-product', variants: [{ id: 6, price: 100 }], image: { src: 'javascript:alert(1)' } },
      { id: 'x', handle: 'bad', variants: [{ id: 1, price: 1 }] },
      { id: 7, handle: '<script>', variants: [{ id: 1, price: 1 }] },
      { id: 8, handle: 'no-variants', variants: [] },
    ],
  };
  const products = normalize(payload);
  assert.equal(products.length, 1);
  assert.equal(products[0].image, null);
  assert.equal(safeImageUrl('//cdn.shopify.com/s/files/a.png'), 'https://cdn.shopify.com/s/files/a.png');
  assert.equal(safeImageUrl('https://evil.example/a.png'), null);
  assert.equal(normalize({ v: 2, products: [] }).length, 0);
});

test('loadCollection follows pagination and de-duplicates', async () => {
  const pages = {
    1: { v: 1, pages: 2, products: [{ id: 1, handle: 'a', variants: [{ id: 10, price: 1 }] }] },
    2: { v: 1, pages: 2, products: [{ id: 1, handle: 'a', variants: [{ id: 10, price: 1 }] }, { id: 2, handle: 'b', variants: [{ id: 20, price: 2 }] }] },
  };
  const requested = [];
  const products = await loadCollection('/collections/builder-decks', async (url) => {
    requested.push(url);
    return pages[Number(new URL(url, 'https://x.test').searchParams.get('page'))];
  });
  assert.equal(products.length, 2);
  assert.equal(requested[0], '/collections/builder-decks?view=builder-data&page=1');
});
