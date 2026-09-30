/**
 * Product page elements:
 * - <variant-picker>: client-side variant switching from the embedded variant JSON (no fetch per change).
 *   Updates hidden id, price, button state, delivery status, spec cells, URL (?variant=) and emits `variant:changed`.
 * - <product-gallery>: scroll-snap slider (mobile + thumbnails layout), counter, dots, thumbnails, lightbox and
 *   switching to variant.featured_media.
 * - <product-quantity>: stepper buttons respecting min/max/step.
 * - <product-recommendations>: loads related products via Section Rendering (routes.productRecommendations).
 */
import { emit, on, EVENTS, fetchSection, formatMoney, interpolate, prefersReducedMotion, routes, sectionIdOf } from '@theme/utils';
import { openDialog } from '@theme/theme';

const DESKTOP = window.matchMedia('(min-width: 990px)');

const define = (name, constructor) => {
  if (!customElements.get(name)) customElements.define(name, constructor);
};

function readJSON(element) {
  try {
    return JSON.parse(element?.textContent || 'null');
  } catch {
    return null;
  }
}

// ------------------------------------------------------------------ <variant-picker>

class VariantPicker extends HTMLElement {
  connectedCallback() {
    this.variants = readJSON(this.querySelector('[data-variant-json]')) || [];
    this.section = this.closest('[data-product-section]') || document;
    this.sectionId = this.dataset.sectionId || sectionIdOf(this);
    this.fieldsets = Array.from(this.querySelectorAll('fieldset[data-option-index]'));
    this.addEventListener('change', this.onChange);
    this.updateValueStates(this.selectedOptions());
  }

  disconnectedCallback() {
    this.removeEventListener('change', this.onChange);
  }

  selectedOptions() {
    return this.fieldsets.map((fieldset) => fieldset.querySelector('input:checked')?.value ?? null);
  }

  findVariant(options) {
    return this.variants.find((variant) => variant.options.every((value, index) => value === options[index])) || null;
  }

  onChange = (event) => {
    if (!(event.target instanceof HTMLInputElement) || event.target.type !== 'radio') return;
    const options = this.selectedOptions();
    const variant = this.findVariant(options);
    this.updateSelectedLabels();
    this.updateValueStates(options);
    this.render(variant);
    emit(EVENTS.variantChanged, { sectionId: this.sectionId, variant });
  };

  updateSelectedLabels() {
    this.fieldsets.forEach((fieldset) => {
      const label = fieldset.querySelector('[data-selected-value]');
      const checked = fieldset.querySelector('input:checked');
      if (label && checked) label.textContent = checked.value;
    });
  }

  /** Marks values that are sold out or not combinable with the other selected options (still selectable). */
  updateValueStates(options) {
    const soldOut = this.dataset.textSoldOut || '';
    const unavailable = this.dataset.textUnavailable || '';
    this.fieldsets.forEach((fieldset, index) => {
      fieldset.querySelectorAll('input[type="radio"]').forEach((input) => {
        const candidates = this.variants.filter(
          (variant) => variant.options[index] === input.value && variant.options.every((value, i) => i === index || value === options[i])
        );
        const exists = candidates.length > 0;
        const available = candidates.some((variant) => variant.available);
        const label = input.labels?.[0];
        if (!label) return;
        label.classList.toggle('is-unavailable', !available);
        const hint = label.querySelector('[data-value-hint]');
        if (hint) hint.textContent = available ? '' : `, ${exists ? soldOut : unavailable}`;
      });
    });
  }

  render(variant) {
    this.updateForm(variant);
    this.updatePrice(variant);
    this.updateDelivery(variant);
    this.updateSpecs(variant);
    if (variant) this.updateURL(variant);
  }

  updateForm(variant) {
    this.section.querySelectorAll('[data-variant-id]').forEach((input) => {
      if (variant) input.value = variant.id;
    });
    this.section.querySelectorAll('[data-add-button]').forEach((button) => {
      const label = button.querySelector('[data-add-label]') || button;
      if (!variant) {
        button.disabled = true;
        label.textContent = button.dataset.labelUnavailable || '';
      } else if (!variant.available) {
        button.disabled = true;
        label.textContent = button.dataset.labelSoldOut || '';
      } else {
        button.disabled = false;
        label.textContent = button.dataset.labelAdd || '';
      }
    });
    this.section.querySelectorAll('product-form [data-form-error]').forEach((error) => {
      error.hidden = true;
    });
  }

  updatePrice(variant) {
    if (!variant) return;
    this.section.querySelectorAll('[data-product-price]').forEach((wrapper) => {
      const onSale = Number(variant.compare_at_price) > Number(variant.price);
      const price = document.createElement('div');
      price.className = `price${onSale ? ' price--sale' : ''}`;
      price.dataset.price = '';

      const status = document.createElement('span');
      status.className = 'visually-hidden';
      status.textContent = onSale ? wrapper.dataset.labelSale || '' : wrapper.dataset.labelRegular || '';
      const current = document.createElement('span');
      current.className = 'price__current';
      current.textContent = formatMoney(variant.price);
      price.append(status, ' ', current);

      if (onSale) {
        const compareLabel = document.createElement('span');
        compareLabel.className = 'visually-hidden';
        compareLabel.textContent = wrapper.dataset.labelCompare || '';
        const compare = document.createElement('s');
        compare.className = 'price__compare';
        compare.textContent = formatMoney(variant.compare_at_price);
        price.append(' ', compareLabel, ' ', compare);
      }

      if (variant.unit_price) {
        const unit = document.createElement('span');
        unit.className = 'price__unit';
        const unitLabel = document.createElement('span');
        unitLabel.className = 'visually-hidden';
        unitLabel.textContent = wrapper.dataset.labelUnit || '';
        unit.append(unitLabel, ` ${variant.unit_price}`);
        price.append(' ', unit);
      }

      wrapper.replaceChildren(price);
    });
  }

  updateDelivery(variant) {
    this.section.querySelectorAll('[data-product-delivery]').forEach((element) => {
      const state = variant ? variant.stock || 'in_stock' : 'unavailable';
      const texts = {
        in_stock: element.dataset.textInStock,
        low: interpolate(element.dataset.textLow, { count: variant?.stock_count ?? '' }),
        backorder: element.dataset.textBackorder,
        sold_out: element.dataset.textSoldOut,
        unavailable: element.dataset.textUnavailable,
      };
      element.dataset.state = state;
      const text = element.querySelector('[data-delivery-text]');
      if (text) text.textContent = texts[state] ?? texts.in_stock ?? '';
    });
  }

  updateSpecs(variant) {
    if (!variant) return;
    const values = { ...(variant.specs || {}), sku: variant.sku || '' };
    this.section.querySelectorAll('[data-spec]').forEach((cell) => {
      const key = cell.dataset.spec;
      if (!(key in values)) return;
      cell.textContent = values[key];
      const row = cell.closest('[data-spec-row]');
      if (row) row.hidden = !values[key];
    });
  }

  /** Keeps the current path (e.g. collection context) and other params; only ?variant= changes. */
  updateURL(variant) {
    if (window.Shopify?.designMode) return;
    const url = new URL(window.location.href);
    url.searchParams.set('variant', variant.id);
    window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
  }
}

// ------------------------------------------------------------------ <product-gallery>

class ProductGallery extends HTMLElement {
  connectedCallback() {
    this.track = this.querySelector('[data-gallery-track]');
    this.lightbox = this.querySelector('[data-lightbox]');
    this.current = this.querySelector('[data-gallery-current]');
    this.prevButton = this.querySelector('[data-gallery-prev]');
    this.nextButton = this.querySelector('[data-gallery-next]');
    this.activeIndex = 0;
    if (!this.track) return;

    this.track.addEventListener('scroll', this.onScroll, { passive: true });
    this.addEventListener('click', this.onClick);
    this.offVariant = on(EVENTS.variantChanged, this.onVariantChanged);
    this.update();
  }

  disconnectedCallback() {
    this.track?.removeEventListener('scroll', this.onScroll);
    this.removeEventListener('click', this.onClick);
    this.offVariant?.();
  }

  get slides() {
    return Array.from(this.track.querySelectorAll(':scope > [data-gallery-slide]'));
  }

  /** The track scrolls horizontally on mobile and in the thumbnails layout; grid/stack are static on desktop. */
  get isSlider() {
    return !DESKTOP.matches || this.dataset.layout === 'thumbnails';
  }

  onClick = (event) => {
    const target = event.target.closest('button');
    if (!target || !this.contains(target)) return;
    if (target.matches('[data-gallery-prev]')) this.goTo(this.activeIndex - 1);
    else if (target.matches('[data-gallery-next]')) this.goTo(this.activeIndex + 1);
    else if (target.matches('[data-gallery-dot], [data-gallery-thumb]')) {
      this.goTo(Number(target.dataset.galleryDot ?? target.dataset.galleryThumb));
    } else if (target.matches('[data-lightbox-open]')) this.openLightbox(target);
  };

  onScroll = () => {
    if (this.frame) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = null;
      const slides = this.slides;
      if (!slides.length) return;
      const step = slides[1] ? slides[1].offsetLeft - slides[0].offsetLeft : slides[0].offsetWidth;
      const max = this.track.scrollWidth - this.track.clientWidth;
      const atEnd = max > 2 && this.track.scrollLeft >= max - 2;
      const index = atEnd ? slides.length - 1 : Math.round(this.track.scrollLeft / (step || 1));
      this.setActive(Math.max(0, Math.min(slides.length - 1, index)));
    });
  };

  goTo(index, { smooth = true } = {}) {
    const slides = this.slides;
    const target = slides[Math.max(0, Math.min(slides.length - 1, index))];
    if (!target) return;
    const behavior = smooth && !prefersReducedMotion() ? 'smooth' : 'auto';
    if (this.isSlider) {
      // The track is position: relative, so offsetLeft is measured from the track itself.
      this.track.scrollTo({ left: target.offsetLeft, behavior });
    } else {
      target.scrollIntoView({ block: 'nearest', behavior });
    }
    this.setActive(slides.indexOf(target));
  }

  setActive(index) {
    this.activeIndex = index;
    this.update();
  }

  update() {
    const total = this.slides.length;
    const index = this.activeIndex;
    if (this.current) this.current.textContent = String(index + 1).padStart(2, '0');
    this.querySelectorAll('[data-gallery-dot], [data-gallery-thumb]').forEach((control) => {
      const position = Number(control.dataset.galleryDot ?? control.dataset.galleryThumb);
      if (position === index) control.setAttribute('aria-current', 'true');
      else control.removeAttribute('aria-current');
    });
    if (this.prevButton) this.prevButton.disabled = index <= 0;
    if (this.nextButton) this.nextButton.disabled = index >= total - 1;
  }

  onVariantChanged = ({ detail }) => {
    if (detail?.sectionId !== this.dataset.sectionId) return;
    const mediaId = detail.variant?.featured_media;
    if (mediaId) this.showMedia(mediaId);
  };

  /** Shows the given media: slider → scroll to it; grid/stack on desktop → move it to the first position. */
  showMedia(mediaId) {
    const slides = this.slides;
    const slide = slides.find((item) => item.dataset.mediaId === String(mediaId));
    if (!slide) return;
    if (this.isSlider) {
      this.goTo(slides.indexOf(slide));
      return;
    }
    if (slides[0] !== slide) {
      this.track.prepend(slide);
      this.reorderControls(mediaId);
    }
    const rect = this.getBoundingClientRect();
    if (rect.top < 0) this.scrollIntoView({ block: 'start', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
    this.setActive(0);
  }

  /** Keeps lightbox order in sync after the grid layout moved a slide to the front. */
  reorderControls(mediaId) {
    const item = this.lightbox?.querySelector(`[data-lightbox-item="${CSS.escape(String(mediaId))}"]`);
    item?.parentElement?.prepend(item);
  }

  openLightbox(opener) {
    if (!this.lightbox) return;
    openDialog(this.lightbox, opener);
    const item = this.lightbox.querySelector(`[data-lightbox-item="${CSS.escape(opener.dataset.lightboxOpen)}"]`);
    requestAnimationFrame(() => item?.scrollIntoView({ block: 'start' }));
  }
}

// ------------------------------------------------------------------ <product-quantity>

class ProductQuantity extends HTMLElement {
  connectedCallback() {
    this.input = this.querySelector('input[type="number"]');
    this.addEventListener('click', this.onClick);
  }

  disconnectedCallback() {
    this.removeEventListener('click', this.onClick);
  }

  onClick = (event) => {
    const button = event.target.closest('[data-quantity-step]');
    if (!button || !this.input) return;
    const step = Number(this.input.step) || 1;
    const min = Number(this.input.min) || 1;
    const max = this.input.max ? Number(this.input.max) : Infinity;
    const current = Number(this.input.value) || min;
    const next = Math.min(max, Math.max(min, current + Number(button.dataset.quantityStep) * step));
    if (next === current) return;
    this.input.value = String(next);
    this.input.dispatchEvent(new Event('change', { bubbles: true }));
  };
}

// ------------------------------------------------------------------ <product-recommendations>

class ProductRecommendations extends HTMLElement {
  connectedCallback() {
    if (this.loaded || !this.dataset.productId) return;
    this.observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        this.observer.disconnect();
        this.load();
      },
      { rootMargin: '0px 0px 600px 0px' }
    );
    // The section is [hidden] until results arrive – observe the nearest rendered ancestor instead.
    this.observer.observe(this.closest('.shopify-section') || this.parentElement || this);
  }

  disconnectedCallback() {
    this.observer?.disconnect();
  }

  async load() {
    this.loaded = true;
    const section = this.parentElement?.closest('section[data-section-id]');
    const sectionId = this.dataset.sectionId || sectionIdOf(this);
    if (!routes.productRecommendations || !sectionId) return;
    const params = new URLSearchParams({
      product_id: this.dataset.productId,
      limit: this.dataset.limit || '4',
      intent: 'related',
    });
    try {
      const doc = await fetchSection(`${routes.productRecommendations}?${params}`, sectionId);
      const fresh = doc.querySelector('[data-recommendations-content]');
      const target = this.querySelector('[data-recommendations-content]');
      if (!fresh || !target || !fresh.querySelector('[data-product-card]')) {
        if (section) section.hidden = true;
        return;
      }
      fresh.querySelectorAll('.reveal').forEach((element) => element.classList.add('is-revealed'));
      target.replaceChildren(...Array.from(fresh.childNodes).map((node) => document.importNode(node, true)));
      if (section) section.hidden = false;
    } catch {
      if (section) section.hidden = true;
    }
  }
}

define('variant-picker', VariantPicker);
define('product-gallery', ProductGallery);
define('product-quantity', ProductQuantity);
define('product-recommendations', ProductRecommendations);

// Theme editor: open an accordion panel when its block is selected.
document.addEventListener('shopify:block:select', (event) => {
  if (event.target instanceof HTMLDetailsElement) event.target.open = true;
});
