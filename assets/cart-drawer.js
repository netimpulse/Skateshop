/**
 * <cart-drawer>: refreshes its content from the `cart-drawer` section after every cart mutation
 * and opens the dialog when an item was added elsewhere on the page.
 */
import { on, EVENTS, parseHTML } from '@theme/utils';
import { openDialog } from '@theme/theme';
import { CART_DRAWER_SECTION, shouldOpenDrawer } from '@theme/cart';

class CartDrawer extends HTMLElement {
  connectedCallback() {
    this.dialog = this.querySelector('dialog');
    this.off = on(EVENTS.cartUpdated, this.onCartUpdated);
  }

  disconnectedCallback() {
    this.off?.();
  }

  onCartUpdated = ({ detail }) => {
    const html = detail.sections?.[CART_DRAWER_SECTION];
    if (html) {
      const fresh = parseHTML(html).querySelector('[data-cart-drawer-content]');
      const current = this.querySelector('[data-cart-drawer-content]');
      if (fresh && current) current.replaceWith(document.importNode(fresh, true));
    }
    if (shouldOpenDrawer(detail.source)) openDialog(this.dialog);
  };
}

if (!customElements.get('cart-drawer')) customElements.define('cart-drawer', CartDrawer);
