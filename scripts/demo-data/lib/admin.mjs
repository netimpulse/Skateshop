// Minimal Shopify Admin GraphQL client for the demo-data seed scripts.
// Reads SHOPIFY_STORE_URL and SHOPIFY_ADMIN_TOKEN from the environment – never commit or log tokens.
import { readFile, stat } from 'node:fs/promises';
import { basename, extname } from 'node:path';

export const API_VERSION = '2025-07';

function storeDomain() {
  const raw = process.env.SHOPIFY_STORE_URL || '';
  const domain = raw.replace(/^https?:\/\//, '').replace(/\/+$/, '');
  if (!domain) throw new Error('SHOPIFY_STORE_URL is not set');
  return domain;
}

function token() {
  const value = process.env.SHOPIFY_ADMIN_TOKEN;
  if (!value) throw new Error('SHOPIFY_ADMIN_TOKEN is not set');
  return value;
}

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function gql(query, variables = {}, attempt = 0) {
  const response = await fetch(`https://${storeDomain()}/admin/api/${API_VERSION}/graphql.json`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': token() },
    body: JSON.stringify({ query, variables }),
  });

  if (response.status === 429 || response.status >= 500) {
    if (attempt >= 5) throw new Error(`Admin API ${response.status} after retries`);
    await sleep(1000 * 2 ** attempt);
    return gql(query, variables, attempt + 1);
  }

  const payload = await response.json();
  const throttled = payload.errors?.some((error) => error.extensions?.code === 'THROTTLED');
  if (throttled && attempt < 6) {
    await sleep(1000 * 2 ** attempt);
    return gql(query, variables, attempt + 1);
  }
  if (payload.errors) throw new Error(JSON.stringify(payload.errors, null, 2));

  // Be gentle with the shared dev store: pause when the cost bucket runs low.
  const bucket = payload.extensions?.cost?.throttleStatus;
  if (bucket && bucket.currentlyAvailable < 200) {
    const missing = 200 - bucket.currentlyAvailable;
    await sleep(Math.ceil((missing / (bucket.restoreRate || 50)) * 1000));
  }
  return payload.data;
}

/** Throws when a mutation payload contains userErrors. */
export function assertNoUserErrors(label, result) {
  const errors = result?.userErrors || [];
  if (errors.length) throw new Error(`${label}: ${JSON.stringify(errors)}`);
  return result;
}

const MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' };

/** Uploads a local image through a staged upload target and returns its resourceUrl. */
export async function stagedUpload(filePath) {
  const filename = basename(filePath);
  const mimeType = MIME[extname(filePath).toLowerCase()] || 'application/octet-stream';
  const { size } = await stat(filePath);

  const data = await gql(
    `mutation ($input: [StagedUploadInput!]!) {
      stagedUploadsCreate(input: $input) {
        stagedTargets { url resourceUrl parameters { name value } }
        userErrors { field message }
      }
    }`,
    { input: [{ filename, mimeType, resource: 'IMAGE', httpMethod: 'POST', fileSize: String(size) }] }
  );
  const { stagedTargets } = assertNoUserErrors('stagedUploadsCreate', data.stagedUploadsCreate);
  const target = stagedTargets[0];

  const form = new FormData();
  for (const { name, value } of target.parameters) form.append(name, value);
  form.append('file', new Blob([await readFile(filePath)], { type: mimeType }), filename);

  const upload = await fetch(target.url, { method: 'POST', body: form });
  if (!upload.ok) throw new Error(`Upload of ${filename} failed with ${upload.status}`);
  return target.resourceUrl;
}

/* ------------------------------------------------------------------ */
/* Seed helpers                                                        */
/* ------------------------------------------------------------------ */

export const DEMO_TAG = 'skate-demo';
export const DEMO_FILE_PREFIX = 'skate-demo-';
export const MARKER = { namespace: 'skate_demo', key: 'seeded', type: 'boolean', value: 'true' };

/** Parses `--dry-run`, `--only=a,b` and `--key=value` flags. */
export function parseArgs(argv = process.argv.slice(2)) {
  const args = { dryRun: false, only: null, flags: {} };
  for (const arg of argv) {
    if (arg === '--dry-run') args.dryRun = true;
    else if (arg.startsWith('--only=')) args.only = new Set(arg.slice(7).split(',').map((s) => s.trim()).filter(Boolean));
    else if (arg.startsWith('--')) {
      const [key, value = 'true'] = arg.slice(2).split('=');
      args.flags[key] = value;
    }
  }
  return args;
}

/** Runs `fn` over `items` with limited concurrency. */
export async function mapLimit(items, limit, fn) {
  const results = new Array(items.length);
  let index = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (index < items.length) {
      const current = index++;
      results[current] = await fn(items[current], current);
    }
  });
  await Promise.all(workers);
  return results;
}

let onlineStorePublication;
/** Returns the publication ID of the Online Store sales channel. */
export async function getOnlineStorePublicationId() {
  if (onlineStorePublication) return onlineStorePublication;
  const data = await gql(`{ publications(first: 50) { nodes { id name } } }`);
  const match = data.publications.nodes.find((p) => p.name === 'Online Store');
  if (!match) throw new Error('Online Store publication not found');
  onlineStorePublication = match.id;
  return onlineStorePublication;
}

/** Publishes a product or collection to the Online Store (no-op when already published). */
export async function publishToOnlineStore(id) {
  const publicationId = await getOnlineStorePublicationId();
  const check = await gql(
    `query ($id: ID!, $pub: ID!) { node(id: $id) { ... on Publishable { publishedOnPublication(publicationId: $pub) } } }`,
    { id, pub: publicationId }
  );
  if (check.node?.publishedOnPublication) return false;
  const data = await gql(
    `mutation ($id: ID!, $input: [PublicationInput!]!) {
      publishablePublish(id: $id, input: $input) { userErrors { field message } }
    }`,
    { id, input: [{ publicationId }] }
  );
  assertNoUserErrors('publishablePublish', data.publishablePublish);
  return true;
}

/** Looks up a product by handle. Returns null when none exists. */
export async function findProductByHandle(handle) {
  const data = await gql(
    `query ($handle: String!) {
      productByIdentifier(identifier: { handle: $handle }) {
        id handle title tags
        options { id name values }
        variants(first: 100) { nodes { id selectedOptions { name value } inventoryItem { id } } }
        media(first: 20) { nodes { id } }
      }
    }`,
    { handle }
  );
  return data.productByIdentifier;
}

/** Extracts the stored file name from a Shopify CDN URL. */
export function filenameFromUrl(url) {
  if (!url) return null;
  return decodeURIComponent(new URL(url).pathname.split('/').pop());
}

/** Removes the suffix Shopify appends to duplicate file names (e.g. `_a1b2c3d4-…`). */
export function logicalFilename(name) {
  return name.replace(/_[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}(?=\.[a-z]+$)/i, '');
}

const FILE_FIELDS = `
  id alt fileStatus createdAt
  ... on MediaImage { image { url width height } originalSource { url } }
  ... on GenericFile { url }
`;

/**
 * Lists all files whose name starts with `skate-demo-`.
 * Returns a Map keyed by the logical file name → { id, filename, url, alt, status };
 * with `{ all: true }` an array of every matching file (duplicates included).
 */
export async function listDemoFiles({ all = false } = {}) {
  const files = new Map();
  const everything = [];
  let after = null;
  do {
    const data = await gql(
      `query ($after: String, $q: String!) {
        files(first: 100, after: $after, query: $q) { pageInfo { hasNextPage endCursor } nodes { ${FILE_FIELDS} } }
      }`,
      { after, q: `filename:${DEMO_FILE_PREFIX}*` }
    );
    for (const node of data.files.nodes) {
      const url = node.image?.url || node.url || node.originalSource?.url || null;
      const filename = filenameFromUrl(url);
      if (!filename || !filename.startsWith(DEMO_FILE_PREFIX)) continue;
      everything.push({ id: node.id, filename, url, alt: node.alt, status: node.fileStatus });
      const logical = logicalFilename(filename);
      // Keep the oldest file when duplicates exist (the one that was referenced first).
      if (!files.has(logical)) files.set(logical, { id: node.id, filename, url, alt: node.alt, status: node.fileStatus });
    }
    after = data.files.pageInfo.hasNextPage ? data.files.pageInfo.endCursor : null;
  } while (after);
  return all ? everything : files;
}

/** Polls until all given file IDs are READY (or FAILED). Returns id → node. */
export async function waitForFiles(ids, { timeoutMs = 180000 } = {}) {
  const pending = new Set(ids);
  const done = new Map();
  const started = Date.now();
  while (pending.size) {
    const batch = [...pending].slice(0, 100);
    const data = await gql(`query ($ids: [ID!]!) { nodes(ids: $ids) { ... on File { ${FILE_FIELDS} fileErrors { message } } } }`, { ids: batch });
    for (const node of data.nodes) {
      if (!node) continue;
      if (node.fileStatus === 'READY' || node.fileStatus === 'FAILED') {
        pending.delete(node.id);
        done.set(node.id, node);
      }
    }
    if (!pending.size) break;
    if (Date.now() - started > timeoutMs) throw new Error(`Files still processing after ${timeoutMs} ms: ${[...pending].join(', ')}`);
    await sleep(2000);
  }
  return done;
}
