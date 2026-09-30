// Step "defs": metafield definitions (namespace custom) for products, variants and collections.
// Existing definitions with the same owner/key are never changed or deleted – they are skipped and reported.
import { gql } from './lib/admin.mjs';
import { DEFINITIONS, DEF_MARKER } from './data/definitions.mjs';

const OWNERS = ['PRODUCT', 'PRODUCTVARIANT', 'COLLECTION'];

export async function listCustomDefinitions() {
  const byOwner = new Map();
  for (const ownerType of OWNERS) {
    const data = await gql(
      `query ($o: MetafieldOwnerType!) {
        metafieldDefinitions(first: 250, ownerType: $o, namespace: "custom") {
          nodes { id key name description type { name } access { storefront } pinnedPosition }
        }
      }`,
      { o: ownerType }
    );
    byOwner.set(ownerType, new Map(data.metafieldDefinitions.nodes.map((d) => [d.key, d])));
  }
  return byOwner;
}

async function createDefinition(definition) {
  const data = await gql(
    `mutation ($definition: MetafieldDefinitionInput!) {
      metafieldDefinitionCreate(definition: $definition) {
        createdDefinition { id key ownerType access { storefront } pinnedPosition }
        userErrors { field message code }
      }
    }`,
    { definition }
  );
  return data.metafieldDefinitionCreate;
}

export async function run({ dryRun = false } = {}) {
  const existing = await listCustomDefinitions();
  const summary = { created: [], skipped: [], warnings: [] };

  for (const def of DEFINITIONS) {
    for (const ownerType of def.owners) {
      const label = `${ownerType}.custom.${def.key}`;
      const found = existing.get(ownerType).get(def.key);
      if (found) {
        const note = found.type.name === def.type ? 'exists' : `exists with DIFFERENT type ${found.type.name} (expected ${def.type})`;
        summary.skipped.push(`${label} (${note})`);
        if (found.type.name !== def.type) summary.warnings.push(`${label}: ${note}`);
        continue;
      }
      if (dryRun) {
        console.log(`  would create ${label} (${def.type})`);
        summary.created.push(label);
        continue;
      }
      const validations = [];
      if (def.choices) validations.push({ name: 'choices', value: JSON.stringify(def.choices) });
      for (const v of def.validations || []) validations.push(v);
      const input = {
        name: def.name,
        namespace: 'custom',
        key: def.key,
        description: `${def.description} ${DEF_MARKER}`,
        type: def.type,
        ownerType,
        validations,
        access: { storefront: 'PUBLIC_READ' },
        pin: true,
      };
      let result = await createDefinition(input);
      // Pin limit reached → create unpinned.
      if (result.userErrors.some((e) => /pin/i.test(`${e.code} ${e.message}`))) {
        summary.warnings.push(`${label}: pin rejected (${result.userErrors.map((e) => e.message).join('; ')}), created unpinned`);
        result = await createDefinition({ ...input, pin: false });
      }
      // Storefront access not allowed → create without access setting.
      if (result.userErrors.some((e) => /access|storefront/i.test(`${e.field} ${e.code} ${e.message}`))) {
        summary.warnings.push(`${label}: storefront access rejected (${result.userErrors.map((e) => e.message).join('; ')})`);
        const { access, ...rest } = input;
        result = await createDefinition({ ...rest, pin: false });
      }
      if (result.userErrors.length) {
        summary.warnings.push(`${label}: FAILED ${JSON.stringify(result.userErrors)}`);
        continue;
      }
      summary.created.push(`${label} (storefront ${result.createdDefinition.access.storefront}${result.createdDefinition.pinnedPosition ? ', pinned' : ''})`);
    }
  }

  console.log(`[defs] created ${summary.created.length}, skipped ${summary.skipped.length}`);
  for (const line of summary.created) console.log(`  + ${line}`);
  for (const line of summary.skipped) console.log(`  = ${line}`);
  for (const line of summary.warnings) console.log(`  ! ${line}`);
  return summary;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { parseArgs } = await import('./lib/admin.mjs');
  await run(parseArgs());
}
