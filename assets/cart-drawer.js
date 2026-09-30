/**
 * Cart UI for the drawer and the cart page (@theme/cart-drawer).
 *
 * <cart-items>  Shared controller around a cart line list. Delegated handlers for quantity steppers
 *               (+/−/typing, debounced), remove links, "Build entfernen" (whole build via updateLines) and the
 *               order note. Shows a busy state per line (aria-busy) and errors in its own alert region.
 *               After every cart mutation it swaps [data-cart-content] with the markup of its own section from
 *               detail.sections (fetched through the Section Rendering API when missing) and keeps focus sensible.
 * <cart-drawer> Opens the dialog when something was added elsewhere (shouldOpenDrawer) and syncs the header count.
 *
 * Mutations are sent with { source } = data-source ('cart-drawer' | 'main-cart'), so they never re-open the drawer.
 */
import { announce, debounce, EVENTS, fetchJSON, fetchSection, on, parseHTML, routes, sectionIdOf, strings } from '@theme/utils';
import { closeDialog, openDialog } from '@theme/theme';
import { CART_DRAWER_SECTION, changeLine, shouldOpenDrawer, updateLines } from '@theme/cart';

const STEP_DELAY = 350; // batches rapid +/− clicks into one request
const TYPE_DELAY = 600; // typing in the quantity field
const CHANGE_DELAY = 150; // blur / native change
const NOTE_DELAY = 600;
const RENDERED_EVENT = 'cart-items:rendered';

// One cart request at a time (drawer and cart page share the queue), so responses can never overtake each other.
let queue = Promise.resolve();
function enqueue(task) {
  const run = queue.then(task, task);
  queue = run.catch(() => {});
  return run;
}

class CartItems extends HTMLElement {
  connectedCallback() {
    this.timers = new Map();
    this.saveNote = debounce((textarea) => this.persistNote(textarea), NOTE_DELAY);
    this.addEventListener('click', this.onClick);
    this.addEventListener('input', this.onInput);
    this.addEventListener('change', this.onChange);
    this.addEventListener('keydown', this.onKeydown);
    this.addEventListener('submit', this.onSubmit);
    this.offUpdated = on(EVENTS.cartUpdated, this.onCartUpdated);
    this.offError = on(EVENTS.cartError, this.onCartError);
  }

  disconnectedCallback() {
    this.offUpdated?.();
    this.offError?.();
    this.timers.forEach((timer) => clearTimeout(timer));
    this.timers.clear();
  }

  get source() {
    return this.dataset.source || 'cart';
  }

  get sectionId() {
    return sectionIdOf(this);
  }

  lineOf(element) {
    return element.closest('[data-line-key]');
  }

  // ------------------------------------------------------------------ DOM events

  onClick = (event) => {
    const stepper = event.target.closest('[data-quantity-step]');
    if (stepper && this.contains(stepper)) {
      const line = this.lineOf(stepper);
      if (!line) return;
      this.rememberIntent(stepper);
      this.step(line, Number(stepper.dataset.quantityStep) || 0);
      return;
    }

    const remove = event.target.closest('[data-cart-remove]');
    if (remove && this.contains(remove)) {
      const line = this.lineOf(remove);
      if (!line) return;
      event.preventDefault();
      this.rememberIntent(remove);
      this.commit(line, 0);
    }
  };

  onInput = (event) => {
    const field = event.target;
    if (field.matches('[data-quantity-input]')) {
      const line = this.lineOf(field);
      if (line) this.schedule(line, TYPE_DELAY);
    } else if (field.matches('[data-cart-note]')) {
      this.saveNote(field);
    }
  };

  onChange = (event) => {
    if (!event.target.matches('[data-quantity-input]')) return;
    const line = this.lineOf(event.target);
    if (line) this.schedule(line, CHANGE_DELAY);
  };

  onKeydown = (event) => {
    if (event.key !== 'Enter' || !event.target.matches('[data-quantity-input]')) return;
    // Never let Enter in a quantity field submit the cart form (that would start the checkout).
    event.preventDefault();
    const line = this.lineOf(event.target);
    if (line) this.schedule(line, 0);
  };

  onSubmit = (event) => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement) || !form.matches('[data-build-remove-form]')) return;
    event.preventDefault();
    const group = form.closest('[data-cart-build]');
    if (!group) return;
    if (event.submitter) this.rememberIntent(event.submitter);
    this.removeBuild(group);
  };

  // ------------------------------------------------------------------ Quantity & removal

  step(line, direction) {
    const input = line.querySelector('[data-quantity-input]');
    if (!input || !direction) return;
    const increment = Math.max(1, Number.parseInt(input.step, 10) || 1);
    const max = input.max === '' ? Number.POSITIVE_INFINITY : Number(input.max);
    const typed = Number.parseInt(input.value, 10);
    const base = Number.isNaN(typed) ? Number(line.dataset.quantity) || 0 : typed;
    input.value = String(Math.min(Math.max(base + direction * increment, 0), max));
    this.schedule(line, STEP_DELAY);
  }

  schedule(line, delay) {
    const key = line.dataset.lineKey;
    clearTimeout(this.timers.get(key));
    this.timers.set(
      key,
      setTimeout(() => {
        this.timers.delete(key);
        this.commitInput(line);
      }, delay)
    );
  }

  commitInput(line) {
    const input = line.querySelector('[data-quantity-input]');
    const quantity = Number(input?.value ?? Number.NaN);
    if (!Number.isSafeInteger(quantity) || quantity < 0) {
      this.resetLine(line);
      return;
    }
    this.commit(line, quantity);
  }

  async commit(line, quantity) {
    const key = line.dataset.lineKey;
    clearTimeout(this.timers.get(key));
    this.timers.delete(key);
    if (!key || quantity === Number(line.dataset.quantity)) return;

    this.clearError();
    this.setBusy(line, true);
    try {
      await enqueue(() => changeLine(key, quantity, { source: this.source }));
      announce(quantity === 0 ? this.dataset.msgRemoved : this.dataset.msgUpdated);
    } catch {
      // The message arrives through `cart:error`; restore the last confirmed quantity.
      this.resetLine(line);
    } finally {
      this.setBusy(line, false);
    }
  }

  async removeBuild(group) {
    const keys = Array.from(group.querySelectorAll('[data-line-key]'), (part) => part.dataset.lineKey).filter(Boolean);
    if (!keys.length || group.getAttribute('aria-busy') === 'true') return;

    this.clearError();
    this.setBusy(group, true);
    try {
      await enqueue(() => updateLines(Object.fromEntries(keys.map((key) => [key, 0])), { source: this.source }));
      announce(this.dataset.msgBuildRemoved);
    } catch {
      /* message shown via `cart:error` */
    } finally {
      this.setBusy(group, false);
    }
  }

  resetLine(line) {
    const input = line.querySelector('[data-quantity-input]');
    if (input) input.value = line.dataset.quantity;
  }

  setBusy(element, busy) {
    if (busy) element.setAttribute('aria-busy', 'true');
    else element.removeAttribute('aria-busy');
  }

  // ------------------------------------------------------------------ Order note

  async persistNote(textarea) {
    try {
      await fetchJSON(`${routes.cartUpdate}.js`, { method: 'POST', body: JSON.stringify({ note: textarea.value }) });
      // Keep the other note field (drawer ↔ cart page) in sync, otherwise its stale value would be submitted.
      document.querySelectorAll('[data-cart-note]').forEach((other) => {
        if (other !== textarea) other.value = textarea.value;
      });
    } catch (error) {
      this.showError(error.status ? error.data?.description || strings.cartError : strings.cartError);
    }
  }

  // ------------------------------------------------------------------ Rendering

  onCartUpdated = ({ detail }) => {
    const id = this.sectionId;
    if (!id) return;
    const html = detail?.sections?.[id];
    if (typeof html === 'string' && html) this.render(parseHTML(html));
    else this.refresh(id);
  };

  async refresh(id) {
    try {
      this.render(await fetchSection(window.location.pathname, id));
    } catch {
      /* keep the current markup */
    }
  }

  render(doc) {
    const fresh = doc.querySelector('[data-cart-content]');
    const current = this.querySelector('[data-cart-content]');
    if (!fresh || !current) return;

    const focus = this.captureFocus();
    const scrollTop = this.querySelector('[data-cart-scroll]')?.scrollTop || 0;
    const note = this.querySelector('[data-cart-note]');
    const noteState = note ? { value: note.value, open: Boolean(note.closest('details')?.open) } : null;

    current.replaceChildren(...Array.from(fresh.childNodes, (node) => document.importNode(node, true)));

    const scroller = this.querySelector('[data-cart-scroll]');
    if (scroller) scroller.scrollTop = scrollTop;
    const nextNote = this.querySelector('[data-cart-note]');
    if (nextNote && noteState) {
      nextNote.value = noteState.value;
      if (noteState.open) nextNote.closest('details')?.setAttribute('open', '');
    }
    this.restoreFocus(focus);
    this.dispatchEvent(new CustomEvent(RENDERED_EVENT, { bubbles: true, detail: { doc } }));
  }

  describeControl(element) {
    return {
      key: element.closest('[data-line-key]')?.dataset.lineKey || null,
      build: element.closest('[data-build-id]')?.dataset.buildId || null,
      focusId: element.dataset.focusId || null,
    };
  }

  /** Safari does not focus buttons/links on click – remember the control the user acted on. */
  rememberIntent(control) {
    this.intent = { ...this.describeControl(control), at: Date.now() };
  }

  captureFocus() {
    const active = document.activeElement;
    const intent = this.intent && Date.now() - this.intent.at < 10000 ? this.intent : null;
    this.intent = null;
    if (active instanceof HTMLElement && this.contains(active)) return this.describeControl(active);
    // Focus is nowhere useful (body or the dialog itself): fall back to the control the user clicked.
    if (intent && (!active || active === document.body || active.contains(this))) return intent;
    return null;
  }

  /** Focuses the same control in the fresh markup; falls back to the title when the line is gone. */
  restoreFocus(state) {
    if (!state) return;
    let target = null;
    if (state.focusId) {
      let scope = this;
      if (state.key) scope = this.querySelector(`[data-line-key="${CSS.escape(state.key)}"]`);
      else if (state.build) scope = this.querySelector(`[data-build-id="${CSS.escape(state.build)}"]`);
      target = scope?.querySelector(`[data-focus-id="${CSS.escape(state.focusId)}"]`) || null;
    }
    if (!target && this.dataset.focusFallback) target = document.getElementById(this.dataset.focusFallback);
    target?.focus();
  }

  // ------------------------------------------------------------------ Errors

  onCartError = ({ detail }) => {
    if (detail?.source !== this.source) return;
    // Network failures carry no status – show the friendly generic text instead of "Failed to fetch".
    this.showError(detail.status ? detail.message : strings.cartError);
  };

  showError(message) {
    const region = this.querySelector('[data-cart-error]');
    if (!region) return;
    const box = document.createElement('p');
    box.className = 'form-message form-message--error';
    box.textContent = message || strings.cartError || '';
    region.replaceChildren(box);
  }

  clearError() {
    this.querySelector('[data-cart-error]')?.replaceChildren();
  }
}

class CartDrawer extends HTMLElement {
  connectedCallback() {
    this.dialog = this.querySelector('dialog');
    this.offUpdated = on(EVENTS.cartUpdated, this.onCartUpdated);
    this.addEventListener(RENDERED_EVENT, this.onRendered);
    document.addEventListener('shopify:section:select', this.onSectionSelect);
    document.addEventListener('shopify:section:deselect', this.onSectionDeselect);
  }

  disconnectedCallback() {
    this.offUpdated?.();
    document.removeEventListener('shopify:section:select', this.onSectionSelect);
    document.removeEventListener('shopify:section:deselect', this.onSectionDeselect);
  }

  get sectionId() {
    return this.dataset.sectionId || CART_DRAWER_SECTION;
  }

  open(opener) {
    openDialog(this.dialog, opener);
  }

  close() {
    closeDialog(this.dialog);
  }

  onCartUpdated = ({ detail }) => {
    if (shouldOpenDrawer(detail?.source)) this.open();
  };

  /** The header count lives outside the swapped content – copy it from the same response. */
  onRendered = ({ detail }) => {
    const fresh = detail.doc.querySelector('[data-cart-drawer-count]');
    const current = this.querySelector('[data-cart-drawer-count]');
    if (fresh && current) current.textContent = fresh.textContent;
  };

  onSectionSelect = (event) => {
    if (event.detail?.sectionId === this.sectionId) this.open();
  };

  onSectionDeselect = (event) => {
    if (event.detail?.sectionId === this.sectionId) this.close();
  };
}

if (!customElements.get('cart-items')) customElements.define('cart-items', CartItems);
if (!customElements.get('cart-drawer')) customElements.define('cart-drawer', CartDrawer);
