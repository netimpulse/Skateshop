#!/usr/bin/env node
// Merges locale fragments (.werkbank-tmp/locales/<area>.{de,en}.json or given paths) into
// locales/de.default.json and locales/en.json. Fails on conflicting values or diverging key sets.
// Usage: node scripts/merge-locales.mjs [fragment-dir] [--base <dir with de.default.json + en.json>]
// With --base the result is rebuilt from the base files + fragments (fragments may change between runs).
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const argv = process.argv.slice(2);
const baseIndex = argv.indexOf('--base');
const baseDir = baseIndex > -1 ? argv[baseIndex + 1] : null;
const positional = argv.filter((arg, index) => !arg.startsWith('--') && (baseIndex === -1 || index !== baseIndex + 1));
const fragmentDir = positional[0] || join(ROOT, '.werkbank-tmp/locales');
const TARGETS = { de: 'locales/de.default.json', en: 'locales/en.json' };

const problems = [];

async function readJson(path) {
  return JSON.parse((await readFile(path, 'utf8')).replace(/^﻿?\s*\/\*[\s\S]*?\*\/\s*/, ''));
}

function merge(target, source, trail, origin) {
  for (const [key, value] of Object.entries(source)) {
    const path = trail ? `${trail}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      if (key in target && (typeof target[key] !== 'object' || target[key] === null)) {
        problems.push(`${origin}: "${path}" is an object but already a string`);
        continue;
      }
      target[key] = target[key] || {};
      merge(target[key], value, path, origin);
    } else if (key in target && target[key] !== value) {
      problems.push(`${origin}: "${path}" conflicts ("${target[key]}" vs "${value}")`);
    } else {
      target[key] = value;
    }
  }
}

function sortDeep(object) {
  if (!object || typeof object !== 'object' || Array.isArray(object)) return object;
  return Object.fromEntries(Object.keys(object).sort().map((key) => [key, sortDeep(object[key])]));
}

function keys(object, prefix = '') {
  return Object.entries(object).flatMap(([key, value]) =>
    value && typeof value === 'object' ? keys(value, `${prefix}${key}.`) : [`${prefix}${key}`]
  );
}

const result = {};
for (const [lang, file] of Object.entries(TARGETS)) {
  const source = baseDir ? join(baseDir, file.replace('locales/', '')) : join(ROOT, file);
  result[lang] = existsSync(source) ? await readJson(source) : {};
}

const fragments = existsSync(fragmentDir) ? (await readdir(fragmentDir)).filter((name) => /\.(de|en)\.json$/.test(name)).sort() : [];
for (const name of fragments) {
  const lang = name.match(/\.(de|en)\.json$/)[1];
  merge(result[lang], await readJson(join(fragmentDir, name)), '', name);
}

const deKeys = new Set(keys(result.de));
const enKeys = new Set(keys(result.en));
for (const key of deKeys) if (!enKeys.has(key)) problems.push(`en is missing "${key}"`);
for (const key of enKeys) if (!deKeys.has(key)) problems.push(`de is missing "${key}"`);

if (problems.length) {
  for (const problem of problems) console.error(`error ${problem}`);
  console.error(`\nmerge-locales: ${problems.length} problem(s), nothing written`);
  process.exit(1);
}

for (const [lang, file] of Object.entries(TARGETS)) {
  await writeFile(join(ROOT, file), `${JSON.stringify(sortDeep(result[lang]), null, 2)}\n`);
}
console.log(`merge-locales: merged ${fragments.length} fragment(s), ${deKeys.size} keys per language`);
