// Step "pages": content pages with marker metafield skate_demo.seeded.
// If a handle already belongs to someone else, that page is left untouched and the demo page is
// created under the fallback handle `skate-<handle>` instead (reported).
// If the templateSuffix is rejected (template missing in the live theme), the page is created without it (reported).
import { gql, MARKER } from './lib/admin.mjs';
import { PAGES } from './data/content.mjs';

export const fallbackHandle = (handle) => `skate-${handle}`;

export async function findPage(handle) {
  const data = await gql(
    `query ($q: String!) {
      pages(first: 5, query: $q) {
        nodes { id handle title templateSuffix isPublished marker: metafield(namespace: "${MARKER.namespace}", key: "${MARKER.key}") { value } }
      }
    }`,
    { q: `handle:'${handle}'` }
  );
  return data.pages.nodes.find((p) => p.handle === handle) || null;
}

/** Resolves the page the demo uses for a requested handle: own page, fallback page, or null. */
export async function resolvePage(handle) {
  const direct = await findPage(handle);
  if (direct?.marker?.value === 'true') return { requested: handle, ...direct, seeded: true };
  const fallback = await findPage(fallbackHandle(handle));
  if (fallback?.marker?.value === 'true') return { requested: handle, ...fallback, seeded: true, foreign: direct ? { handle: direct.handle, templateSuffix: direct.templateSuffix } : null };
  return null;
}

async function savePage(existingId, input) {
  const mutation = existingId
    ? `mutation ($id: ID!, $page: PageUpdateInput!) { result: pageUpdate(id: $id, page: $page) { page { id handle templateSuffix } userErrors { field message code } } }`
    : `mutation ($page: PageCreateInput!) { result: pageCreate(page: $page) { page { id handle templateSuffix } userErrors { field message code } } }`;
  const data = await gql(mutation, existingId ? { id: existingId, page: input } : { page: input });
  return data.result;
}

export async function run({ dryRun = false } = {}) {
  const summary = { created: [], updated: [], notes: [], failed: [] };

  for (const page of PAGES) {
    let handle = page.handle;
    let existing = await findPage(handle);
    if (existing && existing.marker?.value !== 'true') {
      summary.notes.push(`${handle}: foreign page exists (templateSuffix "${existing.templateSuffix || ''}") – untouched, demo page uses ${fallbackHandle(handle)}`);
      handle = fallbackHandle(handle);
      existing = await findPage(handle);
      if (existing && existing.marker?.value !== 'true') {
        summary.failed.push(`${page.handle}: fallback ${handle} also taken by a foreign page – skipped`);
        continue;
      }
    }
    if (dryRun) {
      console.log(`  would ${existing ? 'update' : 'create'} page ${handle}${page.templateSuffix ? ` (template ${page.templateSuffix})` : ''}`);
      (existing ? summary.updated : summary.created).push(handle);
      continue;
    }
    const input = { title: page.title, handle, body: page.body, isPublished: true, metafields: [{ ...MARKER }] };
    if (page.templateSuffix) input.templateSuffix = page.templateSuffix;
    let result = await savePage(existing?.id, input);
    if (result.userErrors.length && page.templateSuffix && result.userErrors.some((e) => /template/i.test(`${e.field} ${e.message}`))) {
      summary.notes.push(`${handle}: templateSuffix "${page.templateSuffix}" rejected (${result.userErrors.map((e) => e.message).join('; ')}) – saved without suffix`);
      delete input.templateSuffix;
      result = await savePage(existing?.id, input);
    }
    if (result.userErrors.length) {
      summary.failed.push(`${handle}: ${JSON.stringify(result.userErrors)}`);
      continue;
    }
    (existing ? summary.updated : summary.created).push(`${result.page.handle}${result.page.templateSuffix ? ` [${result.page.templateSuffix}]` : ''}`);
    console.log(`  ${existing ? '~' : '+'} ${result.page.handle}${result.page.templateSuffix ? ` (template ${result.page.templateSuffix})` : ''}`);
  }

  console.log(`[pages] created ${summary.created.length}, updated ${summary.updated.length}, failed ${summary.failed.length}`);
  for (const line of summary.notes) console.log(`  ! ${line}`);
  for (const line of summary.failed) console.log(`  !! ${line}`);
  return summary;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { parseArgs } = await import('./lib/admin.mjs');
  await run(parseArgs());
}
