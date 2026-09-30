/**
 * Shared helpers for all theme modules.
 * Configuration is read once from <script id="theme-config" type="application/json"> (rendered in layout/theme.liquid).
 */

const readConfig = () => {
  try {
    return JSON.parse(document.getElementById('theme-config')?.textContent || '{}');
  } catch {
    return {};
  }
};

export const config = readConfig();
export const routes = config.routes || { root: '/' };
export const strings = config.strings || {};

/** Absolute storefront path helper that keeps the locale prefix (e.g. /de/). */
export function route(path = '') {
  const root = routes.root || '/';
  return `${root.endsWith('/') ? root : `${root}/`}${String(path).replace(/^\//, '')}`;
}

// ------------------------------------------------------------------ Money

const MONEY_PATTERN = /\{\{\s*(\w+)\s*\}\}/;

function formatWithDelimiters(cents, precision = 2, thousands = ',', decimal = '.') {
  const number = (Number(cents) / 100).toFixed(precision);
  const [whole, fraction] = number.split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, thousands);
  return fraction ? `${grouped}${decimal}${fraction}` : grouped;
}

/** Formats cents with Shopify's money_format (e.g. "€{{amount_with_comma_separator}}"). Returns plain text. */
export function formatMoney(cents, format) {
  const template = format || (config.showCurrencyCode ? config.moneyWithCurrencyFormat : config.moneyFormat) || '{{amount}}';
  const match = template.match(MONEY_PATTERN);
  if (!match) return String(cents / 100);
  const value = {
    amount: formatWithDelimiters(cents, 2),
    amount_no_decimals: formatWithDelimiters(cents, 0),
    amount_with_comma_separator: formatWithDelimiters(cents, 2, '.', ','),
    amount_no_decimals_with_comma_separator: formatWithDelimiters(cents, 0, '.', ','),
    amount_with_apostrophe_separator: formatWithDelimiters(cents, 2, "'", '.'),
    amount_with_space_separator: formatWithDelimiters(cents, 2, ' ', ','),
    amount_no_decimals_with_space_separator: formatWithDelimiters(cents, 0, ' ', ','),
    amount_with_period_and_space_separator: formatWithDelimiters(cents, 2, ' ', '.'),
  }[match[1]] ?? formatWithDelimiters(cents, 2);
  return template.replace(MONEY_PATTERN, value);
}

// ------------------------------------------------------------------ Events

export const EVENTS = {
  cartUpdated: 'cart:updated',
  cartError: 'cart:error',
  variantChanged: 'variant:changed',
};

export function emit(name, detail = {}) {
  document.dispatchEvent(new CustomEvent(name, { detail }));
}

export function on(name, handler, options) {
  document.addEventListener(name, handler, options);
  return () => document.removeEventListener(name, handler, options);
}

// ------------------------------------------------------------------ DOM & text

const ESCAPE_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export function escapeHTML(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ESCAPE_MAP[char]);
}

/** Replaces [placeholder] tokens in translated strings. Values are inserted as text by the caller. */
export function interpolate(template, values = {}) {
  return String(template ?? '').replace(/\[(\w+)\]/g, (_, key) => (key in values ? String(values[key]) : `[${key}]`));
}

export function debounce(fn, wait = 250) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
}

export function announce(message) {
  const region = document.getElementById('live-region');
  if (!region) return;
  region.textContent = '';
  window.requestAnimationFrame(() => {
    region.textContent = message;
  });
}

export const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Parses an HTML string and returns the element with the given id (or selector) – never inserts raw strings. */
export function parseHTML(html) {
  return new DOMParser().parseFromString(html, 'text/html');
}

export function pick(documentOrHtml, selector) {
  const doc = typeof documentOrHtml === 'string' ? parseHTML(documentOrHtml) : documentOrHtml;
  return doc.querySelector(selector);
}

/** Replaces `target`'s children with the children of the element matching `selector` in `source` HTML. */
export function replaceContent(target, html, selector) {
  const next = pick(html, selector);
  if (!target || !next) return false;
  target.replaceChildren(...Array.from(next.childNodes).map((node) => document.importNode(node, true)));
  return true;
}

// ------------------------------------------------------------------ Fetch

export function isSameOrigin(url) {
  try {
    return new URL(url, window.location.origin).origin === window.location.origin;
  } catch {
    return false;
  }
}

export async function fetchJSON(url, options = {}) {
  if (!isSameOrigin(url)) throw new Error('Cross-origin request blocked');
  const response = await fetch(url, {
    ...options,
    headers: { Accept: 'application/json', 'Content-Type': 'application/json', ...(options.headers || {}) },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.description || data.message || response.statusText);
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data;
}

export async function fetchText(url, options = {}) {
  if (!isSameOrigin(url)) throw new Error('Cross-origin request blocked');
  const response = await fetch(url, options);
  if (!response.ok) {
    const error = new Error(response.statusText);
    error.status = response.status;
    throw error;
  }
  return response.text();
}

/** Fetches a single section via the Section Rendering API and returns its parsed document. */
export async function fetchSection(url, sectionId, options = {}) {
  const target = new URL(url, window.location.origin);
  target.searchParams.set('section_id', sectionId);
  return parseHTML(await fetchText(target.toString(), options));
}

/** Section IDs of group/template sections are generated – read them from the DOM. */
export function sectionIdOf(element) {
  return element?.closest('[data-section-id]')?.dataset.sectionId || null;
}

// ------------------------------------------------------------------ Storage

export const storage = {
  get(key, fallback = null) {
    try {
      const raw = window.localStorage.getItem(key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch {
      return fallback;
    }
  },
  raw(key) {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key, value) {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  },
  remove(key) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      /* storage unavailable */
    }
  },
};
