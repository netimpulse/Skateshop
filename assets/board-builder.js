/**
 * <board-builder>: step controller of the skateboard builder.
 * Steps come from the section's blocks (see sections/board-builder.liquid). Data per step is loaded lazily from
 * {collection.url}?view=builder-data, selections persist in localStorage (validated), compatibility rules come
 * from board-builder-rules.js. List rendering: board-builder-list.js, summary + cart: board-builder-summary.js.
 */
import { announce, formatMoney, interpolate, prefersReducedMotion } from '@theme/utils';
import { loadCollection, previewColor, resolveSpecs } from '@theme/board-builder-data';
import { emptyState, load, reset, save } from '@theme/board-builder-state';
import { checkCandidate, evaluate, mergeConfig } from '@theme/board-builder-rules';
import { BuilderList } from '@theme/board-builder-list';
import { BuilderSummary } from '@theme/board-builder-summary';
import '@theme/board-builder-preview';

const PARTS = ['deck', 'trucks', 'wheels', 'bearings', 'griptape', 'hardware'];
const SAFE_PATH = /^\/[^\s]*$/;

function readConfig(element) {
  try {
    return JSON.parse(element.querySelector('[data-builder-config]')?.textContent || '{}');
  } catch {
    return {};
  }
}

const safeStorage = () => {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
};

class BoardBuilder extends HTMLElement {
  connectedCallback() {
    const cfg = readConfig(this);
    this.sectionId = cfg.sectionId || '';
    this.strings = cfg.strings || {};
    this.availableOnly = cfg.defaultAvailableOnly !== false;
    this.rulesConfig = mergeConfig(cfg.rules || {});
    this.riserUrl = cfg.riser?.url && SAFE_PATH.test(cfg.riser.url) ? cfg.riser.url : null;

    const seen = new Set();
    this.steps = (Array.isArray(cfg.steps) ? cfg.steps : []).filter((step) => {
      if (!PARTS.includes(step.part) || seen.has(step.part) || !SAFE_PATH.test(step.url || '')) return false;
      seen.add(step.part);
      return true;
    });
    this.stepKeys = this.steps.map((step) => step.part);
    if (!this.steps.length) return;

    this.data = new Map();
    this.loading = new Map();
    this.selection = new Map();
    this.removedParts = [];
    this.restoring = false;
    this.storage = safeStorage();
    this.state = load(this.storage, { stepKeys: this.stepKeys }) || emptyState(this.stepKeys[0]);

    this.panel = this.querySelector('[data-bb-panel]');
    this.summaryEl = this.querySelector('[data-bb-summary]');
    this.preview = this.querySelector('board-preview');
    this.legend = this.querySelector('[data-bb-legend]');
    this.totalEl = this.querySelector('[data-bb-total]');
    this.prevButton = this.querySelector('[data-bb-prev]');
    this.nextButton = this.querySelector('[data-bb-next]');
    this.nextLabel = this.querySelector('[data-bb-next-label]');
    this.dots = this.querySelector('[data-bb-dots]');

    this.list = new BuilderList(this);
    this.summary = new BuilderSummary(this);

    this.addEventListener('click', this.onClick);
    this.closest('.bb')?.querySelector('[data-bb-reset]')?.addEventListener('click', () => this.resetBuild());
    this.prevButton?.addEventListener('click', () => this.step(-1));
    this.nextButton?.addEventListener('click', () => this.step(1));

    const params = new URLSearchParams(window.location.search);
    const requestedStep = params.get('step');
    if (requestedStep && [...this.stepKeys, 'summary'].includes(requestedStep)) this.state.step = requestedStep;

    this.goTo(this.state.step, { focus: false, scroll: false });
    this.restore(params.get('deck'));
  }

  // ------------------------------------------------------------------------------ Data

  urlFor(part) {
    if (part === 'riser') return this.riserUrl;
    return this.steps.find((step) => step.part === part)?.url || null;
  }

  /** No `Accept: application/json` header: Shopify would answer with its native collection JSON instead of the view. */
  async fetchJSON(url) {
    const response = await fetch(url, { credentials: 'same-origin' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  }

  ensureData(part) {
    if (this.data.has(part)) return Promise.resolve(this.data.get(part));
    if (this.loading.has(part)) return this.loading.get(part);
    const url = this.urlFor(part);
    if (!url) return Promise.resolve([]);
    const promise = loadCollection(url, (target) => this.fetchJSON(target), { origin: window.location.origin })
      .then((products) => {
        this.data.set(part, products);
        this.loading.delete(part);
        this.rehydrate(part, products);
        return products;
      })
      .catch((error) => {
        this.loading.delete(part);
        throw error;
      });
    this.loading.set(part, promise);
    return promise;
  }

  /**
   * Applies a stored selection to freshly loaded data. Runs on every successful load, so a part whose
   * collection failed earlier (throttling, network) comes back after a retry or step change. A part is only
   * dropped on a conclusive result (product gone or variant sold out) and never once the user picked
   * something for it in this visit (then `selection` already has the part).
   */
  rehydrate(part, products) {
    const stored = this.state.sel?.[part];
    if (!stored || this.selection.has(part)) return;
    const product = products.find((item) => item.id === stored.p);
    const variant = product?.variants.find((item) => item.id === stored.v);
    if (product && variant?.available) {
      this.selection.set(part, { product, variant });
    } else {
      delete this.state.sel[part];
      this.removedParts.push(part);
    }
    if (!this.restoring) this.flushRehydrated();
  }

  flushRehydrated() {
    this.persist();
    this.refresh();
    if (!this.removedParts.length) return;
    announce(this.removedParts.map((part) => interpolate(this.strings.partUnavailable, { part: this.partLabel(part) })).join(' '));
    this.removedParts = [];
  }

  /**
   * Loads the collections of all stored parts one after another (storefront rate limits); `rehydrate` does
   * the matching. Load errors keep the stored choice.
   */
  async restore(deckHandle) {
    this.restoring = true;
    for (const part of Object.keys({ ...(this.state.sel || {}) })) {
      try {
        // eslint-disable-next-line no-await-in-loop
        await this.ensureData(part);
      } catch {
        /* kept in state.sel – rehydrated on a later successful load */
      }
    }

    if (deckHandle && /^[a-z0-9][a-z0-9-]{0,99}$/.test(deckHandle) && this.stepKeys.includes('deck')) {
      const decks = await this.ensureData('deck').catch(() => []);
      const product = decks.find((item) => item.handle === deckHandle);
      const variant = product?.variants.find((item) => item.available);
      if (product && variant) this.select('deck', product, variant, { silent: true });
    }

    this.restoring = false;
    this.flushRehydrated();
    const current = this.steps.find((step) => step.part === this.state.step);
    if (current) this.list.render(current);
    this.prefetchNext();
  }

  prefetchNext() {
    const index = this.stepKeys.indexOf(this.state.step);
    const next = this.stepKeys[index + 1];
    if (!next) return;
    const idle = window.requestIdleCallback || ((callback) => setTimeout(callback, 400));
    idle(() => this.ensureData(next).catch(() => {}));
  }

  // ------------------------------------------------------------------------------ Selection

  select(part, product, variant, { silent = false } = {}) {
    this.selection.set(part, { product, variant });
    this.state.sel[part] = { p: product.id, v: variant.id, h: product.handle };
    this.persist();
    this.preview?.highlight?.(part);
    this.refresh();
    if (!silent) {
      const title = variant.title && variant.title !== 'Default Title' ? `${product.title} – ${variant.title}` : product.title;
      announce(interpolate(this.strings.chosen, { part: this.partLabel(part), title }));
    }
  }

  deselect(part) {
    this.selection.delete(part);
    delete this.state.sel[part];
    this.persist();
    this.refresh();
  }

  persist() {
    save(this.storage, this.state);
  }

  selectedSpecs(part) {
    const entry = this.selection.get(part);
    return entry ? resolveSpecs(entry.product, entry.variant) : null;
  }

  ruleContext() {
    const specs = {};
    for (const [part, entry] of this.selection) specs[part] = resolveSpecs(entry.product, entry.variant);
    return { specs, config: this.rulesConfig };
  }

  hintsFor(part) {
    return evaluate(part, this.ruleContext());
  }

  allHints() {
    const context = this.ruleContext();
    const parts = [...this.stepKeys, 'riser'];
    const hints = parts.flatMap((part) => evaluate(part, context).filter((hint) => hint.level !== 'info' || hint.action));
    // Warn when a selected part itself fails its own rule (e.g. trucks chosen before the deck changed).
    for (const [part, entry] of this.selection) {
      checkCandidate(part, resolveSpecs(entry.product, entry.variant), context)
        .filter((result) => result.level === 'warn')
        .forEach((result) => hints.push({ ...result, part }));
    }
    const seen = new Set();
    return hints.filter((hint) => {
      const key = `${hint.key}|${JSON.stringify(hint.vars)}`;
      return seen.has(key) ? false : seen.add(key);
    });
  }

  message(result) {
    const key = String(result.key || '').replace(/^rules\./, '');
    return interpolate(this.strings.rules?.[key] || key, result.vars || {});
  }

  partLabel(part) {
    return this.strings.parts?.[part] || part;
  }

  total() {
    let sum = 0;
    for (const { variant } of this.selection.values()) sum += variant.price;
    return sum;
  }

  // ------------------------------------------------------------------------------ Navigation

  currentIndex() {
    return this.state.step === 'summary' ? this.stepKeys.length : this.stepKeys.indexOf(this.state.step);
  }

  step(direction) {
    const order = [...this.stepKeys, 'summary'];
    const index = Math.min(Math.max(this.currentIndex() + direction, 0), order.length - 1);
    this.goTo(order[index]);
  }

  goTo(key, { focus = true, scroll = true } = {}) {
    const target = [...this.stepKeys, 'summary'].includes(key) ? key : this.stepKeys[0];
    this.state.step = target;
    this.persist();

    const isSummary = target === 'summary';
    this.panel.hidden = isSummary;
    this.summaryEl.hidden = !isSummary;
    this.dataset.step = target;

    if (isSummary) {
      this.summary.render(null);
    } else {
      const step = this.steps.find((item) => item.part === target);
      const index = this.stepKeys.indexOf(target);
      this.querySelector('[data-bb-step-count]').textContent = interpolate(this.strings.stepOf, {
        current: String(index + 1).padStart(2, '0'),
        total: String(this.steps.length).padStart(2, '0'),
      });
      this.querySelector('[data-bb-step-title]').textContent = step.title || this.partLabel(step.part);
      const intro = this.querySelector('[data-bb-step-intro]');
      intro.textContent = step.intro || '';
      intro.hidden = !step.intro;
      this.list.render(step);
    }

    this.panel.classList.remove('is-entering');
    this.summaryEl.classList.remove('is-entering');
    void this.offsetWidth; // eslint-disable-line no-void
    (isSummary ? this.summaryEl : this.panel).classList.add('is-entering');

    this.refresh();
    this.prefetchNext();

    if (scroll) {
      const top = this.querySelector('.bb-steps')?.getBoundingClientRect().top ?? 0;
      if (top < 0 || top > window.innerHeight * 0.6) {
        this.querySelector('.bb-steps')?.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
      }
    }
    if (focus) {
      const heading = isSummary ? this.summaryEl.querySelector('[data-bb-summary-title]') : this.querySelector('[data-bb-step-title]');
      heading?.focus({ preventScroll: true });
    }
  }

  onClick = (event) => {
    const goto = event.target.closest('[data-bb-goto]');
    if (goto && this.contains(goto)) {
      event.preventDefault();
      this.goTo(goto.dataset.bbGoto);
      return;
    }
    if (event.target.closest('[data-bb-reset]')) this.resetBuild();
  };

  resetBuild({ confirm = true } = {}) {
    if (confirm && this.selection.size && !window.confirm(this.strings.resetConfirm)) return;
    this.selection.clear();
    reset(this.storage);
    this.state = emptyState(this.stepKeys[0]);
    this.list.active.clear();
    this.list.onlyFit.clear();
    this.summary.status = null;
    this.goTo(this.stepKeys[0]);
  }

  // ------------------------------------------------------------------------------ Chrome (stepper, legend, preview, bar)

  refresh() {
    if (!this.steps?.length) return;
    const current = this.state.step;
    const index = this.currentIndex();

    this.querySelectorAll('[data-bb-goto]').forEach((button) => {
      if (!button.closest('[data-bb-stepper]')) return;
      const part = button.dataset.bbGoto;
      const done = part === 'summary' ? this.summary.missing().length === 0 : this.selection.has(part);
      const isCurrent = part === current;
      if (isCurrent) button.setAttribute('aria-current', 'step');
      else button.removeAttribute('aria-current');
      button.classList.toggle('is-done', done);
      const state = button.querySelector('[data-bb-step-state]');
      if (state) state.textContent = isCurrent ? this.strings.stepCurrent : done ? this.strings.stepDone : part === 'summary' ? '' : this.strings.stepOpen;
    });

    this.renderLegend();
    this.renderPreview();

    this.totalEl.textContent = formatMoney(this.total());

    if (this.dots) {
      this.dots.replaceChildren(
        ...[...this.stepKeys, 'summary'].map((part) => {
          const dot = document.createElement('li');
          dot.className = `bb-bar__dot${part === current ? ' is-current' : ''}${this.selection.has(part) ? ' is-done' : ''}`;
          return dot;
        })
      );
    }

    this.prevButton.disabled = index <= 0;
    const isSummary = current === 'summary';
    this.nextButton.hidden = isSummary;
    if (!isSummary) {
      const nextPart = this.stepKeys[index + 1];
      this.nextLabel.textContent = nextPart ? interpolate(this.strings.continueTo, { step: this.partLabel(nextPart) }) : this.strings.toSummary;
      const step = this.steps[index];
      const needsSelection = step?.required && !this.selection.has(step.part);
      this.nextButton.classList.toggle('is-ready', !needsSelection);
      this.nextButton.classList.toggle('button--secondary', Boolean(needsSelection));
    }
    if (isSummary) this.summary.render();
  }

  renderLegend() {
    if (!this.legend) return;
    const rows = [...this.steps.map((step) => step.part), ...(this.selection.has('riser') ? ['riser'] : [])].map((part, index) => {
      const entry = this.selection.get(part);
      const item = document.createElement('li');
      item.className = `bb-legend__row${entry ? ' is-done' : ''}${part === this.state.step ? ' is-current' : ''}`;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'bb-legend__button';
      button.dataset.bbGoto = part === 'riser' ? 'wheels' : part;

      const number = document.createElement('span');
      number.className = 'bb-legend__num label-mono';
      number.textContent = part === 'riser' ? '+' : String(index + 1).padStart(2, '0');
      const label = document.createElement('span');
      label.className = 'bb-legend__part label-mono';
      label.textContent = this.partLabel(part);
      const value = document.createElement('span');
      value.className = 'bb-legend__value';
      if (entry) {
        const variantTitle = entry.variant.title && entry.variant.title !== 'Default Title' ? ` · ${entry.variant.title}` : '';
        value.textContent = `${entry.product.title}${variantTitle}`;
      } else {
        value.textContent = this.strings.notSelected;
      }
      const thumb = document.createElement('span');
      thumb.className = 'bb-legend__thumb';
      const src = entry?.variant.image || entry?.product.image?.src;
      if (src) {
        const image = document.createElement('img');
        image.src = src;
        image.alt = '';
        image.width = 48;
        image.height = 60;
        image.loading = 'lazy';
        thumb.append(image);
      }
      button.append(number, label, value, thumb);
      item.append(button);
      return item;
    });
    this.legend.replaceChildren(...rows);
  }

  renderPreview() {
    if (!this.preview?.update) return;
    const parts = {};
    for (const [part, { product, variant }] of this.selection) {
      const variantLayer = variant.preview?.layer;
      parts[part] = {
        specs: resolveSpecs(product, variant),
        color: previewColor(product, variant),
        layer: variantLayer || product.preview.layer,
        layerRatio: variantLayer ? variant.preview.layerRatio : product.preview.layerRatio,
      };
    }
    const context = this.ruleContext();
    parts.warn = { wheels: evaluate('wheels', context).some((hint) => hint.level === 'warn' || hint.action) };
    const chosen = [...this.selection].map(([part, entry]) => `${this.partLabel(part)}: ${entry.product.title}`);
    parts.title = chosen.length ? interpolate(this.strings.previewSummary, { parts: chosen.join(', ') }) : this.strings.previewEmpty;
    this.preview.update(parts);
  }
}

if (!customElements.get('board-builder')) customElements.define('board-builder', BoardBuilder);
