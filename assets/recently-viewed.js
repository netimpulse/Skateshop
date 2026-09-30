/**
 * Recently viewed products.
 * - Tracking: every product page marks its section with [data-recently-viewed-track="<handle>"]; this module stores the
 *   handle in localStorage (skateshop:recently-viewed:v1) – newest first, unique, max. 12, validated handles only.
 * - <recently-viewed>: loads up to `data-limit` (≤ 8) cards through the alternate template `product.card`
 *   (products/<handle>?view=card), keeps only [data-product-card] from the response (DOMParser) and shows the
 *   section once at least one card was loaded. Unknown products (404) are removed from the history.
 */
import { fetchText, parseHTML, route, storage } from '@theme/utils';

export const STORAGE_KEY = 'skateshop:recently-viewed:v1';
export const HANDLE_PATTERN = /^[a-z0-9][a-z0-9-]{0,99}$/;
export const MAX_STORED = 12;
export const MAX_SHOWN = 8;

/** Reads and sanitises the stored handle list (anything unexpected is dropped). */
export function readHandles() {
  const raw = storage.get(STORAGE_KEY, []);
  if (!Array.isArray(raw)) return [];
  const handles = [];
  for (const value of raw) {
    if (typeof value !== 'string' || !HANDLE_PATTERN.test(value) || handles.includes(value)) continue;
    handles.push(value);
    if (handles.length >= MAX_STORED) break;
  }
  return handles;
}

function writeHandles(handles) {
  storage.set(STORAGE_KEY, handles.slice(0, MAX_STORED));
}

/** Moves the handle to the front of the history. */
export function remember(handle) {
  if (typeof handle !== 'string' || !HANDLE_PATTERN.test(handle)) return;
  writeHandles([handle, ...readHandles().filter((item) => item !== handle)]);
}

export function forget(handle) {
  writeHandles(readHandles().filter((item) => item !== handle));
}

function trackCurrentProduct() {
  document.querySelectorAll('[data-recently-viewed-track]').forEach((element) => remember(element.dataset.recentlyViewedTrack));
}

class RecentlyViewed extends HTMLElement {
  connectedCallback() {
    this.list = this.querySelector('[data-recently-viewed-list]');
    this.section = this.parentElement?.closest('section[data-section-id]');
    if (!this.list || this.loaded) return;
    this.loaded = true;
    this.load();
  }

  get limit() {
    const value = Number.parseInt(this.dataset.limit || '4', 10);
    return Math.min(MAX_SHOWN, Math.max(1, Number.isFinite(value) ? value : 4));
  }

  async load() {
    const current = this.dataset.currentHandle || '';
    const handles = readHandles()
      .filter((handle) => handle !== current)
      .slice(0, this.limit);
    if (!handles.length) return;

    const results = await Promise.allSettled(handles.map((handle) => this.fetchCard(handle)));
    const cards = [];
    results.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value) cards.push(result.value);
      else if (result.status === 'rejected' && result.reason?.status === 404) forget(handles[index]);
    });
    if (!cards.length) return;

    this.list.replaceChildren(
      ...cards.map((card) => {
        const item = document.createElement('li');
        item.className = 'product-related__item';
        item.append(card);
        return item;
      })
    );
    this.querySelector('[data-recently-viewed-note]')?.remove();
    if (this.section) this.section.hidden = false;
    this.querySelector('scroll-slider')?.update?.();
  }

  async fetchCard(handle) {
    const url = new URL(route(`products/${encodeURIComponent(handle)}`), window.location.origin);
    url.searchParams.set('view', 'card');
    // No Accept header: `application/json` would make Shopify ignore the alternate template.
    const html = await fetchText(url.toString());
    const card = parseHTML(html).querySelector('[data-product-card]');
    if (!card) return null;
    const node = document.importNode(card, true);
    if (node.classList.contains('reveal')) node.classList.add('is-revealed');
    node.querySelectorAll('.reveal').forEach((element) => element.classList.add('is-revealed'));
    return node;
  }
}

trackCurrentProduct();

if (!customElements.get('recently-viewed')) customElements.define('recently-viewed', RecentlyViewed);
