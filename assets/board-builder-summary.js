/**
 * Board builder – BUILD SUMMARY view, riser pad extra and "add complete build to cart".
 * All parts are added in ONE /cart/add.js request with hidden properties (_build_id, _build_part, _build_pos).
 * Availability is checked right before adding; on a 422 the partially added lines are rolled back.
 */
import { announce, config, formatMoney, interpolate, route, routes } from '@theme/utils';
import { addItems, getCart, updateLines } from '@theme/cart';
import { newBuildId } from '@theme/board-builder-state';
import { formatSpec, resolveSpecs } from '@theme/board-builder-data';
import { h, productImage } from '@theme/board-builder-list';

const SUMMARY_SPECS = {
  deck: ['deck_width', 'deck_length', 'wheelbase', 'concave'],
  trucks: ['truck_width', 'truck_height'],
  wheels: ['wheel_size', 'wheel_hardness'],
  bearings: ['bearing_rating'],
  griptape: ['grip_style'],
  hardware: ['hardware_length'],
  riser: ['riser_height'],
};

export class BuilderSummary {
  constructor(builder) {
    this.builder = builder;
    this.root = builder.querySelector('[data-bb-summary]');
    this.busy = false;
    this.root?.addEventListener('click', this.onClick);
    builder.addEventListener('click', this.onRiserClick);
  }

  get strings() {
    return this.builder.strings;
  }

  /** Ordered list of parts in the build: steps first, optional riser last. */
  parts() {
    const list = this.builder.steps.map((step) => ({ part: step.part, step, entry: this.builder.selection.get(step.part) || null }));
    const riser = this.builder.selection.get('riser');
    if (riser) list.push({ part: 'riser', step: null, entry: riser });
    return list;
  }

  missing() {
    return this.parts().filter(({ step, entry }) => step?.required && !entry);
  }

  render(status = this.status) {
    if (!this.root) return;
    this.status = status;
    const s = this.strings.summary;
    const rows = this.parts().map(({ part, step, entry }) => {
      const label = this.builder.partLabel(part);
      if (!entry) {
        return h(
          'li',
          { class: 'bb-sum__row is-missing' },
          h('span', { class: 'bb-sum__thumb bb-placeholder', 'aria-hidden': 'true' }),
          h('span', { class: 'bb-sum__part label-mono' }, label),
          h('span', { class: 'bb-sum__name text-muted' }, step?.required ? this.strings.notSelected : this.strings.optional),
          h('span', { class: 'bb-sum__price' }, '–'),
          h('button', { type: 'button', class: 'link-mono bb-sum__edit', 'data-bb-goto': part }, this.strings.select)
        );
      }
      const { product, variant } = entry;
      const unavailable = variant.available === false;
      const specs = resolveSpecs(product, variant);
      const specLine = (SUMMARY_SPECS[part] || []).map((key) => formatSpec(key, specs[key])).filter(Boolean).join(' · ');
      const variantTitle = variant.title && variant.title !== 'Default Title' ? variant.title : '';
      return h(
        'li',
        { class: `bb-sum__row${unavailable ? ' is-unavailable' : ''}`, 'data-part': part },
        productImage(product, variant, 'bb-sum__thumb'),
        h('span', { class: 'bb-sum__part label-mono' }, label),
        h(
          'span',
          { class: 'bb-sum__name' },
          h('span', { class: 'bb-sum__vendor label-mono' }, product.vendor),
          h('a', { href: product.url || null, class: 'bb-sum__title' }, product.title),
          variantTitle || specLine ? h('span', { class: 'bb-sum__meta label-mono' }, [variantTitle, specLine].filter(Boolean).join(' · ')) : null,
          unavailable ? h('span', { class: 'bb-sum__warning label-mono' }, this.strings.soldOut) : null
        ),
        h('span', { class: 'bb-sum__price' }, variant.priceFormatted || formatMoney(variant.price)),
        part === 'riser'
          ? h('button', { type: 'button', class: 'link-mono bb-sum__edit', 'data-bb-remove-riser': true }, this.strings.remove)
          : h('button', { type: 'button', class: 'link-mono bb-sum__edit', 'data-bb-goto': part }, this.strings.change)
      );
    });

    const hints = this.builder.allHints();
    const compat = h(
      'div',
      { class: 'bb-sum__compat' },
      h('p', { class: 'eyebrow' }, s.compatTitle),
      hints.length
        ? h('ul', { class: 'bb-sum__hints', role: 'list' }, hints.map((hint) => h('li', { class: `bb-hint bb-hint--${hint.level}` }, h('span', { class: 'bb-hint__icon', 'aria-hidden': 'true' }, hint.level === 'warn' ? '!' : 'i'), h('p', { class: 'bb-hint__text' }, this.builder.message(hint)))))
        : h('p', { class: 'bb-hint bb-hint--ok' }, h('span', { class: 'bb-hint__icon', 'aria-hidden': 'true' }, '✓'), h('p', { class: 'bb-hint__text' }, s.compatOk))
    );

    const missing = this.missing();
    const statusNode = h('div', { class: 'bb-sum__status', role: 'status', 'aria-live': 'polite' });
    if (status?.type === 'error') statusNode.append(h('p', { class: 'form-message form-message--error' }, status.message));
    if (status?.type === 'success') {
      statusNode.append(
        h('p', { class: 'form-message form-message--success' }, s.added),
        h('a', { class: 'link-mono', href: routes.cart }, s.viewCart),
        h('button', { type: 'button', class: 'link-mono', 'data-bb-new-build': true }, s.newBuild)
      );
    }

    const addButton = h(
      'button',
      { type: 'button', class: 'button button--full bb-sum__add', 'data-bb-add': true, 'data-focus-key': 'builder-add', disabled: missing.length > 0, 'aria-busy': String(this.busy) },
      s.add
    );

    this.root.replaceChildren(
      h('div', { class: 'bb-panel__head' }, h('p', { class: 'eyebrow eyebrow--rule' }, `${String(this.builder.steps.length + 1).padStart(2, '0')} — ${this.strings.parts.summary}`), h('h2', { class: 'h2 bb-panel__title', tabindex: '-1', 'data-bb-summary-title': true }, s.title)),
      h('ol', { class: 'bb-sum__list', role: 'list' }, rows),
      compat,
      h(
        'div',
        { class: 'bb-sum__footer' },
        h('p', { class: 'bb-sum__total' }, h('span', { class: 'label-mono' }, s.total), h('strong', {}, formatMoney(this.builder.total()))),
        missing.length ? h('p', { class: 'bb-sum__missing text-small' }, interpolate(s.missing, { parts: missing.map(({ part }) => this.builder.partLabel(part)).join(', ') })) : null,
        addButton,
        h(
          'div',
          { class: 'bb-sum__secondary' },
          h('button', { type: 'button', class: 'button button--secondary', 'data-bb-goto': this.builder.steps[0]?.part }, s.edit),
          h('button', { type: 'button', class: 'button button--secondary', 'data-bb-reset': true }, this.builder.querySelector('[data-bb-reset]')?.textContent?.trim() || 'Reset')
        ),
        statusNode
      )
    );
  }

  onClick = (event) => {
    if (event.target.closest('[data-bb-add]')) this.addToCart();
    if (event.target.closest('[data-bb-remove-riser]')) {
      this.builder.deselect('riser');
      this.render(null);
    }
    if (event.target.closest('[data-bb-new-build]')) this.builder.resetBuild({ confirm: false });
  };

  // ---------------------------------------------------------------------------------- Riser extra

  /** Button/list shown inside the wheelbite hint: add or remove riser pads. */
  riserControl() {
    const selected = this.builder.selection.get('riser');
    const wrap = h('div', { class: 'bb-riser', 'data-bb-riser': true });
    if (selected) {
      wrap.append(
        h('span', { class: 'label-mono' }, `✓ ${selected.product.title}`),
        h('button', { type: 'button', class: 'link-mono', 'data-bb-remove-riser': true }, this.strings.riser.remove)
      );
    } else {
      wrap.append(h('button', { type: 'button', class: 'button button--small', 'data-bb-riser-open': true, 'aria-expanded': 'false' }, this.strings.riser.add));
    }
    return wrap;
  }

  onRiserClick = async (event) => {
    const open = event.target.closest('[data-bb-riser-open]');
    const pick = event.target.closest('[data-bb-riser-pick]');
    const remove = event.target.closest('[data-bb-remove-riser]');
    if (remove && !this.root.contains(remove)) {
      this.builder.deselect('riser');
      this.builder.list.renderHints();
      return;
    }
    if (pick) {
      const products = this.builder.data.get('riser') || [];
      const product = products.find((entry) => entry.id === Number(pick.dataset.bbRiserPick));
      const variant = product?.variants.find((entry) => entry.available) || product?.variants[0];
      if (product && variant) {
        this.builder.select('riser', product, variant);
        this.builder.list.renderHints();
        this.builder.querySelector('[data-bb-riser] button')?.focus();
      }
      return;
    }
    if (!open) return;
    const container = open.closest('[data-bb-riser]');
    open.setAttribute('aria-expanded', 'true');
    open.setAttribute('aria-busy', 'true');
    try {
      await this.builder.ensureData('riser');
    } catch {
      open.removeAttribute('aria-busy');
      open.setAttribute('aria-expanded', 'false');
      container.append(h('p', { class: 'form-message form-message--error', role: 'alert' }, this.strings.loadError));
      return;
    }
    open.removeAttribute('aria-busy');
    const products = (this.builder.data.get('riser') || []).filter((product) => product.available);
    if (!products.length) {
      open.setAttribute('aria-expanded', 'false');
      container.append(h('p', { class: 'text-small', role: 'status' }, this.strings.emptyStep));
      return;
    }
    const list = h(
      'ul',
      { class: 'bb-riser__list', role: 'list', 'aria-label': this.strings.riser.choose },
      products.map((product) =>
        h(
          'li',
          {},
          h(
            'button',
            { type: 'button', class: 'bb-riser__option', 'data-bb-riser-pick': product.id },
            productImage(product, null, 'bb-riser__thumb'),
            h('span', {}, product.title),
            h('span', { class: 'label-mono' }, product.priceMinFormatted || formatMoney(product.priceMin))
          )
        )
      )
    );
    container.replaceChildren(list);
    list.querySelector('button')?.focus();
  };

  // ---------------------------------------------------------------------------------- Add to cart

  setBusy(busy) {
    this.busy = busy;
    const button = this.root.querySelector('[data-bb-add]');
    if (button) button.setAttribute('aria-busy', String(busy));
  }

  /**
   * Returns parts that are definitely unavailable (404 or variant not available). Inconclusive answers
   * (throttling, network) do not block – the cart API rejects unavailable items anyway and we roll back.
   * Requests run sequentially to stay below storefront rate limits.
   */
  async checkAvailability(parts) {
    const unavailable = [];
    for (const { part, entry } of parts) {
      try {
        // eslint-disable-next-line no-await-in-loop
        const response = await fetch(route(`products/${encodeURIComponent(entry.product.handle)}.js`), { credentials: 'same-origin' });
        if (response.status === 404) {
          unavailable.push(part);
          continue;
        }
        if (!response.ok) continue;
        // eslint-disable-next-line no-await-in-loop
        const data = await response.json();
        const variant = (data.variants || []).find((item) => item.id === entry.variant.id);
        if (!variant || variant.available === false) unavailable.push(part);
      } catch {
        /* inconclusive */
      }
    }
    return unavailable;
  }

  async addToCart() {
    if (this.busy || this.missing().length) return;
    const parts = this.parts().filter(({ entry }) => entry);
    const s = this.strings.summary;
    this.setBusy(true);
    try {
      const unavailable = await this.checkAvailability(parts);
      if (unavailable.length) {
        unavailable.forEach((part) => {
          const entry = this.builder.selection.get(part);
          if (entry) entry.variant.available = false;
        });
        this.fail(interpolate(s.unavailable, { parts: unavailable.map((part) => this.builder.partLabel(part)).join(', ') }));
        return;
      }
      const buildId = newBuildId();
      const items = parts.map(({ part, entry }, index) => ({
        id: entry.variant.id,
        quantity: 1,
        properties: { _build_id: buildId, _build_part: part, _build_pos: String(index + 1) },
      }));
      try {
        await addItems(items, { source: 'builder' });
      } catch (error) {
        await this.rollback(buildId);
        this.fail(error.userMessage || s.error);
        return;
      }
      announce(s.added);
      if (config.cartType === 'page') {
        window.location.assign(routes.cart);
        return;
      }
      this.render({ type: 'success' });
    } finally {
      this.setBusy(false);
    }
  }

  fail(message) {
    this.render({ type: 'error', message });
    announce(message);
  }

  async rollback(buildId) {
    try {
      const cart = await getCart();
      const keys = (cart.items || []).filter((item) => item.properties?._build_id === buildId).map((item) => item.key);
      if (keys.length) await updateLines(Object.fromEntries(keys.map((key) => [key, 0])), { source: 'builder:silent' });
    } catch {
      /* the error message is shown either way */
    }
  }
}
