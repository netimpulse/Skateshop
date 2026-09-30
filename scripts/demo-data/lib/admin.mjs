// Minimal Shopify Admin GraphQL client for the demo-data seed scripts.
// Reads SHOPIFY_STORE_URL and SHOPIFY_ADMIN_TOKEN from the environment – never commit tokens.
import { readFile, stat } from 'node:fs/promises';
import { basename, extname } from 'node:path';

const API_VERSION = '2025-07';

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

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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
  if (throttled && attempt < 5) {
    await sleep(1000 * 2 ** attempt);
    return gql(query, variables, attempt + 1);
  }
  if (payload.errors) throw new Error(JSON.stringify(payload.errors, null, 2));
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
