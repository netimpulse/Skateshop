import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isBuildId, load, MAX_AGE_MS, newBuildId, reset, save, STORAGE_KEY, validate } from '../../assets/board-builder-state.js';

const stepKeys = ['deck', 'trucks', 'wheels', 'bearings', 'griptape', 'hardware'];
const now = 1_800_000_000_000;
const valid = (extra = {}) =>
  JSON.stringify({ v: 1, saved: now - 1000, step: 'wheels', sel: { deck: { p: 1, v: 11, h: 'sundial-deck' } }, ...extra });

test('valid state is accepted', () => {
  const state = validate(valid(), { stepKeys, now });
  assert.equal(state.step, 'wheels');
  assert.deepEqual(state.sel.deck, { p: 1, v: 11, h: 'sundial-deck' });
});

test('manipulated or stale states are rejected', () => {
  const cases = [
    valid({ v: 2 }),
    valid({ saved: now - MAX_AGE_MS - 1 }),
    valid({ sel: { deck: { p: '1', v: 11, h: 'x' } } }),
    valid({ sel: { deck: { p: 1, v: 11, h: '<img src=x onerror=alert(1)>' } } }),
    valid({ sel: { evil: { p: 1, v: 1, h: 'a' } } }),
    valid({ sel: [] }),
    'not json',
    'x'.repeat(5000),
    null,
  ];
  for (const raw of cases) assert.equal(validate(raw, { stepKeys, now }), null, String(raw).slice(0, 60));
});

test('unknown step falls back to the first step', () => {
  assert.equal(validate(valid({ step: 'boom' }), { stepKeys, now }).step, 'deck');
  assert.equal(validate(valid({ step: 'summary' }), { stepKeys, now }).step, 'summary');
});

test('save/load/reset round trip through an injected storage', () => {
  const memory = new Map();
  const storage = { getItem: (k) => memory.get(k) ?? null, setItem: (k, v) => memory.set(k, v), removeItem: (k) => memory.delete(k) };
  assert.equal(save(storage, { step: 'trucks', sel: { deck: { p: 1, v: 2, h: 'deck-a' } } }, Date.now()), true);
  assert.equal(load(storage, { stepKeys }).step, 'trucks');
  reset(storage);
  assert.equal(memory.has(STORAGE_KEY), false);
  const throwing = { getItem() { throw new Error('denied'); } };
  assert.equal(load(throwing, { stepKeys }), null);
});

test('build ids match the cart property contract', () => {
  const id = newBuildId();
  assert.ok(isBuildId(id), id);
  assert.equal(isBuildId('b-<x>'), false);
});
