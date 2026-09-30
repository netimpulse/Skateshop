// Step "files": uploads images (staged upload → fileCreate) under fixed names `skate-demo-*.png`.
// Idempotent: files that already exist (matched by name) are not uploaded again; only their alt text is synced.
import { access } from 'node:fs/promises';
import { gql, assertNoUserErrors, stagedUpload, listDemoFiles, waitForFiles, mapLimit, filenameFromUrl, logicalFilename } from './lib/admin.mjs';
import { allImages, imagePath } from './images.mjs';

/**
 * Makes sure every entry ({ file, alt }) exists as a Shopify file.
 * Returns a Map logical file name → { id, filename, url, alt }.
 */
export async function ensureFiles(entries, { dryRun = false, label = 'files' } = {}) {
  let existing = await listDemoFiles();
  const missing = entries.filter((e) => !existing.has(e.file));
  const altUpdates = entries.filter((e) => existing.has(e.file) && existing.get(e.file).alt !== e.alt);

  if (dryRun) {
    for (const e of missing) console.log(`  would upload ${e.file}`);
    for (const e of altUpdates) console.log(`  would update alt of ${e.file}`);
    return existing;
  }

  if (missing.length) {
    for (const e of missing) {
      try {
        await access(imagePath(e.file));
      } catch {
        throw new Error(`Local image missing: ${e.file} – run the "images" step first`);
      }
    }
    const staged = await mapLimit(missing, 4, async (e) => ({ ...e, resourceUrl: await stagedUpload(imagePath(e.file)) }));
    const createdIds = [];
    for (let i = 0; i < staged.length; i += 25) {
      const batch = staged.slice(i, i + 25);
      const data = await gql(
        `mutation ($files: [FileCreateInput!]!) {
          fileCreate(files: $files) { files { id } userErrors { field message code } }
        }`,
        {
          files: batch.map((e) => ({
            originalSource: e.resourceUrl,
            filename: e.file,
            alt: e.alt,
            contentType: 'IMAGE',
            duplicateResolutionMode: 'RAISE_ERROR',
          })),
        }
      );
      assertNoUserErrors('fileCreate', data.fileCreate);
      createdIds.push(...data.fileCreate.files.map((f) => f.id));
    }
    const done = await waitForFiles(createdIds);
    const failed = [...done.values()].filter((f) => f.fileStatus === 'FAILED');
    if (failed.length) throw new Error(`File processing failed: ${JSON.stringify(failed.map((f) => ({ id: f.id, errors: f.fileErrors })))}`);
    console.log(`[${label}] uploaded ${createdIds.length} file(s)`);
    // The files search index lags behind fileCreate, so register the new files from the polled nodes directly.
    for (const node of done.values()) {
      const url = node.image?.url || node.url || node.originalSource?.url;
      const filename = filenameFromUrl(url);
      if (filename) existing.set(logicalFilename(filename), { id: node.id, filename, url, alt: node.alt, status: node.fileStatus });
    }
  }

  if (altUpdates.length) {
    for (let i = 0; i < altUpdates.length; i += 25) {
      const batch = altUpdates.slice(i, i + 25);
      const data = await gql(
        `mutation ($files: [FileUpdateInput!]!) { fileUpdate(files: $files) { files { id } userErrors { field message } } }`,
        { files: batch.map((e) => ({ id: existing.get(e.file).id, alt: e.alt })) }
      );
      assertNoUserErrors('fileUpdate', data.fileUpdate);
      for (const e of batch) existing.get(e.file).alt = e.alt;
    }
    console.log(`[${label}] updated alt text of ${altUpdates.length} file(s)`);
  }

  const unresolved = entries.filter((e) => !existing.has(e.file));
  if (unresolved.length) throw new Error(`Files not found after upload: ${unresolved.map((e) => e.file).join(', ')}`);
  return existing;
}

/** Section images (hero, categories, editorial, community, builder promo, collection banners). */
export function sectionFileEntries() {
  return allImages().filter((img) => img.kind === 'section').map(({ file, alt, width, height }) => ({ file, alt, width, height }));
}

export async function run({ dryRun = false } = {}) {
  const entries = sectionFileEntries();
  console.log(`[files] ${entries.length} section images`);
  const files = await ensureFiles(entries, { dryRun, label: 'files' });
  for (const e of entries) {
    const f = files.get(e.file);
    console.log(`  ${e.file} → ${f ? f.filename : '(not uploaded)'}`);
  }
  return files;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { parseArgs } = await import('./lib/admin.mjs');
  await run(parseArgs());
}
