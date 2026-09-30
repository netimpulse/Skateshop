/**
 * Board builder compatibility rules – the single place to tune how parts are matched.
 *
 * Pure module: no imports, no DOM (unit-tested with `node --test`).
 * A rule never blocks a purchase; it only returns hints for the step (`hint`) and per product card (`check`).
 *
 * Rule shape:
 *   {
 *     id: 'unique-id',
 *     target: 'trucks',              // step/part the rule is shown on
 *     requires: ['deck'],            // selected parts the rule needs (skipped when missing)
 *     hint(ctx)  → Result | null,    // step-level hint based on the current selection
 *     check(candidate, ctx) → Result | null, // per candidate (specs of the candidate variant)
 *   }
 *   Result = { level: 'ok' | 'info' | 'warn', key: 'rules.<name>', vars: {…}, action?: {…}, filter?: {…} }
 *
 * `ctx.specs[part]` holds the resolved specs of every selected part, `ctx.config` the merged CONFIG.
 * Message keys resolve to strings in locales (`builder.rules.*`); placeholders use [name].
 * To add a rule: append an object to RULES and add its message to both locale files.
 */

export const CONFIG = {
  // Truck axle width may deviate this much (inches) from the deck width.
  truckTolerance: { minus: 0.25, plus: 0.25 },
  // Wheels above this diameter (mm) get the riser pad hint (wheelbite).
  riserThresholdMm: 56,
  // Low trucks: wheels above this diameter (mm) risk wheelbite without risers.
  lowTruckMaxWheelMm: 53,
  // Hardware needed with riser pads (inches).
  minHardwareWithRiser: 1,
};

const isNumber = (value) => typeof value === 'number' && Number.isFinite(value);
const round = (value, step = 0.125) => Math.round(value / step) * step;
export const formatInch = (value) => `${Number(value.toFixed(3)).toString()}"`;
export const formatMm = (value) => `${Math.round(value)} mm`;

function truckRange(deckWidth, config) {
  return {
    min: round(deckWidth - config.truckTolerance.minus),
    max: round(deckWidth + config.truckTolerance.plus),
  };
}

export const RULES = [
  {
    id: 'truck-width',
    target: 'trucks',
    requires: ['deck'],
    hint({ specs, config }) {
      const deck = specs.deck?.deck_width;
      if (!isNumber(deck)) return null;
      const { min, max } = truckRange(deck, config);
      return {
        level: 'info',
        key: 'rules.truck_width_hint',
        vars: { deck: formatInch(deck), min: formatInch(min), max: formatInch(max) },
        filter: { key: 'truck_width', min, max },
      };
    },
    check(candidate, { specs, config }) {
      const deck = specs.deck?.deck_width;
      const truck = candidate.truck_width;
      if (!isNumber(deck) || !isNumber(truck)) return null;
      const { min, max } = truckRange(deck, config);
      if (truck >= min && truck <= max) return { level: 'ok', key: 'rules.fits', vars: {} };
      return {
        level: 'warn',
        key: truck < min ? 'rules.truck_too_narrow' : 'rules.truck_too_wide',
        vars: { deck: formatInch(deck), min: formatInch(min), max: formatInch(max) },
      };
    },
  },
  {
    id: 'deck-truck-width',
    target: 'deck',
    requires: ['trucks'],
    hint({ specs, config }) {
      const truck = specs.trucks?.truck_width;
      const deck = specs.deck?.deck_width;
      if (!isNumber(truck) || !isNumber(deck)) return null;
      const { min, max } = truckRange(deck, config);
      if (truck >= min && truck <= max) return null;
      return { level: 'warn', key: 'rules.deck_truck_mismatch', vars: { truck: formatInch(truck), deck: formatInch(deck) } };
    },
    check(candidate, { specs, config }) {
      const truck = specs.trucks?.truck_width;
      const deck = candidate.deck_width;
      if (!isNumber(truck) || !isNumber(deck)) return null;
      const { min, max } = truckRange(deck, config);
      return truck >= min && truck <= max
        ? { level: 'ok', key: 'rules.fits', vars: {} }
        : { level: 'warn', key: 'rules.deck_needs_other_trucks', vars: { truck: formatInch(truck) } };
    },
  },
  {
    id: 'riser-wheelbite',
    target: 'wheels',
    requires: [],
    hint({ specs, config }) {
      const size = specs.wheels?.wheel_size;
      if (!isNumber(size) || size <= config.riserThresholdMm) return null;
      return {
        level: 'info',
        key: 'rules.riser_hint',
        vars: { size: formatMm(size), threshold: formatMm(config.riserThresholdMm) },
        action: { type: 'offer-extra', part: 'riser' },
      };
    },
    check(candidate, { config }) {
      const size = candidate.wheel_size;
      if (!isNumber(size) || size <= config.riserThresholdMm) return null;
      return { level: 'info', key: 'rules.riser_badge', vars: { size: formatMm(size) } };
    },
  },
  {
    id: 'low-truck-wheel',
    target: 'wheels',
    requires: ['trucks'],
    hint({ specs, config }) {
      const height = String(specs.trucks?.truck_height || '').toLowerCase();
      const size = specs.wheels?.wheel_size;
      if (height !== 'low' || !isNumber(size) || size <= config.lowTruckMaxWheelMm) return null;
      return { level: 'warn', key: 'rules.low_truck_wheel', vars: { size: formatMm(size), max: formatMm(config.lowTruckMaxWheelMm) } };
    },
    check(candidate, { specs, config }) {
      const height = String(specs.trucks?.truck_height || '').toLowerCase();
      const size = candidate.wheel_size;
      if (height !== 'low' || !isNumber(size) || size <= config.lowTruckMaxWheelMm) return null;
      return { level: 'warn', key: 'rules.low_truck_wheel_badge', vars: { max: formatMm(config.lowTruckMaxWheelMm) } };
    },
  },
  {
    id: 'hardware-with-riser',
    target: 'hardware',
    requires: ['riser'],
    hint({ specs, config }) {
      const length = specs.hardware?.hardware_length;
      if (!isNumber(length) || length >= config.minHardwareWithRiser) return null;
      return { level: 'warn', key: 'rules.hardware_riser', vars: { length: formatInch(config.minHardwareWithRiser) } };
    },
    check(candidate, { config }) {
      const length = candidate.hardware_length;
      if (!isNumber(length)) return null;
      return length >= config.minHardwareWithRiser
        ? { level: 'ok', key: 'rules.fits', vars: {} }
        : { level: 'warn', key: 'rules.hardware_riser_badge', vars: { length: formatInch(config.minHardwareWithRiser) } };
    },
  },
];

export function mergeConfig(overrides = {}) {
  const merged = { ...CONFIG, truckTolerance: { ...CONFIG.truckTolerance } };
  if (isNumber(overrides.riserThresholdMm)) merged.riserThresholdMm = overrides.riserThresholdMm;
  if (isNumber(overrides.truckTolerance)) merged.truckTolerance = { minus: overrides.truckTolerance, plus: overrides.truckTolerance };
  if (isNumber(overrides.lowTruckMaxWheelMm)) merged.lowTruckMaxWheelMm = overrides.lowTruckMaxWheelMm;
  if (isNumber(overrides.minHardwareWithRiser)) merged.minHardwareWithRiser = overrides.minHardwareWithRiser;
  return merged;
}

const applicable = (rule, target, specs) => rule.target === target && rule.requires.every((part) => specs[part]);

/** Step-level hints for `target` based on the selected parts. */
export function evaluate(target, { specs = {}, config = CONFIG, rules = RULES } = {}) {
  return rules
    .filter((rule) => applicable(rule, target, specs))
    .map((rule) => {
      const result = rule.hint?.({ specs, config });
      return result ? { id: rule.id, ...result } : null;
    })
    .filter(Boolean);
}

/** Per-candidate results; `candidateSpecs` are the resolved specs of the candidate's variant. */
export function checkCandidate(target, candidateSpecs, { specs = {}, config = CONFIG, rules = RULES } = {}) {
  return rules
    .filter((rule) => applicable(rule, target, specs))
    .map((rule) => {
      const result = rule.check?.(candidateSpecs || {}, { specs, config });
      return result ? { id: rule.id, ...result } : null;
    })
    .filter(Boolean);
}

/** Collapses candidate results to the most relevant one: warn > info > ok. */
export function strongest(results) {
  const order = { warn: 3, info: 2, ok: 1 };
  return results.reduce((best, result) => (!best || order[result.level] > order[best.level] ? result : best), null);
}
