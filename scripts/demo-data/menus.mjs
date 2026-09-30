// Step "menus": navigation menus with own handles (skate-*). main-menu and other existing menus stay untouched.
import { gql, assertNoUserErrors } from './lib/admin.mjs';
import { MENUS } from './data/content.mjs';
import { findCollection } from './collections.mjs';
import { resolvePage } from './pages.mjs';

export async function listMenus() {
  const data = await gql(`{ menus(first: 100) { nodes { id handle title items { id } } } }`);
  return data.menus.nodes;
}

async function toItem(item, cache, missing) {
  let base;
  if (item.collection) {
    if (!cache.has(`c:${item.collection}`)) cache.set(`c:${item.collection}`, await findCollection(item.collection));
    const col = cache.get(`c:${item.collection}`);
    base = col ? { title: item.title, type: 'COLLECTION', resourceId: col.id } : { title: item.title, type: 'HTTP', url: `/collections/${item.collection}` };
    if (!col) missing.push(`collection ${item.collection}`);
  } else if (item.page) {
    if (!cache.has(`p:${item.page}`)) cache.set(`p:${item.page}`, await resolvePage(item.page));
    const page = cache.get(`p:${item.page}`);
    base = page ? { title: item.title, type: 'PAGE', resourceId: page.id } : { title: item.title, type: 'HTTP', url: `/pages/${item.page}` };
    if (!page) missing.push(`page ${item.page}`);
  } else {
    base = { title: item.title, type: 'HTTP', url: item.url };
  }
  const children = [];
  for (const child of item.items || []) children.push(await toItem(child, cache, missing));
  return { ...base, items: children };
}

export async function run({ dryRun = false } = {}) {
  const summary = { created: [], updated: [], notes: [] };
  const menus = await listMenus();
  const cache = new Map();

  for (const menu of MENUS) {
    const missing = [];
    const items = [];
    for (const item of menu.items) items.push(await toItem(item, cache, missing));
    if (missing.length) summary.notes.push(`${menu.handle}: not seeded yet → plain URL used for ${[...new Set(missing)].join(', ')}`);
    const existing = menus.find((m) => m.handle === menu.handle);
    if (dryRun) {
      console.log(`  would ${existing ? 'update' : 'create'} menu ${menu.handle} (${items.length} top-level items)`);
      (existing ? summary.updated : summary.created).push(menu.handle);
      continue;
    }
    if (existing) {
      const data = await gql(
        `mutation ($id: ID!, $title: String!, $handle: String!, $items: [MenuItemUpdateInput!]!) {
          menuUpdate(id: $id, title: $title, handle: $handle, items: $items) { menu { id handle } userErrors { field message code } }
        }`,
        { id: existing.id, title: menu.title, handle: menu.handle, items }
      );
      assertNoUserErrors(`menuUpdate ${menu.handle}`, data.menuUpdate);
      summary.updated.push(menu.handle);
    } else {
      const data = await gql(
        `mutation ($title: String!, $handle: String!, $items: [MenuItemCreateInput!]!) {
          menuCreate(title: $title, handle: $handle, items: $items) { menu { id handle } userErrors { field message code } }
        }`,
        { title: menu.title, handle: menu.handle, items }
      );
      const created = assertNoUserErrors(`menuCreate ${menu.handle}`, data.menuCreate).menu;
      if (created.handle !== menu.handle) summary.notes.push(`${menu.handle} was created as ${created.handle}`);
      summary.created.push(created.handle);
    }
    console.log(`  ${existing ? '~' : '+'} ${menu.handle}`);
  }

  console.log(`[menus] created ${summary.created.length}, updated ${summary.updated.length}`);
  for (const line of summary.notes) console.log(`  ! ${line}`);
  return summary;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { parseArgs } = await import('./lib/admin.mjs');
  await run(parseArgs());
}
