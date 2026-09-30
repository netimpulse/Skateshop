/**
 * Board builder data layer: loading step collections, resolving specs, facets and filtering.
 * Pure module: no imports, no DOM (unit-tested with `node --test`). `fetch` is injected by the caller.
 *
 * Spec resolution per variant (Plan 2a): variant metafield → option value (by option name alias) → product metafield.
 */

export const NUMERIC_SPECS = ['deck_width', 'deck_length', 'wheelbase', 'truck_width', 'wheel_size', 'hardware_length', 'riser_height'];
export const TEXT_SPECS = ['concave', 'deck_shape', 'truck_height', 'wheel_hardness', 'bearing_rating', 'grip_style'];
export const SPEC_KEYS = [...NUMERIC_SPECS, ...TEXT_SPECS];

export const SPEC_UNITS = {
  deck_width: 'inch',
  deck_length: 'inch',
  wheelbase: 'inch',
  truck_width: 'inch',
  hardware_length: 'inch',
  riser_height: 'inch',
  wheel_size: 'mm',
};

/** Option names (lower case) that carry a spec value, e.g. deck width as variant option "Breite". */
export const OPTION_ALIASES = {
  deck_width: ['breite', 'width', 'deckbreite', 'deck width', 'größe', 'groesse', 'size'],
  truck_width: ['breite', 'width', 'achsbreite', 'axle width', 'größe', 'groesse', 'size'],
  wheel_size: ['durchmesser', 'diameter', 'größe', 'groesse', 'size'],
  hardware_length: ['länge', 'laenge', 'length', 'größe', 'groesse', 'size'],
  deck_length: ['länge', 'laenge', 'length'],
};

/** Which option-derived specs belong to which builder category (prevents truck "Größe" becoming a deck width). */
export const CATEGORY_OPTION_SPECS = {
  deck: ['deck_width', 'deck_length'],
  complete: ['deck_width', 'deck_length'],
  trucks: ['truck_width'],
  wheels: ['wheel_size'],
  hardware: ['hardware_length'],
};

export const COLOR_OPTION_NAMES = ['farbe', 'color', 'colour'];

/** Plausible ranges – values outside are ignored (e.g. truck size "149" is a hanger width, not inches). */
export const PLAUSIBLE = {
  deck_width: [6, 11],
  truck_width: [6, 11],
  deck_length: [20, 45],
  wheelbase: [10, 17],
  wheel_size: [40, 70],
  hardware_length: [0.5, 2],
  riser_height: [0, 0.75],
};

const HEX = /^#[0-9a-f]{3}([0-9a-f]{3})?$/i;
const HANDLE = /^[a-z0-9][a-z0-9-]{0,254}$/;

/** Parses numbers from values like 8.25, "8,25\"", "54mm", "1 1/8\"", "7/8". Returns null when not numeric. */
export function parseNumber(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string') return null;
  const text = value.trim().replace(',', '.');
  const mixed = text.match(/^(\d+)\s+(\d+)\s*\/\s*(\d+)/);
  if (mixed) return Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]);
  const fraction = text.match(/^(\d+)\s*\/\s*(\d+)/);
  if (fraction) return Number(fraction[1]) / Number(fraction[2]);
  const number = text.match(/-?\d+(\.\d+)?/);
  return number ? Number(number[0]) : null;
}

function plausible(key, value) {
  const range = PLAUSIBLE[key];
  if (value === null || !Number.isFinite(value)) return null;
  if (!range) return value;
  return value >= range[0] && value <= range[1] ? value : null;
}

function optionValue(product, variant, names) {
  if (!variant || !Array.isArray(product.options)) return null;
  const index = product.options.findIndex((name) => names.includes(String(name).toLowerCase().trim()));
  return index > -1 ? variant.options?.[index] ?? null : null;
}

/** Resolves one spec for a variant (see module comment). */
export function resolveSpec(product, variant, key) {
  const numeric = NUMERIC_SPECS.includes(key);
  const fromVariant = variant?.specs?.[key];
  if (fromVariant !== undefined && fromVariant !== null && fromVariant !== '') {
    return numeric ? plausible(key, parseNumber(fromVariant)) : String(fromVariant);
  }
  const categorySpecs = CATEGORY_OPTION_SPECS[product?.category];
  const optionAllowed = !product?.category || !categorySpecs || categorySpecs.includes(key);
  if (numeric && OPTION_ALIASES[key] && optionAllowed) {
    const value = plausible(key, parseNumber(optionValue(product, variant, OPTION_ALIASES[key])));
    if (value !== null) return value;
  }
  const fromProduct = product?.specs?.[key];
  if (fromProduct === undefined || fromProduct === null || fromProduct === '') return null;
  return numeric ? plausible(key, parseNumber(fromProduct)) : String(fromProduct);
}

export function resolveSpecs(product, variant) {
  return Object.fromEntries(SPEC_KEYS.map((key) => [key, resolveSpec(product, variant, key)]));
}

export function colorName(product, variant) {
  const value = optionValue(product, variant, COLOR_OPTION_NAMES);
  return value ? String(value) : null;
}

export function previewColor(product, variant) {
  const candidates = [variant?.preview?.color, product?.preview?.color];
  return candidates.find((value) => typeof value === 'string' && HEX.test(value)) || null;
}

// ------------------------------------------------------------------ Loading & validation

const str = (value, max = 500) => (typeof value === 'string' ? value.slice(0, max) : '');
const id = (value) => (Number.isSafeInteger(value) && value > 0 ? value : null);
const cents = (value) => (Number.isSafeInteger(value) && value >= 0 ? value : null);

/** Only same-origin paths or Shopify CDN URLs are accepted for images. */
export function safeImageUrl(value, origin = '') {
  if (typeof value !== 'string' || !value) return null;
  if (/^\/(?!\/)/.test(value)) return value;
  try {
    const url = new URL(value.startsWith('//') ? `https:${value}` : value);
    const host = url.hostname;
    const originHost = origin ? new URL(origin).hostname : '';
    if (url.protocol !== 'https:') return null;
    if (host === 'cdn.shopify.com' || host.endsWith('.shopify.com') || host.endsWith('.myshopify.com') || host === originHost) {
      return url.toString();
    }
  } catch {
    return null;
  }
  return null;
}

function normalizeImage(image, origin) {
  if (!image || typeof image !== 'object') return null;
  const src = safeImageUrl(image.src, origin);
  if (!src) return null;
  const srcset = str(image.srcset, 2000)
    .split(',')
    .map((entry) => entry.trim().split(/\s+/))
    .filter(([url, width]) => safeImageUrl(url, origin) && /^\d+w$/.test(width || ''))
    .map(([url, width]) => `${safeImageUrl(url, origin)} ${width}`)
    .join(', ');
  return { src, srcset, alt: str(image.alt, 300), w: Number(image.w) || 600, h: Number(image.h) || 750 };
}

/** Validates the endpoint payload and returns clean product objects. */
export function normalize(payload, origin = '') {
  if (!payload || payload.v !== 1 || !Array.isArray(payload.products)) return [];
  return payload.products
    .map((raw) => {
      const productId = id(raw?.id);
      if (!productId || !HANDLE.test(str(raw.handle, 255))) return null;
      const variants = (Array.isArray(raw.variants) ? raw.variants : [])
        .map((variant) => {
          const variantId = id(variant?.id);
          const price = cents(variant?.price);
          if (!variantId || price === null) return null;
          return {
            id: variantId,
            title: str(variant.title, 200),
            available: variant.available === true,
            price,
            priceFormatted: str(variant.price_fmt, 60),
            compareAt: cents(variant.compare_at),
            options: Array.isArray(variant.options) ? variant.options.map((value) => str(value, 120)) : [],
            image: safeImageUrl(variant.image, origin),
            specs: variant.specs && typeof variant.specs === 'object' ? variant.specs : {},
            preview: { color: HEX.test(variant.preview?.color || '') ? variant.preview.color : null },
          };
        })
        .filter(Boolean);
      if (!variants.length) return null;
      return {
        id: productId,
        handle: raw.handle,
        title: str(raw.title, 200),
        vendor: str(raw.vendor, 120),
        type: str(raw.type, 120),
        url: str(raw.url, 400).startsWith('/') ? raw.url : '',
        available: raw.available === true,
        category: str(raw.category, 40) || null,
        priceMin: cents(raw.price_min) ?? variants[0].price,
        priceMinFormatted: str(raw.price_min_fmt, 60),
        image: normalizeImage(raw.image, origin),
        image2: safeImageUrl(raw.image2, origin),
        preview: {
          layer: safeImageUrl(raw.preview?.layer, origin),
          layerRatio: Number(raw.preview?.layerRatio) || null,
          color: HEX.test(raw.preview?.color || '') ? raw.preview.color : null,
        },
        options: Array.isArray(raw.options) ? raw.options.map((name) => str(name, 120)) : [],
        specs: raw.specs && typeof raw.specs === 'object' ? raw.specs : {},
        variants,
      };
    })
    .filter(Boolean);
}

/** Loads every page of a step collection. `fetchImpl(url)` must resolve to a parsed JSON payload. */
export async function loadCollection(url, fetchImpl, { maxPages = 10, origin = '' } = {}) {
  const products = [];
  let page = 1;
  let pages = 1;
  do {
    const separator = url.includes('?') ? '&' : '?';
    // eslint-disable-next-line no-await-in-loop
    const payload = await fetchImpl(`${url}${separator}view=builder-data&page=${page}`);
    if (!payload || payload.v !== 1) break;
    products.push(...normalize(payload, origin));
    pages = Math.min(Number(payload.pages) || 1, maxPages);
    page += 1;
  } while (page <= pages);
  const seen = new Set();
  return products.filter((product) => (seen.has(product.id) ? false : seen.add(product.id)));
}

// ------------------------------------------------------------------ Facets & filtering

export const FACET_TYPES = {
  vendor: 'vendor',
  price: 'price',
  available: 'available',
  color: 'color',
};

function facetValuesFor(key, product, variant) {
  if (key === 'vendor') return product.vendor ? [product.vendor] : [];
  if (key === 'color') {
    const name = colorName(product, variant);
    return name ? [name] : [];
  }
  if (SPEC_KEYS.includes(key)) {
    const value = resolveSpec(product, variant, key);
    return value === null ? [] : [String(value)];
  }
  return [];
}

/** Rounded price buckets (in cents) spanning the given prices – at most `count` buckets. */
export function priceBuckets(prices, count = 4) {
  const valid = prices.filter((value) => Number.isFinite(value));
  if (valid.length < 2) return [];
  const min = Math.min(...valid);
  const max = Math.max(...valid);
  if (max - min < 1000) return [];
  const raw = (max - min) / count;
  const step = Math.max(500, Math.ceil(raw / 500) * 500);
  const start = Math.floor(min / 500) * 500;
  const buckets = [];
  for (let from = start; from <= max && buckets.length < count; from += step) {
    const last = buckets.length === count - 1 || from + step > max;
    buckets.push({ value: `${from}-${last ? '' : from + step}`, min: from, max: last ? null : from + step });
  }
  return buckets;
}

const inBucket = (price, bucketValue) => {
  const [from, to] = bucketValue.split('-');
  return price >= Number(from) && (to === '' || price < Number(to));
};

/** Builds facets for the given keys; values are sorted numerically when possible. */
export function buildFacets(products, keys) {
  const facets = [];
  for (const key of keys) {
    if (key === 'available') {
      facets.push({ key, values: [{ value: 'true', count: products.filter((product) => product.available).length }] });
      continue;
    }
    if (key === 'price') {
      const buckets = priceBuckets(products.flatMap((product) => product.variants.map((variant) => variant.price)));
      if (buckets.length) {
        facets.push({
          key,
          values: buckets.map((bucket) => ({
            ...bucket,
            count: products.filter((product) => product.variants.some((variant) => inBucket(variant.price, bucket.value))).length,
          })),
        });
      }
      continue;
    }
    const counts = new Map();
    for (const product of products) {
      const values = new Set(product.variants.flatMap((variant) => facetValuesFor(key, product, variant)));
      values.forEach((value) => counts.set(value, (counts.get(value) || 0) + 1));
    }
    if (counts.size < 2 && key !== 'vendor') continue;
    if (counts.size < 1) continue;
    const values = Array.from(counts, ([value, count]) => ({ value, count })).sort((a, b) => {
      const numberA = Number(a.value);
      const numberB = Number(b.value);
      return Number.isFinite(numberA) && Number.isFinite(numberB) ? numberA - numberB : a.value.localeCompare(b.value);
    });
    facets.push({ key, values });
  }
  return facets;
}

function variantMatches(product, variant, active) {
  for (const [key, values] of Object.entries(active)) {
    if (!values || values.size === 0) continue;
    if (key === 'available') {
      if (!variant.available) return false;
      continue;
    }
    if (key === 'price') {
      if (![...values].some((bucket) => inBucket(variant.price, bucket))) return false;
      continue;
    }
    const own = facetValuesFor(key, product, variant);
    if (!own.some((value) => values.has(value))) return false;
  }
  return true;
}

/**
 * Filters products by active facet values (OR within a facet, AND across facets).
 * Returns [{ product, variant }] where variant is the best matching variant (available first).
 * `prefer(product, variant)` may return a score to pick the most compatible variant.
 */
export function applyFilters(products, active = {}, { prefer } = {}) {
  const results = [];
  for (const product of products) {
    const matching = product.variants.filter((variant) => variantMatches(product, variant, active));
    if (!matching.length) continue;
    const ranked = matching
      .map((variant, index) => ({ variant, score: (variant.available ? 100 : 0) + (prefer ? prefer(product, variant) : 0) - index * 0.01 }))
      .sort((a, b) => b.score - a.score);
    results.push({ product, variant: ranked[0].variant });
  }
  return results;
}

export function sortResults(results, sort = 'featured') {
  const list = [...results];
  if (sort === 'price-asc') list.sort((a, b) => a.variant.price - b.variant.price);
  else if (sort === 'price-desc') list.sort((a, b) => b.variant.price - a.variant.price);
  else if (sort === 'title') list.sort((a, b) => a.product.title.localeCompare(b.product.title));
  return list;
}

/** Human readable spec value: 8.25", 54 mm or the text itself. */
export function formatSpec(key, value) {
  if (value === null || value === undefined || value === '') return '';
  const unit = SPEC_UNITS[key];
  if (unit === 'inch') return `${Number(Number(value).toFixed(3))}"`;
  if (unit === 'mm') return `${Math.round(Number(value))} mm`;
  return String(value);
}

export function findVariant(product, variantId) {
  return product?.variants.find((variant) => variant.id === variantId) || null;
}
