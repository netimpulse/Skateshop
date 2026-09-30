/**
 * Global UI behaviour: dialogs/drawers, disclosure navigation (mega menu), sticky header,
 * scroll sliders, marquee pause, parallax media and reveal-on-scroll.
 */
import { prefersReducedMotion, strings } from '@theme/utils';

// ------------------------------------------------------------------ Dialogs & drawers
// Any element with [data-dialog-open="<dialog id>"] opens that <dialog> modally; [data-dialog-close] closes it.

const dialogOpeners = new WeakMap();

export function openDialog(dialog, opener = document.activeElement) {
  if (!dialog || dialog.open) return;
  dialogOpeners.set(dialog, opener);
  dialog.showModal();
  dialog.dispatchEvent(new CustomEvent('dialog:open', { bubbles: true }));
  const focusTarget = dialog.querySelector('[autofocus]') || dialog.querySelector('[data-dialog-close]');
  focusTarget?.focus();
}

export function closeDialog(dialog) {
  if (!dialog?.open) return;
  dialog.close();
}

document.addEventListener('click', (event) => {
  const opener = event.target.closest('[data-dialog-open]');
  if (opener) {
    const dialog = document.getElementById(opener.dataset.dialogOpen);
    if (dialog instanceof HTMLDialogElement) {
      event.preventDefault();
      openDialog(dialog, opener);
      return;
    }
  }

  const closer = event.target.closest('[data-dialog-close]');
  if (closer) {
    closeDialog(closer.closest('dialog'));
    return;
  }

  // Click on the backdrop area (the dialog element itself) closes it.
  if (event.target instanceof HTMLDialogElement && event.target.open && event.target.hasAttribute('data-backdrop-close')) {
    const rect = event.target.getBoundingClientRect();
    const inside = event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom;
    if (!inside) closeDialog(event.target);
  }
});

/**
 * Returns focus after a dialog closed. If the opener was re-rendered or hidden meanwhile (e.g. a quick-add pill in a
 * closed <details>, a re-rendered builder button), fall back to its disclosure summary, an element with the same
 * [data-focus-key], or the main landmark – never to <body>.
 */
function returnFocus(opener) {
  const visible = (element) => element && element.isConnected && element.getClientRects().length > 0;
  if (visible(opener)) {
    opener.focus();
    return;
  }
  const summary = opener?.isConnected ? opener.closest('details')?.querySelector('summary') : null;
  const key = opener?.dataset?.focusKey;
  const sibling = key ? document.querySelector(`[data-focus-key="${CSS.escape(key)}"]`) : null;
  const target = [summary, sibling].find(visible) || document.getElementById('MainContent');
  target?.focus({ preventScroll: Boolean(target?.id === 'MainContent') });
}

document.addEventListener(
  'close',
  (event) => {
    if (!(event.target instanceof HTMLDialogElement)) return;
    const opener = dialogOpeners.get(event.target);
    dialogOpeners.delete(event.target);
    returnFocus(opener);
  },
  true
);

// ------------------------------------------------------------------ Disclosure navigation (mega menu)

class DisclosureNav extends HTMLElement {
  connectedCallback() {
    this.hoverIntent = null;
    this.canHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    this.addEventListener('click', this.onClick);
    this.addEventListener('keydown', this.onKeydown);
    this.addEventListener('focusout', this.onFocusOut);
    if (this.canHover && this.hasAttribute('data-hover')) {
      this.addEventListener('pointerover', this.onPointerOver);
      this.addEventListener('pointerleave', this.onPointerLeave);
    }
    document.addEventListener('click', this.onDocumentClick);
  }

  disconnectedCallback() {
    document.removeEventListener('click', this.onDocumentClick);
  }

  get triggers() {
    return Array.from(this.querySelectorAll('[aria-controls][aria-expanded]'));
  }

  toggle(trigger, force) {
    const panel = document.getElementById(trigger.getAttribute('aria-controls'));
    const expand = force ?? trigger.getAttribute('aria-expanded') !== 'true';
    if (expand) this.triggers.forEach((other) => other !== trigger && this.toggle(other, false));
    trigger.setAttribute('aria-expanded', String(expand));
    if (panel) panel.hidden = !expand;
    this.classList.toggle('has-open-panel', this.triggers.some((item) => item.getAttribute('aria-expanded') === 'true'));
  }

  closeAll() {
    this.openedByHover = null;
    this.triggers.forEach((trigger) => this.toggle(trigger, false));
  }

  onClick = (event) => {
    const trigger = event.target.closest('[aria-controls][aria-expanded]');
    if (trigger && this.contains(trigger)) {
      event.preventDefault();
      // A click right after hover-opening keeps the panel open instead of closing it again.
      if (this.openedByHover === trigger && trigger.getAttribute('aria-expanded') === 'true') {
        this.openedByHover = null;
        return;
      }
      this.toggle(trigger);
    }
  };

  onKeydown = (event) => {
    if (event.key !== 'Escape') return;
    const open = this.triggers.find((trigger) => trigger.getAttribute('aria-expanded') === 'true');
    if (open) {
      this.toggle(open, false);
      open.focus();
    }
  };

  onFocusOut = (event) => {
    if (event.relatedTarget && !this.contains(event.relatedTarget)) this.closeAll();
  };

  onDocumentClick = (event) => {
    if (!this.contains(event.target)) this.closeAll();
  };

  onPointerOver = (event) => {
    const item = event.target.closest('[data-disclosure-item]');
    if (!item) return;
    const trigger = item.querySelector('[aria-controls][aria-expanded]');
    clearTimeout(this.hoverIntent);
    this.hoverIntent = setTimeout(() => {
      if (trigger) {
        if (trigger.getAttribute('aria-expanded') !== 'true') this.openedByHover = trigger;
        this.toggle(trigger, true);
      } else {
        this.closeAll();
      }
    }, 120);
  };

  onPointerLeave = () => {
    clearTimeout(this.hoverIntent);
    this.hoverIntent = setTimeout(() => this.closeAll(), 220);
  };
}

// ------------------------------------------------------------------ Sticky header

class StickyHeader extends HTMLElement {
  connectedCallback() {
    this.resizeObserver = new ResizeObserver(() => this.updateHeight());
    this.resizeObserver.observe(this);
    this.updateHeight();
    if (this.dataset.sticky === 'true') {
      this.lastY = window.scrollY;
      window.addEventListener('scroll', this.onScroll, { passive: true });
    }
  }

  disconnectedCallback() {
    this.resizeObserver?.disconnect();
    window.removeEventListener('scroll', this.onScroll);
  }

  updateHeight() {
    document.documentElement.style.setProperty('--header-height', `${Math.round(this.offsetHeight)}px`);
  }

  onScroll = () => {
    const y = window.scrollY;
    this.classList.toggle('is-scrolled', y > 8);
    this.lastY = y;
  };
}

// ------------------------------------------------------------------ Scroll slider

class ScrollSlider extends HTMLElement {
  connectedCallback() {
    this.track = this.querySelector('[data-slider-track]');
    this.prev = this.querySelector('[data-slider-prev]');
    this.next = this.querySelector('[data-slider-next]');
    if (!this.track) return;
    this.prev?.addEventListener('click', () => this.go(-1));
    this.next?.addEventListener('click', () => this.go(1));
    this.track.addEventListener('scroll', this.update, { passive: true });
    this.resizeObserver = new ResizeObserver(this.update);
    this.resizeObserver.observe(this.track);
    this.update();
  }

  disconnectedCallback() {
    this.resizeObserver?.disconnect();
  }

  go(direction) {
    const item = this.track.firstElementChild;
    const step = item ? item.getBoundingClientRect().width + parseFloat(getComputedStyle(this.track).columnGap || 0) : this.track.clientWidth;
    this.track.scrollBy({ left: direction * step, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
  }

  update = () => {
    if (!this.track) return;
    const max = this.track.scrollWidth - this.track.clientWidth - 2;
    if (this.prev) this.prev.disabled = this.track.scrollLeft <= 2;
    if (this.next) this.next.disabled = this.track.scrollLeft >= max;
    this.classList.toggle('is-scrollable', max > 0);
  };
}

// ------------------------------------------------------------------ Marquee (pausable)

class MarqueeStrip extends HTMLElement {
  connectedCallback() {
    this.button = this.querySelector('[data-marquee-toggle]');
    this.button?.addEventListener('click', () => this.setPaused(!this.classList.contains('is-paused')));
    if (prefersReducedMotion()) this.setPaused(true);
  }

  setPaused(paused) {
    this.classList.toggle('is-paused', paused);
    if (!this.button) return;
    this.button.setAttribute('aria-pressed', String(paused));
    const label = paused ? strings.play : strings.pause;
    if (label) this.button.setAttribute('aria-label', label);
  }
}

// ------------------------------------------------------------------ Parallax media

class ParallaxMedia extends HTMLElement {
  connectedCallback() {
    if (prefersReducedMotion()) return;
    this.strength = Number(this.dataset.strength || 40);
    this.observer = new IntersectionObserver(([entry]) => {
      this.visible = entry.isIntersecting;
      if (this.visible) this.tick();
    });
    this.observer.observe(this);
    window.addEventListener('scroll', this.onScroll, { passive: true });
  }

  disconnectedCallback() {
    this.observer?.disconnect();
    window.removeEventListener('scroll', this.onScroll);
  }

  onScroll = () => {
    if (this.visible && !this.frame) this.frame = requestAnimationFrame(this.tick);
  };

  tick = () => {
    this.frame = null;
    const rect = this.getBoundingClientRect();
    const progress = (rect.top + rect.height / 2 - window.innerHeight / 2) / window.innerHeight;
    this.style.setProperty('--parallax-offset', `${(-progress * this.strength).toFixed(1)}px`);
  };
}

// ------------------------------------------------------------------ Reveal on scroll

let revealObserver;

function initReveal(root = document) {
  if (!document.documentElement.classList.contains('js-reveal')) return;
  const targets = root.querySelectorAll('.reveal:not(.is-revealed)');
  if (prefersReducedMotion() || window.Shopify?.designMode || !('IntersectionObserver' in window)) {
    targets.forEach((element) => element.classList.add('is-revealed'));
    return;
  }
  revealObserver ||= new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-revealed');
        revealObserver.unobserve(entry.target);
      });
    },
    { rootMargin: '0px 0px -8% 0px', threshold: 0.08 }
  );
  targets.forEach((element) => revealObserver.observe(element));
}

// ------------------------------------------------------------------ Registration

const define = (name, constructor) => {
  if (!customElements.get(name)) customElements.define(name, constructor);
};

define('disclosure-nav', DisclosureNav);
define('sticky-header', StickyHeader);
define('scroll-slider', ScrollSlider);
define('marquee-strip', MarqueeStrip);
define('parallax-media', ParallaxMedia);

// Theme editor: selecting a block inside a closed disclosure panel (e.g. a mega menu promo) opens the panel.
document.addEventListener('shopify:block:select', (event) => {
  const nav = event.target.closest?.('disclosure-nav');
  if (!nav) return;
  const triggers = Array.from(nav.querySelectorAll('[aria-controls]'));
  for (let node = event.target; node && node !== nav; node = node.parentElement) {
    const trigger = node.id && triggers.find((item) => item.getAttribute('aria-controls') === node.id);
    if (trigger) {
      nav.toggle(trigger, true);
      return;
    }
  }
});
document.addEventListener('shopify:block:deselect', (event) => event.target.closest?.('disclosure-nav')?.closeAll());

// Expose the announcement bar height (used e.g. by the hero to fit the first viewport).
function observeAnnouncementBar() {
  const bar = document.querySelector('.announcement-bar');
  const root = document.documentElement;
  if (!bar) {
    root.style.setProperty('--announcement-height', '0px');
    return;
  }
  new ResizeObserver(() => root.style.setProperty('--announcement-height', `${Math.round(bar.offsetHeight)}px`)).observe(bar);
}

observeAnnouncementBar();
document.addEventListener('shopify:section:load', observeAnnouncementBar);

initReveal();
document.documentElement.classList.add('theme-ready');
document.addEventListener('shopify:section:load', (event) => initReveal(event.target));
