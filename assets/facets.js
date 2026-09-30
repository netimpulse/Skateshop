/**
 * <facet-filters data-section-id="…"> – storefront filtering, sorting and pagination without full reloads
 * (collection and search pages, markup in snippets/facet-layout.liquid).
 *
 * - Checkbox and sort changes apply immediately, price fields are debounced, form submit (Enter) is intercepted.
 * - The URL is built from the form's FormData (empty values dropped) – parameter names/values come from Liquid,
 *   nothing is assembled by hand. Chips, "clear all", reset and pagination links are intercepted by delegation.
 * - The section is re-rendered via the Section Rendering API; only the named [data-facets-part] containers are
 *   swapped (DOMParser, no raw HTML strings). history.pushState + popstate keep Back/Forward working.
 * - Focus stays on the control that triggered the update (same id after the swap) and the result count is announced.
 * Without JavaScript the forms submit as plain GET requests.
 */
import { announce, debounce, fetchSection, isSameOrigin, prefersReducedMotion } from '@theme/utils';

const PART = 'data-facets-part';
const PRICE_DELAY = 650;
const CACHE_LIMIT = 16;

class FacetFilters extends HTMLElement {
  connectedCallback() {
    this.sectionId = this.dataset.sectionId;
    if (!this.sectionId) return;

    this.cache = new Map();
    this.controller = null;
    this.applyPrice = debounce((form) => this.applyForm(form), PRICE_DELAY);

    this.addEventListener('change', this.onChange);
    this.addEventListener('input', this.onInput);
    this.addEventListener('submit', this.onSubmit);
    this.addEventListener('click', this.onClick);
    window.addEventListener('popstate', this.onPopState);

    // Mark the entry we started on, so Back from a filtered state re-renders it via popstate.
    const state = window.history.state;
    if (!state?.facets) {
      const base = state && typeof state === 'object' ? state : {};
      window.history.replaceState({ ...base, facets: true }, '', window.location.href);
    }
  }

  disconnectedCallback() {
    window.removeEventListener('popstate', this.onPopState);
    this.controller?.abort();
  }

  // ---------------------------------------------------------------- Events

  onChange = (event) => {
    const field = event.target;
    const form = field?.form;
    if (!form || !form.matches('[data-facets-form]')) return;
    if (field.matches('[data-facets-price]')) {
      this.applyPrice(form);
      return;
    }
    this.applyForm(form);
  };

  onInput = (event) => {
    const field = event.target;
    if (field instanceof HTMLInputElement && field.matches('[data-facets-price]') && field.form) {
      this.applyPrice(field.form);
    }
  };

  onSubmit = (event) => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement) || !form.matches('[data-facets-form]')) return;
    event.preventDefault();
    this.applyForm(form);
  };

  onClick = (event) => {
    if (event.defaultPrevented || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

    const link = event.target.closest('a[href]');
    if (!link || !this.contains(link)) return;
    const inPagination = Boolean(link.closest(`[${PART}="pagination"]`));
    if (!inPagination && !link.hasAttribute('data-facets-link')) return;
    if (!isSameOrigin(link.href)) return;

    event.preventDefault();
    const target = new URL(link.href, window.location.origin);
    this.render(`${target.pathname}${target.search}`, { scroll: inPagination });
  };

  onPopState = (event) => {
    if (!event.state?.facets) return;
    this.render(`${window.location.pathname}${window.location.search}`, { push: false });
  };

  // ---------------------------------------------------------------- URL from form

  applyForm(form) {
    const params = new URLSearchParams();
    for (const [key, value] of new FormData(form)) {
      if (typeof value !== 'string' || key === 'page') continue;
      const trimmed = value.trim();
      if (trimmed) params.append(key, trimmed);
    }

    // The sort select lives in the toolbar and wins over any hidden sort_by of the drawer form.
    const sort = this.querySelector('[data-facets-sort]');
    if (sort) {
      params.delete('sort_by');
      if (sort.value) params.set('sort_by', sort.value);
    }

    const action = new URL(form.getAttribute('action') || window.location.pathname, window.location.origin);
    const query = params.toString();
    this.render(`${action.pathname}${query ? `?${query}` : ''}`);
  }

  // ---------------------------------------------------------------- Rendering

  async render(url, { push = true, scroll = false } = {}) {
    if (push && url === `${window.location.pathname}${window.location.search}`) return;

    this.controller?.abort();
    const controller = new AbortController();
    this.controller = controller;
    this.setBusy(true);

    try {
      let doc = this.cache.get(url);
      if (!doc) {
        doc = await fetchSection(url, this.sectionId, { signal: controller.signal });
        this.remember(url, doc);
      }
      if (controller.signal.aborted) return;

      const incoming = doc.querySelector('facet-filters');
      if (!incoming) throw new Error('facets: response without <facet-filters>');

      const focus = this.captureFocus();
      const openGroups = this.captureDetails();
      this.swap(incoming);
      this.restoreDetails(openGroups);
      if (push) window.history.pushState({ facets: true }, '', url);
      this.revealNewCards();
      this.restoreFocus(focus, scroll);
      if (scroll) this.scrollToResults();

      const count = this.querySelector(`[${PART}="count"]`)?.textContent.trim();
      if (count) announce(count);
      this.dispatchEvent(new CustomEvent('facets:updated', { bubbles: true, detail: { url } }));
    } catch (error) {
      if (error?.name === 'AbortError') return;
      // Section Rendering failed – fall back to a normal page load of the same URL.
      window.location.assign(url);
    } finally {
      if (this.controller === controller) {
        this.controller = null;
        this.setBusy(false);
      }
    }
  }

  remember(url, doc) {
    this.cache.set(url, doc);
    if (this.cache.size > CACHE_LIMIT) this.cache.delete(this.cache.keys().next().value);
  }

  /** Replaces the children of every named part with the matching part of the fetched section. */
  swap(incoming) {
    this.querySelectorAll(`[${PART}]`).forEach((part) => {
      const name = part.getAttribute(PART);
      const next = incoming.querySelector(`[${PART}="${name}"]`);
      if (!next) {
        part.replaceChildren();
        return;
      }
      part.replaceChildren(...Array.from(next.childNodes, (node) => document.importNode(node, true)));
    });
  }

  setBusy(busy) {
    const results = this.querySelector(`[${PART}="results"]`);
    if (busy) {
      this.setAttribute('aria-busy', 'true');
      results?.setAttribute('aria-busy', 'true');
    } else {
      this.removeAttribute('aria-busy');
      results?.removeAttribute('aria-busy');
    }
  }

  // ---------------------------------------------------------------- Focus & state

  captureFocus() {
    const active = document.activeElement;
    if (!active || active === document.body || !this.contains(active)) return null;
    const typing = active instanceof HTMLInputElement && active.matches('[data-facets-price]');
    return { id: active.id || null, dialog: active.closest('dialog[open]'), value: typing ? active.value : null };
  }

  restoreFocus(state, toResults = false) {
    if (!state && !toResults) return;
    const same = state?.id ? document.getElementById(state.id) : null;
    if (same && !toResults) {
      if (document.activeElement !== same) same.focus({ preventScroll: true });
      // Keep what the shopper is typing into a price field (a newer debounced update follows) and put the caret at the end.
      if (state.value !== null && same instanceof HTMLInputElement) {
        same.value = '';
        same.value = state.value;
      }
      return;
    }
    const fallback = state?.dialog?.open
      ? state.dialog.querySelector('[data-dialog-close]')
      : this.querySelector('[data-facets-focus]');
    fallback?.focus({ preventScroll: true });
  }

  captureDetails() {
    const state = new Map();
    this.querySelectorAll('details[data-facets-details]').forEach((details) => {
      state.set(details.dataset.facetsDetails, details.open);
    });
    return state;
  }

  restoreDetails(state) {
    this.querySelectorAll('details[data-facets-details]').forEach((details) => {
      const key = details.dataset.facetsDetails;
      if (state.has(key)) details.open = state.get(key);
    });
  }

  /** Swapped-in cards carry .reveal – show them (the global observer only runs on page load). */
  revealNewCards() {
    const cards = this.querySelectorAll('.reveal:not(.is-revealed)');
    if (!cards.length) return;
    const show = () => cards.forEach((card) => card.classList.add('is-revealed'));
    if (prefersReducedMotion()) {
      show();
      return;
    }
    requestAnimationFrame(() => requestAnimationFrame(show));
  }

  scrollToResults() {
    const top = this.querySelector('.facets__main') || this;
    top.scrollIntoView({ block: 'start', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
  }
}

if (!customElements.get('facet-filters')) customElements.define('facet-filters', FacetFilters);
