/**
 * Board builder – product list of the current step: facet chips, compatibility hints, cards and variant pills.
 * All product data is inserted with textContent/attributes (never as HTML).
 */
import { formatMoney, interpolate } from '@theme/utils';
import { applyFilters, buildFacets, formatSpec, resolveSpec, resolveSpecs, sortResults } from '@theme/board-builder-data';
import { checkCandidate, strongest } from '@theme/board-builder-rules';

export const DEFAULT_FILTERS = {
  deck: ['available', 'vendor', 'deck_width', 'deck_length', 'concave', 'color', 'price'],
  trucks: ['available', 'vendor', 'truck_width', 'truck_height', 'color', 'price'],
  wheels: ['available', 'wheel_size', 'wheel_hardness', 'vendor', 'color', 'price'],
  bearings: ['available', 'vendor', 'bearing_rating', 'price'],
  griptape: ['available', 'grip_style', 'color', 'vendor', 'price'],
  hardware: ['available', 'hardware_length', 'color', 'vendor', 'price'],
  riser: ['available', 'vendor'],
};

/** Specs shown in the card's mono spec line per part. */
const CARD_SPECS = {
  deck: ['deck_width', 'deck_length', 'concave'],
  trucks: ['truck_width', 'truck_height'],
  wheels: ['wheel_size', 'wheel_hardness'],
  bearings: ['bearing_rating'],
  griptape: ['grip_style'],
  hardware: ['hardware_length'],
  riser: ['riser_height'],
};

/** Minimal element factory – children are nodes or text (always inserted as text). */
export function h(tag, attributes = {}, ...children) {
  const element = document.createElement(tag);
  for (const [name, value] of Object.entries(attributes)) {
    if (value === false || value === null || value === undefined) continue;
    if (name === 'class') element.className = value;
    else if (name === 'dataset') Object.assign(element.dataset, value);
    else element.setAttribute(name, value === true ? '' : String(value));
  }
  for (const child of children.flat()) {
    if (child === null || child === undefined || child === false) continue;
    element.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return element;
}

export function productImage(product, variant, className = 'bb-media') {
  const src = variant?.image || product.image?.src;
  const box = h('span', { class: `${className} media media--contain` });
  if (src) {
    box.append(
      h('img', {
        src,
        srcset: !variant?.image && product.image?.srcset ? product.image.srcset : null,
        sizes: '(min-width: 1200px) 220px, (min-width: 750px) 30vw, 45vw',
        alt: product.image?.alt || product.title,
        width: product.image?.w || 600,
        height: product.image?.h || 750,
        loading: 'lazy',
        decoding: 'async',
      })
    );
  } else {
    box.append(h('span', { class: `bb-placeholder bb-placeholder--${product.category || 'generic'}`, 'aria-hidden': 'true' }));
  }
  return box;
}

export class BuilderList {
  constructor(builder) {
    this.builder = builder;
    this.root = builder;
    this.filtersEl = builder.querySelector('[data-bb-filters]');
    this.listEl = builder.querySelector('[data-bb-list]');
    this.countEl = builder.querySelector('[data-bb-count]');
    this.statusEl = builder.querySelector('[data-bb-status]');
    this.hintsEl = builder.querySelector('[data-bb-hints]');
    this.sortEl = builder.querySelector('[data-bb-sort]');
    this.active = new Map();
    this.sort = new Map();
    this.onlyFit = new Map();

    this.filtersEl?.addEventListener('click', this.onFilterClick);
    this.hintsEl?.addEventListener('click', this.onHintClick);
    this.listEl?.addEventListener('click', this.onListClick);
    this.statusEl?.addEventListener('click', this.onStatusClick);
    this.sortEl?.addEventListener('change', () => {
      this.sort.set(this.part, this.sortEl.value);
      this.render(this.step);
    });
  }

  get strings() {
    return this.builder.strings;
  }

  activeFor(part) {
    if (!this.active.has(part)) {
      const initial = {};
      if (this.builder.availableOnly) initial.available = new Set(['true']);
      this.active.set(part, initial);
    }
    return this.active.get(part);
  }

  facetKeys(step) {
    const custom = String(step.filters || '')
      .split(',')
      .map((key) => key.trim())
      .filter(Boolean);
    return custom.length ? custom : DEFAULT_FILTERS[step.part] || ['vendor', 'price'];
  }

  /** Renders the list for a step; loads data on first visit. */
  async render(step) {
    this.step = step;
    this.part = step.part;
    this.sortEl && (this.sortEl.value = this.sort.get(step.part) || 'featured');
    this.renderHints();

    if (!this.builder.data.has(step.part)) {
      this.showLoading();
      try {
        await this.builder.ensureData(step.part);
      } catch {
        if (this.step === step) this.showError();
        return;
      }
      if (this.step !== step) return;
    }

    const products = this.builder.data.get(step.part) || [];
    this.statusEl.replaceChildren();
    this.listEl.setAttribute('aria-busy', 'false');

    if (!products.length) {
      this.filtersEl.replaceChildren();
      this.listEl.replaceChildren();
      this.countEl.textContent = '';
      this.statusEl.append(h('p', { class: 'bb-status__message' }, this.strings.emptyStep));
      return;
    }

    const active = this.activeFor(step.part);
    this.renderFilters(buildFacets(products, this.facetKeys(step)), active);

    const context = this.builder.ruleContext();
    let results = applyFilters(products, active, { prefer: this.preferFor(step.part) });
    if (this.onlyFit.get(step.part)) {
      results = results.filter(({ product, variant }) => strongest(checkCandidate(step.part, resolveSpecs(product, variant), context))?.level !== 'warn');
    }
    results = sortResults(results, this.sort.get(step.part) || 'featured');

    this.countEl.textContent = interpolate(this.strings.results, { count: results.length });
    if (!results.length) {
      this.listEl.replaceChildren();
      this.statusEl.append(
        h('p', { class: 'bb-status__message' }, this.strings.noResults),
        h('button', { type: 'button', class: 'link-mono', 'data-bb-clear-filters': true }, this.strings.clearFilters)
      );
      return;
    }
    this.listEl.replaceChildren(...results.map((result, index) => this.card(result, context, index)));
  }

  /** Prefer variants that match the already selected parts (e.g. truck width close to the deck width). */
  preferFor(part) {
    const deck = this.builder.selectedSpecs('deck');
    if (part === 'trucks' && deck?.deck_width) {
      return (product, variant) => {
        const width = resolveSpec(product, variant, 'truck_width');
        return width === null ? 0 : 10 - Math.abs(width - deck.deck_width) * 20;
      };
    }
    const selected = this.builder.selection.get(part);
    if (selected) return (product, variant) => (variant.id === selected.variant.id ? 50 : 0);
    return undefined;
  }

  showLoading() {
    this.listEl.setAttribute('aria-busy', 'true');
    this.countEl.textContent = this.strings.loading;
    this.filtersEl.replaceChildren();
    this.statusEl.replaceChildren();
    this.listEl.replaceChildren(...Array.from({ length: 6 }, () => h('li', { class: 'bb-card bb-card--skeleton', 'aria-hidden': 'true' }, h('span', { class: 'bb-media shimmer' }))));
  }

  showError() {
    this.listEl.setAttribute('aria-busy', 'false');
    this.listEl.replaceChildren();
    this.countEl.textContent = '';
    this.statusEl.replaceChildren(
      h('p', { class: 'form-message form-message--error', role: 'alert' }, this.strings.loadError),
      h('button', { type: 'button', class: 'button button--secondary button--small', 'data-bb-retry': true }, this.strings.retry)
    );
  }

  // ---------------------------------------------------------------------------------- Filters

  facetLabel(facet, value) {
    const facets = this.strings.facets || {};
    if (facet.key === 'available') return facets.availableOnly;
    if (facet.key === 'price') {
      if (value.max === null) return interpolate(facets.priceFrom, { min: formatMoney(value.min) });
      if (value.min === 0) return interpolate(facets.priceUpTo, { max: formatMoney(value.max) });
      return interpolate(facets.priceRange, { min: formatMoney(value.min), max: formatMoney(value.max) });
    }
    return formatSpec(facet.key, value.value) || value.value;
  }

  renderFilters(facets, active) {
    const groups = facets.map((facet) => {
      const labelId = `bb-facet-${this.builder.sectionId}-${facet.key}`;
      const selected = active[facet.key] || new Set();
      return h(
        'div',
        { class: 'bb-facet', role: 'group', 'aria-labelledby': labelId },
        h('span', { class: 'bb-facet__label label-mono', id: labelId }, facet.key === 'available' ? this.strings.facets.available : this.strings.facets[facet.key] || facet.key),
        h(
          'div',
          { class: 'bb-facet__chips' },
          facet.values.map((value) =>
            h(
              'button',
              {
                type: 'button',
                class: 'bb-chip',
                'aria-pressed': String(selected.has(value.value)),
                'data-bb-facet': facet.key,
                'data-bb-value': value.value,
              },
              this.facetLabel(facet, value),
              facet.key === 'available' ? null : h('span', { class: 'bb-chip__count' }, value.count)
            )
          )
        )
      );
    });
    const anyActive = Object.values(active).some((set) => set.size);
    if (anyActive) groups.push(h('button', { type: 'button', class: 'link-mono bb-filters__clear', 'data-bb-clear-filters': true }, this.strings.clearFilters));
    this.filtersEl.replaceChildren(...groups);
  }

  onFilterClick = (event) => {
    const chip = event.target.closest('[data-bb-facet]');
    if (chip) {
      const active = this.activeFor(this.part);
      const key = chip.dataset.bbFacet;
      const set = active[key] || new Set();
      if (set.has(chip.dataset.bbValue)) set.delete(chip.dataset.bbValue);
      else set.add(chip.dataset.bbValue);
      active[key] = set;
      this.render(this.step).then(() => this.filtersEl.querySelector(`[data-bb-facet="${CSS.escape(key)}"][data-bb-value="${CSS.escape(chip.dataset.bbValue)}"]`)?.focus());
      return;
    }
    if (event.target.closest('[data-bb-clear-filters]')) this.clearFilters();
  };

  clearFilters() {
    this.active.set(this.part, {});
    this.onlyFit.set(this.part, false);
    this.render(this.step);
  }

  onStatusClick = (event) => {
    if (event.target.closest('[data-bb-clear-filters]')) this.clearFilters();
    if (event.target.closest('[data-bb-retry]')) {
      this.builder.data.delete(this.part);
      this.builder.loading.delete(this.part);
      this.render(this.step);
    }
  };

  // ---------------------------------------------------------------------------------- Hints

  renderHints() {
    const hints = this.builder.hintsFor(this.part);
    const nodes = hints.map((hint) => {
      const box = h(
        'div',
        { class: `bb-hint bb-hint--${hint.level}` },
        h('span', { class: 'bb-hint__icon', 'aria-hidden': 'true' }, hint.level === 'warn' ? '!' : 'i'),
        h('p', { class: 'bb-hint__text' }, this.builder.message(hint))
      );
      if (hint.filter) {
        box.append(
          h(
            'button',
            { type: 'button', class: 'button button--secondary button--small', 'aria-pressed': String(Boolean(this.onlyFit.get(this.part))), 'data-bb-only-fit': true },
            this.strings.onlyFit
          )
        );
      }
      if (hint.action?.type === 'offer-extra' && this.builder.riserUrl) box.append(this.builder.summary.riserControl());
      return box;
    });
    this.hintsEl.replaceChildren(...nodes);
  }

  onHintClick = (event) => {
    if (event.target.closest('[data-bb-only-fit]')) {
      this.onlyFit.set(this.part, !this.onlyFit.get(this.part));
      this.render(this.step);
    }
  };

  // ---------------------------------------------------------------------------------- Cards

  card({ product, variant }, context, index) {
    const part = this.part;
    const selected = this.builder.selection.get(part);
    const isSelected = selected?.product.id === product.id;
    const shownVariant = isSelected ? selected.variant : variant;
    const specs = resolveSpecs(product, shownVariant);
    const result = strongest(checkCandidate(part, specs, context));
    const specLine = (CARD_SPECS[part] || [])
      .map((key) => formatSpec(key, specs[key]))
      .filter(Boolean)
      .join(' · ');
    const unavailable = !shownVariant.available;

    const select = h(
      'button',
      {
        type: 'button',
        class: 'bb-card__select',
        'aria-pressed': String(isSelected),
        'data-bb-select': product.id,
        'data-bb-variant-id': shownVariant.id,
        disabled: unavailable && !isSelected,
      },
      productImage(product, shownVariant),
      h('span', { class: 'bb-card__vendor label-mono' }, product.vendor),
      h('span', { class: 'bb-card__title' }, product.title),
      specLine ? h('span', { class: 'bb-card__specs label-mono' }, specLine) : null,
      h(
        'span',
        { class: 'bb-card__price' },
        h('span', { class: shownVariant.compareAt ? 'bb-card__price-sale' : '' }, shownVariant.priceFormatted || formatMoney(shownVariant.price)),
        shownVariant.compareAt ? h('s', { class: 'bb-card__compare' }, formatMoney(shownVariant.compareAt)) : null
      )
    );

    const flags = h('span', { class: 'bb-card__flags' });
    if (isSelected) flags.append(h('span', { class: 'badge badge--sticker bb-card__selected' }, `✓ ${this.strings.selected}`));
    if (unavailable) flags.append(h('span', { class: 'badge badge--sold-out' }, this.strings.soldOut));
    if (result && result.level !== 'ok') flags.append(h('span', { class: `bb-fit bb-fit--${result.level}` }, this.builder.message(result)));
    else if (result?.level === 'ok') flags.append(h('span', { class: 'bb-fit bb-fit--ok' }, this.builder.message(result)));

    const item = h('li', { class: `bb-card${isSelected ? ' is-selected' : ''}`, 'data-stagger': index % 6 }, select, flags);

    if (product.variants.length > 1) {
      const optionName = product.options[0] || '';
      const groupId = `bb-var-${this.builder.sectionId}-${product.id}`;
      item.append(
        h(
          'div',
          { class: 'bb-card__variants', role: 'group', 'aria-labelledby': groupId },
          h('span', { class: 'visually-hidden', id: groupId }, `${optionName} – ${product.title}`),
          product.variants.map((option) =>
            h(
              'button',
              {
                type: 'button',
                class: 'bb-pill',
                'aria-pressed': String(isSelected && option.id === shownVariant.id),
                'data-bb-select': product.id,
                'data-bb-variant-id': option.id,
                disabled: !option.available,
                title: option.available ? null : this.strings.soldOut,
              },
              option.title
            )
          )
        )
      );
    }
    if (product.url) item.append(h('a', { class: 'bb-card__details link-mono', href: product.url }, this.strings.details));
    return item;
  }

  onListClick = (event) => {
    const button = event.target.closest('[data-bb-select]');
    if (!button || button.disabled) return;
    const products = this.builder.data.get(this.part) || [];
    const product = products.find((entry) => entry.id === Number(button.dataset.bbSelect));
    const variant = product?.variants.find((entry) => entry.id === Number(button.dataset.bbVariantId));
    if (!product || !variant) return;
    this.builder.select(this.part, product, variant);
    this.render(this.step).then(() => {
      const selector = `[data-bb-select="${product.id}"][data-bb-variant-id="${variant.id}"]`;
      (this.listEl.querySelector(`.bb-pill${selector}`) || this.listEl.querySelector(`.bb-card__select${selector}`))?.focus();
    });
  };
}
