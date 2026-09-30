// Step "products": upserts the catalogue via productSet (identifier: handle), attaches media, sets metafields,
// inventory and publishes to the Online Store. Products whose handle exists without the tag `skate-demo` are skipped.
import { gql, findProductByHandle, publishToOnlineStore, DEMO_TAG } from './lib/admin.mjs';
import { PRODUCTS } from './data/catalog.mjs';
import { TYPE_OF } from './data/definitions.mjs';
import { ensureFiles } from './files.mjs';

const DEFAULT_OPTION = { name: 'Title', value: 'Default Title' };

const mf = (key, value) => ({ namespace: 'custom', key, type: TYPE_OF[key], value: typeof value === 'string' ? value : String(value) });

async function primaryLocationId() {
  const data = await gql(`{ locations(first: 20) { nodes { id name isActive fulfillsOnlineOrders } } }`);
  const loc = data.locations.nodes.find((l) => l.isActive && l.fulfillsOnlineOrders) || data.locations.nodes[0];
  if (!loc) throw new Error('No location found');
  return loc.id;
}

function optionValuesOf(product, variant) {
  if (!product.options) return [{ optionName: DEFAULT_OPTION.name, name: DEFAULT_OPTION.value }];
  return product.options.map((o) => ({ optionName: o.name, name: variant.options[o.name] }));
}

function matchVariantId(existing, optionValues) {
  if (!existing) return undefined;
  const match = existing.variants.nodes.find((node) =>
    optionValues.every((ov) => node.selectedOptions.some((so) => so.name === ov.optionName && so.value === ov.name))
  );
  return match?.id;
}

export function buildInput(p, { existing, files, locationId }) {
  const productMetafields = [mf('builder_category', p.category), mf('features', JSON.stringify(p.features))];
  for (const [key, value] of Object.entries(p.metafields || {})) productMetafields.push(mf(key, value));
  if (p.layer) productMetafields.push(mf('preview_layer', files.get(p.layer.file).id));

  return {
    title: p.title,
    handle: p.handle,
    descriptionHtml: p.descriptionHtml,
    vendor: p.vendor,
    productType: p.type,
    tags: p.tags,
    status: 'ACTIVE',
    productOptions: p.options
      ? p.options.map((o) => ({ name: o.name, values: o.values.map((name) => ({ name })) }))
      : [{ name: DEFAULT_OPTION.name, values: [{ name: DEFAULT_OPTION.value }] }],
    metafields: productMetafields,
    files: p.images.map((img) => ({ id: files.get(img.file).id })),
    variants: p.variants.map((v) => {
      const optionValues = optionValuesOf(p, v);
      const id = matchVariantId(existing, optionValues);
      return {
        ...(id ? { id } : {}),
        optionValues,
        price: v.price,
        compareAtPrice: v.compareAt,
        sku: v.sku,
        inventoryPolicy: 'DENY',
        inventoryItem: { tracked: true },
        inventoryQuantities: [{ locationId, name: 'available', quantity: v.stock }],
        metafields: Object.entries(v.metafields || {}).map(([key, value]) => mf(key, value)),
      };
    }),
  };
}

export async function run({ dryRun = false, flags = {} } = {}) {
  const onlyHandles = flags.handle ? new Set(flags.handle.split(',')) : null;
  const products = PRODUCTS.filter((p) => !onlyHandles || onlyHandles.has(p.handle));
  const summary = { created: [], updated: [], skipped: [], published: 0 };

  const fileEntries = products.flatMap((p) => [...p.images, ...(p.layer ? [p.layer] : [])]);
  console.log(`[products] ${products.length} products, ${fileEntries.length} images`);
  const files = await ensureFiles(fileEntries, { dryRun, label: 'products' });
  const locationId = dryRun ? 'dry-run' : await primaryLocationId();

  for (const p of products) {
    const existing = await findProductByHandle(p.handle);
    if (existing && !existing.tags.includes(DEMO_TAG)) {
      summary.skipped.push(`${p.handle} (handle exists without tag ${DEMO_TAG} – not touched)`);
      console.log(`  ! skip ${p.handle}: foreign product with this handle`);
      continue;
    }
    if (dryRun) {
      console.log(`  would ${existing ? 'update' : 'create'} ${p.handle} (${p.variants.length} variant(s))`);
      (existing ? summary.updated : summary.created).push(p.handle);
      continue;
    }
    const data = await gql(
      `mutation ($identifier: ProductSetIdentifiers, $input: ProductSetInput!) {
        productSet(identifier: $identifier, input: $input, synchronous: true) {
          product { id handle variants(first: 100) { nodes { id title sku inventoryQuantity } } }
          userErrors { field message code }
        }
      }`,
      { identifier: { handle: p.handle }, input: buildInput(p, { existing, files, locationId }) }
    );
    const result = data.productSet;
    if (result.userErrors.length) {
      summary.skipped.push(`${p.handle} (productSet failed: ${JSON.stringify(result.userErrors)})`);
      console.log(`  ! ${p.handle}: ${JSON.stringify(result.userErrors)}`);
      continue;
    }
    (existing ? summary.updated : summary.created).push(p.handle);
    if (await publishToOnlineStore(result.product.id)) summary.published++;
    console.log(`  ${existing ? '~' : '+'} ${p.handle} (${result.product.variants.nodes.map((v) => `${v.title}:${v.inventoryQuantity}`).join(', ')})`);
  }

  console.log(`[products] created ${summary.created.length}, updated ${summary.updated.length}, skipped ${summary.skipped.length}, newly published ${summary.published}`);
  for (const line of summary.skipped) console.log(`  ! ${line}`);
  return summary;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { parseArgs } = await import('./lib/admin.mjs');
  await run(parseArgs());
}
