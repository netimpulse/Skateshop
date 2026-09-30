import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkCandidate, evaluate, mergeConfig, strongest } from '../../assets/board-builder-rules.js';

const withDeck = (width) => ({ specs: { deck: { deck_width: width } } });

test('truck width hint gives the recommended range for the deck', () => {
  const [hint] = evaluate('trucks', withDeck(8.25));
  assert.equal(hint.key, 'rules.truck_width_hint');
  assert.deepEqual(hint.vars, { deck: '8.25"', min: '8"', max: '8.5"' });
  assert.deepEqual(hint.filter, { key: 'truck_width', min: 8, max: 8.5 });
});

test('truck candidates inside the tolerance fit, outside warn', () => {
  const ctx = withDeck(8.25);
  assert.equal(strongest(checkCandidate('trucks', { truck_width: 8.0 }, ctx)).level, 'ok');
  assert.equal(strongest(checkCandidate('trucks', { truck_width: 8.5 }, ctx)).level, 'ok');
  const tooWide = strongest(checkCandidate('trucks', { truck_width: 9.0 }, ctx));
  assert.equal(tooWide.level, 'warn');
  assert.equal(tooWide.key, 'rules.truck_too_wide');
  assert.equal(strongest(checkCandidate('trucks', { truck_width: 7.6 }, ctx)).key, 'rules.truck_too_narrow');
});

test('missing measurements produce no result', () => {
  assert.deepEqual(evaluate('trucks', { specs: {} }), []);
  assert.deepEqual(evaluate('trucks', { specs: { deck: { deck_width: null } } }), []);
  assert.deepEqual(checkCandidate('trucks', { truck_width: null }, withDeck(8.25)), []);
});

test('wheels above the riser threshold get the riser hint with an extra offer', () => {
  assert.deepEqual(evaluate('wheels', { specs: { wheels: { wheel_size: 56 } } }), []);
  const [hint] = evaluate('wheels', { specs: { wheels: { wheel_size: 58 } } });
  assert.equal(hint.key, 'rules.riser_hint');
  assert.deepEqual(hint.action, { type: 'offer-extra', part: 'riser' });
  assert.equal(checkCandidate('wheels', { wheel_size: 58 }, { specs: {} })[0].key, 'rules.riser_badge');
});

test('config overrides are applied', () => {
  const config = mergeConfig({ riserThresholdMm: 54, truckTolerance: 0.125 });
  assert.equal(evaluate('wheels', { specs: { wheels: { wheel_size: 55 } }, config }).length, 1);
  const [hint] = evaluate('trucks', { ...withDeck(8.25), config });
  assert.deepEqual([hint.filter.min, hint.filter.max], [8.125, 8.375]);
});

test('low trucks with big wheels warn, hardware too short for risers warns', () => {
  const low = evaluate('wheels', { specs: { trucks: { truck_height: 'Low' }, wheels: { wheel_size: 54 } } });
  assert.ok(low.some((result) => result.key === 'rules.low_truck_wheel'));
  const hardware = evaluate('hardware', { specs: { riser: {}, hardware: { hardware_length: 0.875 } } });
  assert.equal(hardware[0].key, 'rules.hardware_riser');
  assert.deepEqual(evaluate('hardware', { specs: { hardware: { hardware_length: 0.875 } } }), []);
});

test('deck step warns when selected trucks do not fit the deck', () => {
  const ctx = { specs: { trucks: { truck_width: 8.0 }, deck: { deck_width: 8.75 } } };
  assert.equal(evaluate('deck', ctx)[0].key, 'rules.deck_truck_mismatch');
  assert.equal(strongest(checkCandidate('deck', { deck_width: 8.0 }, ctx)).level, 'ok');
});
