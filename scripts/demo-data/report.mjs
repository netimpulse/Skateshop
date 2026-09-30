// Step "report": reads the seeded state back from the store and writes a JSON fixture file
// (default .out/seed-report.json, override with --report=<path>).
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gql, listDemoFiles, DEMO_TAG } from './lib/admin.mjs';
import { PRODUCTS, BY_CATEGORY } from './data/catalog.mjs';
import { BRANDS } from './data/brands.mjs';
import { COLLECTIONS, PAGES, MENUS } from './data/content.mjs';
import { findCollection } from './collections.mjs';
import { resolvePage, findPage } from './pages.mjs';
import { listMenus } from './menus.mjs';
import { sectionFileEntries } from './files.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const numericId = (gid) => Number(String(gid).split('/').pop());

async function seededProducts() {
  const list = [];
  let after = null;
  do {
    const data = await gql(
      `query ($after: String) {
        products(first: 50, after: $after, query: "tag:${DEMO_TAG}") {
          pageInfo { hasNextPage endCursor }
          nodes { id handle title productType vendor status tags totalInventory
            variants(first: 20) { nodes { id title sku inventoryQuantity } } }
        }
      }`,
      { after }
    );
    list.push(...data.products.nodes);
    after = data.products.pageInfo.hasNextPage ? data.products.pageInfo.endCursor : null;
  } while (after);
  return list;
}

function variantRef(product, predicate) {
  const v = product?.variants.nodes.find(predicate);
  return v ? { handle: product.handle, productId: numericId(product.id), variantId: numericId(v.id), variantTitle: v.title, sku: v.sku, quantity: v.inventoryQuantity } : null;
}

export async function run({ dryRun = false, flags = {} } = {}) {
  const target = flags.report || join(HERE, '.out', 'seed-report.json');
  if (dryRun) {
    console.log(`[report] would write ${target}`);
    return null;
  }
  const products = await seededProducts();
  const byHandle = new Map(products.map((p) => [p.handle, p]));

  const soldOut = PRODUCTS.flatMap((p) => p.variants.filter((v) => v.stock === 0).map((v) => [p.handle, v.sku]));
  const lastOne = PRODUCTS.flatMap((p) => p.variants.filter((v) => v.stock === 1).map((v) => [p.handle, v.sku]));
  const bySku = (handle, sku) => variantRef(byHandle.get(handle), (v) => v.sku === sku);

  const deck3 = byHandle.get('nine-ply-co-sunset-stripe-deck');
  const wheel58 = byHandle.get('rolltype-cruiser-soft-wheels');

  const collections = [];
  for (const col of COLLECTIONS) {
    const c = await findCollection(col.handle);
    collections.push(c ? { handle: c.handle, title: c.title, productsCount: c.productsCount.count, seeded: c.marker?.value === 'true' } : { handle: col.handle, missing: true });
  }

  const pages = [];
  for (const page of PAGES) {
    const resolved = await resolvePage(page.handle);
    const direct = resolved && resolved.handle === page.handle ? null : await findPage(page.handle);
    pages.push({
      requested: page.handle,
      handle: resolved?.handle || null,
      title: resolved?.title || null,
      url: resolved ? `/pages/${resolved.handle}` : null,
      templateSuffix: resolved?.templateSuffix || null,
      templateSuffixRequested: page.templateSuffix || null,
      templateSuffixSet: page.templateSuffix ? resolved?.templateSuffix === page.templateSuffix : null,
      foreignPageAtRequestedHandle: direct ? { handle: direct.handle, title: direct.title, templateSuffix: direct.templateSuffix || null, note: 'belongs to another project – untouched' } : null,
    });
  }

  const menuHandles = new Set(MENUS.map((m) => m.handle));
  const menus = (await listMenus()).filter((m) => menuHandles.has(m.handle)).map((m) => ({ handle: m.handle, title: m.title, topLevelItems: m.items.length }));

  const files = await listDemoFiles();
  const sectionImages = {};
  for (const { file, width, height, alt } of sectionFileEntries()) {
    const f = files.get(file);
    const key = file.replace(/^skate-demo-/, '').replace(/\.png$/, '');
    sectionImages[key] = f ? { filename: f.filename, themeRef: `shopify://shop_images/${f.filename}`, fileId: f.id, width, height, alt } : null;
  }
  const previewLayers = Object.fromEntries(PRODUCTS.filter((p) => p.layer).map((p) => [p.handle, files.get(p.layer.file)?.filename || null]));

  const report = {
    generatedAt: new Date().toISOString(),
    tag: DEMO_TAG,
    brands: BRANDS.map((b) => b.name),
    products: {
      total: products.length,
      byCategory: BY_CATEGORY,
      productTypes: Object.fromEntries(Object.entries(BY_CATEGORY).map(([cat, handles]) => [cat, byHandle.get(handles[0])?.productType || null])),
      missing: PRODUCTS.map((p) => p.handle).filter((h) => !byHandle.has(h)),
      tagged: Object.fromEntries(['builder', 'bestseller', 'featured', 'new', 'limited'].map((t) => [t, products.filter((p) => p.tags.includes(t)).map((p) => p.handle)])),
      onSale: PRODUCTS.filter((p) => p.compareAt).map((p) => p.handle),
    },
    inventory: {
      soldOutVariant: soldOut.length ? bySku(...soldOut[0]) : null,
      stockOneVariant: lastOne.length ? bySku(...lastOne[0]) : null,
    },
    deckWithThreeWidths: deck3
      ? { handle: deck3.handle, option: 'Breite', variants: deck3.variants.nodes.map((v) => ({ variantId: numericId(v.id), title: v.title })) }
      : null,
    wheelWith58mm: variantRef(wheel58, (v) => v.title === '58 mm'),
    builderCollections: { deck: 'builder-decks', trucks: 'builder-trucks', wheels: 'builder-wheels', bearings: 'builder-bearings', griptape: 'builder-griptape', hardware: 'builder-hardware', riser: 'builder-risers' },
    collections,
    pages,
    menus,
    sectionImages,
    previewLayers,
  };
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`[report] ${products.length} products, ${collections.length} collections, ${pages.length} pages, ${menus.length} menus → ${target}`);
  return report;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { parseArgs } = await import('./lib/admin.mjs');
  await run(parseArgs());
}
