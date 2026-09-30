// Step "collections": smart collections with marker metafield skate_demo.seeded, SEO text, banner, published.
// Handles that exist without the marker belong to someone else and are never touched.
import { gql, assertNoUserErrors, publishToOnlineStore, MARKER } from './lib/admin.mjs';
import { COLLECTIONS } from './data/content.mjs';
import { ensureFiles, sectionFileEntries } from './files.mjs';

const richText = (paragraphs) =>
  JSON.stringify({ type: 'root', children: paragraphs.map((value) => ({ type: 'paragraph', children: [{ type: 'text', value }] })) });

export async function findCollection(handle) {
  const data = await gql(
    `query ($handle: String!) {
      collectionByIdentifier(identifier: { handle: $handle }) {
        id handle title image { url }
        marker: metafield(namespace: "${MARKER.namespace}", key: "${MARKER.key}") { value }
        productsCount { count }
      }
    }`,
    { handle }
  );
  return data.collectionByIdentifier;
}

export async function run({ dryRun = false } = {}) {
  const summary = { created: [], updated: [], skipped: [] };
  const files = await ensureFiles(sectionFileEntries(), { dryRun, label: 'collections' });

  for (const col of COLLECTIONS) {
    const existing = await findCollection(col.handle);
    if (existing && existing.marker?.value !== 'true') {
      summary.skipped.push(`${col.handle} (exists without seed marker – not touched)`);
      console.log(`  ! skip ${col.handle}: foreign collection`);
      continue;
    }
    if (dryRun) {
      console.log(`  would ${existing ? 'update' : 'create'} collection ${col.handle}`);
      (existing ? summary.updated : summary.created).push(col.handle);
      continue;
    }
    const metafields = [{ ...MARKER }];
    if (col.seo) metafields.push({ namespace: 'custom', key: 'seo_text', type: 'rich_text_field', value: richText(col.seo) });
    if (col.banner) metafields.push({ namespace: 'custom', key: 'banner', type: 'file_reference', value: files.get(col.banner).id });

    const input = {
      title: col.title,
      handle: col.handle,
      descriptionHtml: `<p>${col.description}</p>`,
      ruleSet: { appliedDisjunctively: false, rules: col.rules },
      metafields,
    };
    // Collection image only on first set-up (re-sending it would re-download the file every run).
    if (col.image && !existing?.image) input.image = { src: files.get(col.image).url, altText: col.title };

    let collection;
    if (existing) {
      const data = await gql(
        `mutation ($input: CollectionInput!) { collectionUpdate(input: $input) { collection { id handle } userErrors { field message } } }`,
        { input: { ...input, id: existing.id } }
      );
      collection = assertNoUserErrors(`collectionUpdate ${col.handle}`, data.collectionUpdate).collection;
      summary.updated.push(col.handle);
    } else {
      const data = await gql(
        `mutation ($input: CollectionInput!) { collectionCreate(input: $input) { collection { id handle } userErrors { field message } } }`,
        { input }
      );
      collection = assertNoUserErrors(`collectionCreate ${col.handle}`, data.collectionCreate).collection;
      if (collection.handle !== col.handle) console.log(`  ! ${col.handle} was created as ${collection.handle}`);
      summary.created.push(col.handle);
    }
    await publishToOnlineStore(collection.id);
    console.log(`  ${existing ? '~' : '+'} ${collection.handle}`);
  }

  console.log(`[collections] created ${summary.created.length}, updated ${summary.updated.length}, skipped ${summary.skipped.length}`);
  for (const line of summary.skipped) console.log(`  ! ${line}`);
  return summary;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { parseArgs } = await import('./lib/admin.mjs');
  await run(parseArgs());
}
