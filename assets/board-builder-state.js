/**
 * Board builder persistence (localStorage) with strict validation – storage content is untrusted input.
 * Pure module: no imports, no DOM (unit-tested with `node --test`). The storage object is injected.
 *
 * Stored shape (v1): { v: 1, saved: <ms>, step: 'wheels', sel: { deck: { p, v, h }, …, riser?: { p, v, h } } }
 * Prices, titles and availability are never taken from storage – they come from fresh endpoint data.
 */

export const STORAGE_KEY = 'skateshop:builder:v1';
export const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
export const MAX_BYTES = 4096;
export const PART_KEYS = ['deck', 'trucks', 'wheels', 'bearings', 'griptape', 'hardware', 'riser'];

const HANDLE = /^[a-z0-9][a-z0-9-]{0,99}$/;
const BUILD_ID = /^b-[a-z0-9]{6,24}$/;

const isId = (value) => Number.isSafeInteger(value) && value > 0;

export function emptyState(step = 'deck') {
  return { v: 1, saved: 0, step, sel: {} };
}

/**
 * Validates raw storage text. Returns a clean state or null.
 * @param {string|null} raw
 * @param {{ stepKeys: string[], now?: number }} options
 */
export function validate(raw, { stepKeys = [], now = Date.now() } = {}) {
  if (typeof raw !== 'string' || raw.length === 0 || raw.length > MAX_BYTES) return null;
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!data || typeof data !== 'object' || Array.isArray(data) || data.v !== 1) return null;
  if (!Number.isFinite(data.saved) || data.saved > now + 60_000 || now - data.saved > MAX_AGE_MS) return null;

  const allowedSteps = [...stepKeys, 'summary'];
  const step = allowedSteps.includes(data.step) ? data.step : stepKeys[0] || 'deck';

  const sel = {};
  if (data.sel && typeof data.sel === 'object' && !Array.isArray(data.sel)) {
    for (const [part, entry] of Object.entries(data.sel)) {
      if (!PART_KEYS.includes(part)) return null;
      if (!entry || typeof entry !== 'object') return null;
      if (!isId(entry.p) || !isId(entry.v) || typeof entry.h !== 'string' || !HANDLE.test(entry.h)) return null;
      sel[part] = { p: entry.p, v: entry.v, h: entry.h };
    }
  } else if (data.sel !== undefined) {
    return null;
  }

  return { v: 1, saved: data.saved, step, sel };
}

export function load(storage, options) {
  try {
    return validate(storage?.getItem(STORAGE_KEY) ?? null, options);
  } catch {
    return null;
  }
}

export function save(storage, state, now = Date.now()) {
  const payload = JSON.stringify({ v: 1, saved: now, step: state.step, sel: state.sel });
  if (payload.length > MAX_BYTES) return false;
  try {
    storage?.setItem(STORAGE_KEY, payload);
    return true;
  } catch {
    return false;
  }
}

export function reset(storage) {
  try {
    storage?.removeItem(STORAGE_KEY);
  } catch {
    /* storage unavailable */
  }
}

/** Unique id per add-to-cart of a build: b- + base36 time + 6 random chars. */
export function newBuildId(random = Math.random, now = Date.now()) {
  let suffix = '';
  for (let index = 0; index < 6; index += 1) suffix += Math.floor(random() * 36).toString(36);
  return `b-${now.toString(36)}${suffix}`;
}

export function isBuildId(value) {
  return typeof value === 'string' && BUILD_ID.test(value);
}
