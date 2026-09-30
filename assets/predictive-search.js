/**
 * <predictive-search>: live results while typing (header search dialog, reusable elsewhere).
 * - Debounce 250 ms, AbortController cancels outdated requests, small in-memory cache per term.
 * - Fetches sections/predictive-search.liquid via Section Rendering and keeps only [data-predictive-content]
 *   (parsed with DOMParser, never string-injected).
 * - Arrow keys move focus across the result links, Enter on the input submits to the search page.
 * - 417 (unsupported locale) / 429 (rate limit) / network errors → message + link to the full search page.
 * Expected markup: form > input[name="q"], [data-predictive-results], [data-predictive-status],
 * optional [data-predictive-empty], [data-predictive-clear], [data-predictive-spinner], [data-predictive-config].
 */
import { debounce, interpolate, parseHTML, routes } from '@theme/utils';

const SECTION_ID = 'predictive-search';
const RESOURCE_TYPES = 'product,collection,query,page';
const RESULT_LIMIT = '6';
const NAV_KEYS = new Set(['ArrowDown', 'ArrowUp', 'Home', 'End']);
const CACHE_LIMIT = 30;

function searchPageUrl(term) {
  const url = new URL(routes.search || routes.root || '/', window.location.origin);
  url.searchParams.set('q', term);
  url.searchParams.set('options[prefix]', 'last');
  return `${url.pathname}${url.search}`;
}

function suggestUrl(term) {
  const url = new URL(routes.predictiveSearch, window.location.origin);
  url.searchParams.set('q', term);
  url.searchParams.set('resources[type]', RESOURCE_TYPES);
  url.searchParams.set('resources[limit]', RESULT_LIMIT);
  url.searchParams.set('resources[limit_scope]', 'each');
  url.searchParams.set('section_id', SECTION_ID);
  return url.toString();
}

class PredictiveSearch extends HTMLElement {
  connectedCallback() {
    this.input = this.querySelector('input[name="q"]');
    this.results = this.querySelector('[data-predictive-results]');
    this.status = this.querySelector('[data-predictive-status]');
    this.empty = this.querySelector('[data-predictive-empty]');
    this.clearButton = this.querySelector('[data-predictive-clear]');
    this.spinner = this.querySelector('[data-predictive-spinner]');
    if (!this.input || !this.results || !routes.predictiveSearch) return;

    this.strings = this.readStrings();
    this.cache = new Map();
    this.controller = null;
    this.lastTerm = '';
    this.debouncedSearch = debounce(() => this.search(), 250);

    this.input.addEventListener('input', this.onInput);
    this.addEventListener('keydown', this.onKeydown);
    this.clearButton?.addEventListener('click', this.onClear);
    this.dialog = this.closest('dialog');
    this.dialog?.addEventListener('close', this.onDialogClose);

    // Restore state when the field is pre-filled (e.g. on the search page or after back navigation).
    this.syncControls();
  }

  disconnectedCallback() {
    this.controller?.abort();
    this.input?.removeEventListener('input', this.onInput);
    this.removeEventListener('keydown', this.onKeydown);
    this.clearButton?.removeEventListener('click', this.onClear);
    this.dialog?.removeEventListener('close', this.onDialogClose);
  }

  readStrings() {
    try {
      return JSON.parse(this.querySelector('[data-predictive-config]')?.textContent || '{}').strings || {};
    } catch {
      return {};
    }
  }

  get term() {
    return this.input.value.trim();
  }

  onInput = () => {
    this.syncControls();
    if (!this.term) {
      this.controller?.abort();
      this.reset();
      return;
    }
    this.debouncedSearch();
  };

  onClear = () => {
    this.input.value = '';
    this.controller?.abort();
    this.reset();
    this.syncControls();
    this.input.focus();
  };

  onDialogClose = () => {
    this.controller?.abort();
    this.setLoading(false);
  };

  syncControls() {
    const hasTerm = Boolean(this.term);
    if (this.clearButton) this.clearButton.hidden = !hasTerm;
    if (this.empty) this.empty.hidden = hasTerm;
  }

  async search() {
    const term = this.term;
    if (!term) return;
    if (term === this.lastTerm && !this.results.hidden) return;

    if (this.cache.has(term)) {
      this.render(this.cache.get(term), term);
      return;
    }

    this.controller?.abort();
    const controller = new AbortController();
    this.controller = controller;
    this.setLoading(true);

    try {
      const response = await fetch(suggestUrl(term), { signal: controller.signal, headers: { Accept: 'text/html' } });
      if (response.status === 417 || response.status === 429) {
        this.renderMessage(response.status === 429 ? this.strings.rateLimited : this.strings.unavailable, term);
        return;
      }
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const content = parseHTML(await response.text()).querySelector('[data-predictive-content]');
      if (!content) throw new Error('Missing predictive search content');
      this.remember(term, content);
      if (term === this.term) this.render(content, term);
    } catch (error) {
      if (error.name === 'AbortError') return;
      if (term === this.term) this.renderMessage(this.strings.unavailable, term);
    } finally {
      if (this.controller === controller) {
        this.controller = null;
        this.setLoading(false);
      }
    }
  }

  remember(term, content) {
    if (this.cache.size >= CACHE_LIMIT) this.cache.delete(this.cache.keys().next().value);
    this.cache.set(term, content);
  }

  render(content, term) {
    this.lastTerm = term;
    this.results.replaceChildren(document.importNode(content, true));
    this.results.hidden = false;
    if (this.empty) this.empty.hidden = true;

    const count = Number.parseInt(content.dataset.resultCount || '0', 10) || 0;
    let message = this.strings.statusNone || '';
    if (count === 1) message = this.strings.statusOne || '';
    else if (count > 1) message = interpolate(this.strings.statusOther || '', { count });
    this.announce(message);
  }

  renderMessage(message, term) {
    this.lastTerm = '';
    const wrapper = document.createElement('div');
    wrapper.className = 'predictive-search__message';
    const text = document.createElement('p');
    text.textContent = message || '';
    const link = document.createElement('a');
    link.className = 'link-mono';
    link.href = searchPageUrl(term);
    link.dataset.predictiveLink = '';
    link.textContent = this.strings.searchPage || term;
    wrapper.append(text, link);

    this.results.replaceChildren(wrapper);
    this.results.hidden = false;
    this.announce(message || '');
  }

  reset() {
    this.lastTerm = '';
    this.results.replaceChildren();
    this.results.hidden = true;
    this.setLoading(false);
    this.announce('');
    this.syncControls();
  }

  setLoading(loading) {
    this.classList.toggle('is-loading', loading);
    this.results.setAttribute('aria-busy', String(loading));
    if (this.spinner) this.spinner.hidden = !loading;
  }

  announce(message) {
    if (!this.status) return;
    this.status.textContent = message;
  }

  get links() {
    if (this.results.hidden) return [];
    return Array.from(this.results.querySelectorAll('[data-predictive-link]')).filter((link) => link.getClientRects().length > 0);
  }

  onKeydown = (event) => {
    if (event.key === 'Escape' && !this.dialog && this.term) {
      // Outside a dialog Escape clears the results; inside one the native dialog closes itself.
      event.preventDefault();
      this.onClear();
      return;
    }
    if (!NAV_KEYS.has(event.key) || event.altKey || event.ctrlKey || event.metaKey) return;

    const links = this.links;
    if (!links.length) return;
    const fromInput = document.activeElement === this.input;
    // Home/End keep their caret meaning inside the text field.
    if (fromInput && (event.key === 'Home' || event.key === 'End')) return;

    const index = links.indexOf(document.activeElement);
    if (!fromInput && index === -1) return;
    event.preventDefault();

    if (event.key === 'ArrowUp' && index <= 0) {
      this.input.focus();
      return;
    }
    let next = 0;
    if (event.key === 'ArrowDown') next = fromInput ? 0 : Math.min(index + 1, links.length - 1);
    else if (event.key === 'ArrowUp') next = index - 1;
    else if (event.key === 'End') next = links.length - 1;
    links[next].focus();
  };
}

if (!customElements.get('predictive-search')) customElements.define('predictive-search', PredictiveSearch);
