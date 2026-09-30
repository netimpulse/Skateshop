#!/usr/bin/env node
// Removes the demo data again – and only the demo data:
//   products with tag `skate-demo`, collections and pages with the marker metafield skate_demo.seeded,
//   menus whose handle is one of the seeded MENUS handles, files named `skate-demo-*`.
//   Metafield definitions only with --definitions (and only those whose description carries the seed marker).
// Usage: NODE_USE_ENV_PROXY=1 node scripts/demo-data/cleanup.mjs [--dry-run] [--definitions]
import { gql, assertNoUserErrors, parseArgs, listDemoFiles, DEMO_TAG, MARKER } from './lib/admin.mjs';
import { DEF_MARKER } from './data/definitions.mjs';
import { MENUS } from './data/content.mjs';

async function paginate(field, query, nodeFields, variables = {}) {
  const out = [];
  let after = null;
  do {
    const data = await gql(
      `query ($after: String${query ? ', $q: String!' : ''}) {
        ${field}(first: 100, after: $after${query ? ', query: $q' : ''}) { pageInfo { hasNextPage endCursor } nodes { ${nodeFields} } }
      }`,
      { after, ...(query ? { q: query } : {}), ...variables }
    );
    out.push(...data[field].nodes);
    after = data[field].pageInfo.hasNextPage ? data[field].pageInfo.endCursor : null;
  } while (after);
  return out;
}

const markerField = `marker: metafield(namespace: "${MARKER.namespace}", key: "${MARKER.key}") { value }`;

export async function run({ dryRun = false, flags = {} } = {}) {
  const act = async (label, fn) => {
    if (dryRun) return console.log(`  would delete ${label}`);
    await fn();
    console.log(`  - ${label}`);
  };

  console.log('=== products ===');
  const products = (await paginate('products', `tag:${DEMO_TAG}`, 'id handle tags')).filter((p) => p.tags.includes(DEMO_TAG));
  for (const p of products) {
    await act(`product ${p.handle}`, async () => {
      const data = await gql(`mutation ($input: ProductDeleteInput!) { productDelete(input: $input, synchronous: true) { deletedProductId userErrors { field message } } }`, { input: { id: p.id } });
      assertNoUserErrors(`productDelete ${p.handle}`, data.productDelete);
    });
  }

  console.log('=== collections ===');
  const collections = (await paginate('collections', null, `id handle ${markerField}`)).filter((c) => c.marker?.value === 'true');
  for (const c of collections) {
    await act(`collection ${c.handle}`, async () => {
      const data = await gql(`mutation ($input: CollectionDeleteInput!) { collectionDelete(input: $input) { deletedCollectionId userErrors { field message } } }`, { input: { id: c.id } });
      assertNoUserErrors(`collectionDelete ${c.handle}`, data.collectionDelete);
    });
  }

  console.log('=== pages ===');
  const pages = (await paginate('pages', null, `id handle ${markerField}`)).filter((p) => p.marker?.value === 'true');
  for (const p of pages) {
    await act(`page ${p.handle}`, async () => {
      const data = await gql(`mutation ($id: ID!) { pageDelete(id: $id) { deletedPageId userErrors { field message } } }`, { id: p.id });
      assertNoUserErrors(`pageDelete ${p.handle}`, data.pageDelete);
    });
  }

  console.log('=== menus ===');
  // Only the exact handles the seed creates – other projects in the shared store may use a `skate-` prefix too.
  const seededMenus = new Set(MENUS.map((menu) => menu.handle));
  const menus = (await paginate('menus', null, 'id handle')).filter((m) => seededMenus.has(m.handle));
  for (const m of menus) {
    await act(`menu ${m.handle}`, async () => {
      const data = await gql(`mutation ($id: ID!) { menuDelete(id: $id) { deletedMenuId userErrors { field message } } }`, { id: m.id });
      assertNoUserErrors(`menuDelete ${m.handle}`, data.menuDelete);
    });
  }

  console.log('=== files ===');
  const files = await listDemoFiles({ all: true });
  if (dryRun) console.log(`  would delete ${files.length} file(s) named skate-demo-*`);
  for (let i = 0; !dryRun && i < files.length; i += 50) {
    const batch = files.slice(i, i + 50);
    const data = await gql(`mutation ($ids: [ID!]!) { fileDelete(fileIds: $ids) { deletedFileIds userErrors { field message } } }`, { ids: batch.map((f) => f.id) });
    assertNoUserErrors('fileDelete', data.fileDelete);
    console.log(`  - ${data.fileDelete.deletedFileIds.length} file(s)`);
  }

  if (flags.definitions) {
    console.log('=== metafield definitions ===');
    for (const ownerType of ['PRODUCT', 'PRODUCTVARIANT', 'COLLECTION']) {
      const data = await gql(
        `query ($o: MetafieldOwnerType!) { metafieldDefinitions(first: 250, ownerType: $o, namespace: "custom") { nodes { id key description } } }`,
        { o: ownerType }
      );
      for (const def of data.metafieldDefinitions.nodes.filter((d) => (d.description || '').includes(DEF_MARKER))) {
        await act(`definition ${ownerType}.custom.${def.key}`, async () => {
          const res = await gql(
            `mutation ($id: ID!) { metafieldDefinitionDelete(id: $id, deleteAllAssociatedMetafields: false) { deletedDefinitionId userErrors { field message } } }`,
            { id: def.id }
          );
          assertNoUserErrors(`metafieldDefinitionDelete ${def.key}`, res.metafieldDefinitionDelete);
        });
      }
    }
  } else {
    console.log('(metafield definitions kept – pass --definitions to remove them)');
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await run(parseArgs());
}
