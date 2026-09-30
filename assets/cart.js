/**
 * Cart core API (Ajax Cart + Section Rendering) and the <product-form> element.
 * Every mutation emits `cart:updated` with the rendered sections so UI parts can refresh themselves.
 * The drawer UI lives in cart-drawer.js; this file is the shared foundation (PDP, quick add, builder).
 */
import { announce, config, emit, EVENTS, fetchJSON, on, parseHTML, routes, strings } from '@theme/utils';

export const CART_DRAWER_SECTION = 'cart-drawer';
export const CART_COUNT_SECTION = 'cart-count';
const MAX_SECTIONS = 5;

/** Static sections plus any main-cart section present on the page (ids are read from the DOM). */
export function sectionsToRender() {
  const ids = new Set([CART_DRAWER_SECTION, CART_COUNT_SECTION]);
  document.querySelectorAll('[data-cart-section][data-section-id]').forEach((element) => ids.add(element.dataset.sectionId));
  return Array.from(ids).slice(0, MAX_SECTIONS);
}

export function getCart() {
  return fetchJSON(`${routes.cart}.js`);
}

async function mutate(endpoint, body, source) {
  const sections = sectionsToRender();
  try {
    const response = await fetchJSON(`${endpoint}.js`, {
      method: 'POST',
      body: JSON.stringify({ ...body, sections, sections_url: window.location.pathname }),
    });
    const cart = Array.isArray(response.items) && 'item_count' in response ? response : null;
    emit(EVENTS.cartUpdated, { source, cart, response, sections: response.sections || {} });
    return response;
  } catch (error) {
    const message = error.data?.description || error.message || strings.cartError;
    emit(EVENTS.cartError, { source, message, status: error.status });
    throw Object.assign(error, { userMessage: message });
  }
}

/** Adds one or more items in a single request. items: [{ id, quantity, properties }] */
export function addItems(items, { source = 'product-form' } = {}) {
  return mutate(routes.cartAdd, { items }, source);
}

/** Changes a single line by its line-item key. */
export function changeLine(key, quantity, { source = 'cart' } = {}) {
  return mutate(routes.cartChange, { id: key, quantity }, source);
}

/** Updates several lines at once: { [lineKey]: quantity }. */
export function updateLines(updates, { source = 'cart' } = {}) {
  return mutate(routes.cartUpdate, { updates }, source);
}

export function shouldOpenDrawer(source) {
  return config.cartType === 'drawer' && !['cart-drawer', 'main-cart'].includes(source);
}

// ------------------------------------------------------------------ Cart count badges

on(EVENTS.cartUpdated, ({ detail }) => {
  const html = detail.sections?.[CART_COUNT_SECTION];
  if (!html) return;
  const fresh = parseHTML(html).querySelector('[data-cart-count]');
  if (!fresh) return;
  document.querySelectorAll('[data-cart-count]').forEach((badge) => badge.replaceWith(document.importNode(fresh, true)));
});

// ------------------------------------------------------------------ <product-form>

class ProductForm extends HTMLElement {
  connectedCallback() {
    this.form = this.querySelector('form');
    this.submitButton = this.form?.querySelector('[type="submit"]');
    this.error = this.querySelector('[data-form-error]');
    this.form?.addEventListener('submit', this.onSubmit);
  }

  disconnectedCallback() {
    this.form?.removeEventListener('submit', this.onSubmit);
  }

  onSubmit = async (event) => {
    event.preventDefault();
    if (this.querySelector('[aria-busy="true"]')) return;
    this.lastSubmitter = event.submitter?.form === this.form ? event.submitter : null;

    const submitter = event.submitter?.form === this.form ? event.submitter : null;
    const data = new FormData(this.form);
    if (submitter?.name && !submitter.disabled) data.set(submitter.name, submitter.value);
    const id = Number(data.get('id'));
    if (!Number.isSafeInteger(id) || id <= 0) return;
    const quantity = Math.max(1, Number.parseInt(data.get('quantity') || '1', 10) || 1);
    const properties = {};
    for (const [key, value] of data.entries()) {
      const match = key.match(/^properties\[(.+)\]$/);
      if (match && typeof value === 'string' && value.trim() !== '') properties[match[1]] = value;
    }

    this.setBusy(true);
    this.showError('');
    try {
      await addItems([{ id, quantity, properties }], { source: this.dataset.source || 'product-form' });
      announce(strings.cartAdded);
      this.querySelector('details[open]')?.removeAttribute('open');
      if (config.cartType === 'page' || !document.querySelector('cart-drawer')) {
        window.location.assign(routes.cart);
      }
    } catch (error) {
      this.showError(error.userMessage || strings.cartError);
    } finally {
      this.setBusy(false);
    }
  };

  setBusy(busy) {
    this.busyButton = busy ? this.lastSubmitter || this.submitButton : this.busyButton;
    this.busyButton?.setAttribute('aria-busy', String(busy));
  }

  showError(message) {
    if (!this.error) return;
    const text = this.error.querySelector('[data-form-error-text]') || this.error;
    text.textContent = message;
    this.error.hidden = !message;
  }
}

if (!customElements.get('product-form')) customElements.define('product-form', ProductForm);
