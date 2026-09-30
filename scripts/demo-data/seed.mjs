#!/usr/bin/env node
// Demo-data seed for the skateboard theme.
// Usage: NODE_USE_ENV_PROXY=1 node scripts/demo-data/seed.mjs [--dry-run] [--only=defs,images,files,products,collections,pages,menus,report]
//        [--report=<path>] [--handle=<product-handle,...>] [--filter=<image-name-part>]
// Requires SHOPIFY_STORE_URL and SHOPIFY_ADMIN_TOKEN in the environment. Idempotent: re-running updates own data only.
import { parseArgs } from './lib/admin.mjs';

const STEPS = ['defs', 'images', 'files', 'products', 'collections', 'pages', 'menus', 'report'];

const args = parseArgs();
const selected = args.only ? STEPS.filter((s) => args.only.has(s)) : STEPS;
const unknown = args.only ? [...args.only].filter((s) => !STEPS.includes(s)) : [];
if (unknown.length) {
  console.error(`Unknown step(s): ${unknown.join(', ')}. Valid: ${STEPS.join(', ')}`);
  process.exit(1);
}

console.log(`Seed steps: ${selected.join(' → ')}${args.dryRun ? ' (dry run – no changes)' : ''}`);
const started = Date.now();
for (const step of selected) {
  const mod = await import(`./${step}.mjs`);
  console.log(`\n=== ${step} ===`);
  await mod.run(args);
}
console.log(`\nDone in ${Math.round((Date.now() - started) / 1000)} s.`);
