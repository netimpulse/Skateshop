#!/usr/bin/env node
// Structural validator for the theme – complements `shopify theme check`.
// Usage: node scripts/validate-theme.mjs [--unused] [--final] [--extra-locales <de.json>]
import { readFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, basename } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const args = process.argv.slice(2);
const flags = { unused: args.includes('--unused'), final: args.includes('--final') };
const extraLocaleIndex = args.indexOf('--extra-locales');
const extraLocale = extraLocaleIndex > -1 ? args[extraLocaleIndex + 1] : null;

const errors = [];
const warnings = [];
const error = (file, message) => errors.push(`${file}: ${message}`);
const warn = (file, message) => warnings.push(`${file}: ${message}`);

const read = (path) => readFile(join(ROOT, path), 'utf8');
const list = async (dir, extension) => {
  if (!existsSync(join(ROOT, dir))) return [];
  return (await readdir(join(ROOT, dir))).filter((name) => name.endsWith(extension)).map((name) => `${dir}/${name}`);
};

/** Strips the auto-generated leading block comment Shopify allows in JSON files, then parses strictly. */
function parseJson(file, source) {
  const stripped = source.replace(/^\uFEFF?\s*\/\*[\s\S]*?\*\/\s*/, '');
  try {
    return JSON.parse(stripped);
  } catch (err) {
    error(file, `invalid JSON – ${err.message}`);
    return null;
  }
}

function extractSchema(file, source) {
  const match = source.match(/{%-?\s*schema\s*-?%}([\s\S]*?){%-?\s*endschema\s*-?%}/);
  if (!match) return null;
  return parseJson(`${file} (schema)`, match[1]);
}

function flatten(object, prefix = '', out = {}) {
  for (const [key, value] of Object.entries(object || {})) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) flatten(value, path, out);
    else out[path] = value;
  }
  return out;
}

function deepMerge(target, source) {
  for (const [key, value] of Object.entries(source)) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      target[key] = deepMerge(target[key] && typeof target[key] === 'object' ? target[key] : {}, value);
    } else {
      target[key] = value;
    }
  }
  return target;
}

const PLURAL_KEYS = new Set(['zero', 'one', 'two', 'few', 'many', 'other']);

async function main() {
  // --- Sections & blocks: schemas -----------------------------------------------------------
  const sectionFiles = await list('sections', '.liquid');
  const blockFiles = await list('blocks', '.liquid');
  const schemas = new Map();
  const themeBlocks = new Set(blockFiles.map((file) => basename(file, '.liquid')));

  for (const file of [...sectionFiles, ...blockFiles]) {
    const source = await read(file);
    const schema = extractSchema(file, source);
    if (schema) schemas.set(file, schema);
    if (/\sstyle\s*=\s*["']/.test(source)) error(file, 'inline style attribute found (CLAUDE.md: keine Inline-Styles)');
    if (flags.final && /"t:/.test(source)) error(file, 'schema still uses t: keys');
    if (schema) {
      const ids = new Set();
      for (const setting of schema.settings || []) {
        if (!setting.id) continue;
        if (ids.has(setting.id)) error(file, `duplicate setting id "${setting.id}"`);
        ids.add(setting.id);
      }
      if (schema.name && !schema.name.startsWith('t:') && schema.name.length > 25) error(file, `schema name longer than 25 chars`);
    }
  }

  // --- Snippets: inline styles ----------------------------------------------------------------
  for (const file of [...(await list('snippets', '.liquid')), ...(await list('layout', '.liquid')), ...(await list('templates', '.liquid'))]) {
    const source = await read(file);
    if (/\sstyle\s*=\s*["']/.test(source)) error(file, 'inline style attribute found (CLAUDE.md: keine Inline-Styles)');
  }

  const sectionSchema = (type) => schemas.get(`sections/${type}.liquid`);

  function checkSectionInstance(file, key, section) {
    const schemaFile = `sections/${section.type}.liquid`;
    if (!existsSync(join(ROOT, schemaFile))) {
      error(file, `section "${key}" references missing ${schemaFile}`);
      return;
    }
    const schema = sectionSchema(section.type);
    if (!schema) return;
    const settingIds = new Set((schema.settings || []).map((setting) => setting.id).filter(Boolean));
    for (const id of Object.keys(section.settings || {})) {
      if (!settingIds.has(id)) error(file, `section "${key}" (${section.type}) sets unknown setting "${id}"`);
    }
    const blockDefs = schema.blocks || [];
    const acceptsTheme = blockDefs.some((block) => block.type === '@theme');
    for (const [blockKey, block] of Object.entries(section.blocks || {})) {
      const local = blockDefs.find((def) => def.type === block.type);
      if (local) {
        const blockIds = new Set((local.settings || []).map((setting) => setting.id).filter(Boolean));
        for (const id of Object.keys(block.settings || {})) {
          if (!blockIds.has(id)) error(file, `block "${blockKey}" (${block.type}) sets unknown setting "${id}"`);
        }
      } else if (!(acceptsTheme && themeBlocks.has(block.type)) && block.type !== '@app') {
        error(file, `block "${blockKey}" has type "${block.type}" not allowed by ${schemaFile}`);
      }
    }
    const order = section.block_order || [];
    for (const blockKey of order) {
      if (!section.blocks?.[blockKey]) error(file, `block_order references missing block "${blockKey}"`);
    }
  }

  // --- Templates & section groups -------------------------------------------------------------
  for (const file of await list('templates', '.json')) {
    const data = parseJson(file, await read(file));
    if (!data) continue;
    const sections = data.sections || {};
    if (Object.keys(sections).length > 25) error(file, 'more than 25 sections');
    for (const [key, section] of Object.entries(sections)) checkSectionInstance(file, key, section);
    for (const key of data.order || []) if (!sections[key]) error(file, `order references missing section "${key}"`);
  }
  for (const file of await list('sections', '.json')) {
    const data = parseJson(file, await read(file));
    if (!data) continue;
    for (const [key, section] of Object.entries(data.sections || {})) checkSectionInstance(file, key, section);
    for (const key of data.order || []) if (!data.sections?.[key]) error(file, `order references missing section "${key}"`);
  }
  for (const file of await list('config', '.json')) parseJson(file, await read(file));

  // --- Locales --------------------------------------------------------------------------------
  const localeFiles = await list('locales', '.json');
  const locales = {};
  for (const file of localeFiles) locales[basename(file)] = parseJson(file, await read(file)) || {};
  const defaultName = Object.keys(locales).find((name) => /\.default\.json$/.test(name));
  if (!defaultName) error('locales', 'no storefront default locale');
  const defaultLocale = structuredClone(locales[defaultName] || {});
  if (extraLocale) deepMerge(defaultLocale, parseJson(extraLocale, await readFile(extraLocale, 'utf8')) || {});
  const defaultKeys = flatten(defaultLocale);

  for (const [name, content] of Object.entries(locales)) {
    const flat = flatten(content);
    for (const [key, value] of Object.entries(flat)) {
      if (value === '') error(`locales/${name}`, `empty string for "${key}"`);
    }
    const isSchema = name.includes('.schema.');
    if (isSchema || name === defaultName) continue;
    const baseKeys = Object.keys(flatten(locales[defaultName] || {}));
    const ownKeys = Object.keys(flat);
    for (const key of baseKeys) if (!(key in flat)) error(`locales/${name}`, `missing key "${key}"`);
    for (const key of ownKeys) if (!baseKeys.includes(key)) error(`locales/${name}`, `extra key "${key}"`);
  }

  // --- Translation keys used in Liquid ----------------------------------------------------------
  const liquidFiles = [
    ...sectionFiles,
    ...blockFiles,
    ...(await list('snippets', '.liquid')),
    ...(await list('layout', '.liquid')),
    ...(await list('templates', '.liquid')),
  ];
  const usedKeys = new Set();
  const keyPattern = /['"]([a-z0-9_]+(?:\.[a-z0-9_]+)+)['"]\s*\|\s*t\b/g;
  for (const file of liquidFiles) {
    const source = await read(file);
    for (const match of source.matchAll(keyPattern)) {
      const key = match[1];
      usedKeys.add(key);
      const exists = key in defaultKeys || Object.keys(defaultKeys).some((candidate) => {
        const [base, last] = [candidate.slice(0, candidate.lastIndexOf('.')), candidate.slice(candidate.lastIndexOf('.') + 1)];
        return base === key && PLURAL_KEYS.has(last);
      });
      if (!exists) error(file, `translation key "${key}" missing in ${defaultName}`);
    }
  }
  if (flags.unused) {
    for (const key of Object.keys(defaultKeys)) {
      const base = PLURAL_KEYS.has(key.slice(key.lastIndexOf('.') + 1)) ? key.slice(0, key.lastIndexOf('.')) : key;
      if (!usedKeys.has(key) && !usedKeys.has(base)) warn(defaultName, `unused key "${key}"`);
    }
  }

  // --- JavaScript modules ---------------------------------------------------------------------
  const layout = existsSync(join(ROOT, 'layout/theme.liquid')) ? await read('layout/theme.liquid') : '';
  const importMapMatch = layout.match(/<script type="importmap">([\s\S]*?)<\/script>/);
  const mappedAssets = new Set(importMapMatch ? [...importMapMatch[1].matchAll(/'([\w.-]+\.js)'\s*\|\s*asset_url/g)].map((m) => m[1]) : []);
  if (importMapMatch && layout.indexOf('<script type="importmap">') > layout.indexOf('content_for_header')) {
    error('layout/theme.liquid', 'import map must precede content_for_header');
  }
  for (const file of await list('assets', '.js')) {
    const name = basename(file);
    if (importMapMatch && !mappedAssets.has(name)) error(file, 'module is missing from the import map in layout/theme.liquid');
    const source = await read(file);
    if (/['"`]\/(cart|search|recommendations|products|collections|pages)(\/|['"`?.])/.test(source)) {
      error(file, 'hardcoded storefront route – use config routes');
    }
    if (/\binnerHTML\s*=\s*[^;]*\$\{/.test(source)) warn(file, 'innerHTML with template interpolation – make sure values are escaped');
  }

  // --- Report ---------------------------------------------------------------------------------
  for (const message of warnings) console.warn(`warn  ${message}`);
  for (const message of errors) console.error(`error ${message}`);
  console.log(`\nvalidate-theme: ${errors.length} error(s), ${warnings.length} warning(s)`);
  process.exitCode = errors.length ? 1 : 0;
}

await main();
