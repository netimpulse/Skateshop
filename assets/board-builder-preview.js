/**
 * <board-preview>: live SVG preview of the build (bottom/top view + side profile).
 * Geometry is proportional: 20 px per inch; deck width/length, wheelbase, axle width, wheel diameter,
 * truck height and riser pads change the drawing. Colors come from custom.preview_color, the deck print
 * from custom.preview_layer (clipped into the deck shape). Missing parts are drawn as dashed outlines.
 */

const PX = 20;
const CX = 400;
const CY = 120;
const GROUND = 140;
const DEFAULTS = { deck_width: 8.25, deck_length: 32, wheelbase: 14.25, wheel_size: 53 };
const TRUCK_HEIGHT_MM = { low: 46, mid: 50, high: 54 };
const FALLBACK = { deck: '#d8c39a', trucks: '#a8a6a0', wheels: '#f4f2ee', hardware: '#1c1d1b', grip: '#1c1d1b' };
const HEX = /^#[0-9a-f]{3}([0-9a-f]{3})?$/i;

const num = (value) => (typeof value === 'number' && Number.isFinite(value) ? value : null);
const color = (value, fallback) => (typeof value === 'string' && HEX.test(value) ? value : fallback);
const fmt = (value) => Number(value.toFixed(3)).toString();

function set(element, attributes) {
  if (!element) return;
  for (const [name, value] of Object.entries(attributes)) {
    if (value === null || value === undefined) element.removeAttribute(name);
    else element.setAttribute(name, String(typeof value === 'number' ? Math.round(value * 100) / 100 : value));
  }
}

class BoardPreview extends HTMLElement {
  connectedCallback() {
    this.plan = this.querySelector('.bb-preview__plan');
    this.profile = this.querySelector('.bb-preview__profile');
    this.view = 'bottom';
    this.querySelectorAll('[data-view]').forEach((button) => {
      if (button.tagName === 'BUTTON') button.addEventListener('click', () => this.setView(button.dataset.view));
    });
    if (this.pending) this.update(this.pending);
  }

  q(name, root = this) {
    return root.querySelector(`[data-el="${name}"]`);
  }

  qa(name, root = this) {
    return Array.from(root.querySelectorAll(`[data-el="${name}"]`));
  }

  setView(view) {
    this.view = view === 'top' ? 'top' : 'bottom';
    this.querySelectorAll('button[data-view]').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.view === this.view)));
    if (this.plan) this.plan.dataset.view = this.view;
    this.update(this.parts || {});
  }

  /** parts: { deck|trucks|wheels|bearings|griptape|hardware|riser: { specs, color, layer, layerRatio } }, title, warn */
  update(parts = {}) {
    this.parts = parts;
    if (!this.plan) {
      this.pending = parts;
      return;
    }
    const { deck, trucks, wheels, hardware, griptape, riser } = parts;
    const width = num(deck?.specs?.deck_width) ?? DEFAULTS.deck_width;
    const length = num(deck?.specs?.deck_length) ?? DEFAULTS.deck_length;
    const wheelbase = num(deck?.specs?.wheelbase) ?? DEFAULTS.wheelbase;
    const axle = num(trucks?.specs?.truck_width) ?? width;
    const wheelMm = num(wheels?.specs?.wheel_size) ?? DEFAULTS.wheel_size;

    const L = length * PX;
    const W = width * PX;
    const x = CX - L / 2;
    const y = CY - W / 2;
    const trucksX = [CX - (wheelbase * PX) / 2, CX + (wheelbase * PX) / 2];
    const top = this.view === 'top';

    // Deck ------------------------------------------------------------------------------------
    const deckRect = { x, y, width: L, height: W, rx: W / 2 };
    ['deck-clip', 'deck-base', 'deck-grain', 'grip', 'grip-pattern'].forEach((name) => set(this.q(name), deckRect));
    const deckBase = this.q('deck-base');
    set(deckBase, { fill: color(deck?.color, FALLBACK.deck) });
    deckBase?.classList.toggle('is-empty', !deck);
    this.q('deck-grain')?.toggleAttribute('hidden', Boolean(deck?.layer) || top || !deck);

    const layer = this.q('deck-layer');
    if (deck?.layer && !top) {
      const portrait = num(deck.layerRatio) !== null && deck.layerRatio < 1;
      set(layer, portrait
        ? { href: deck.layer, x: CX - W / 2, y: CY - L / 2, width: W, height: L, transform: `rotate(-90 ${CX} ${CY})` }
        : { href: deck.layer, x, y, width: L, height: W, transform: null });
      layer.removeAttribute('hidden');
    } else {
      layer?.setAttribute('hidden', '');
    }

    const grip = this.q('grip');
    set(grip, { fill: color(griptape?.color, FALLBACK.grip) });
    grip?.toggleAttribute('hidden', !top);
    grip?.classList.toggle('is-empty', !griptape);
    const pattern = String(griptape?.specs?.grip_style || '').toLowerCase() === 'pattern';
    this.q('grip-pattern')?.toggleAttribute('hidden', !top || !pattern);

    // Trucks ----------------------------------------------------------------------------------
    this.qa('truck').forEach((group, index) => {
      const tx = trucksX[index];
      group.classList.toggle('is-empty', !trucks);
      group.toggleAttribute('hidden', top);
      const fill = color(trucks?.color, FALLBACK.trucks);
      set(this.q('baseplate', group), { x: tx - 22, y: CY - 21, fill });
      set(this.q('hanger', group), { x: tx - 7, y: CY - (axle * PX) / 2, height: axle * PX, fill });
      set(this.q('kingpin', group), { cx: tx, cy: CY });
    });

    // Wheels (seen from below/above: a rounded rectangle at each axle end) ------------------
    const wheelLength = (wheelMm / 25.4) * PX;
    const wheelThickness = 26;
    this.qa('wheel').forEach((rect) => {
      const pos = Number(rect.dataset.pos);
      const tx = trucksX[pos < 2 ? 0 : 1];
      const upper = pos % 2 === 0;
      const edge = CY + (upper ? -1 : 1) * ((axle * PX) / 2);
      set(rect, {
        x: tx - wheelLength / 2,
        y: upper ? edge - wheelThickness * 0.7 : edge - wheelThickness * 0.3,
        width: wheelLength,
        height: wheelThickness,
        fill: color(wheels?.color, FALLBACK.wheels),
      });
      rect.classList.toggle('is-empty', !wheels);
      rect.classList.toggle('is-warn', Boolean(parts.warn?.wheels));
    });

    // Hardware ------------------------------------------------------------------------------
    const bolts = this.qa('bolt');
    const hardwareGroup = this.q('hardware');
    hardwareGroup?.classList.toggle('is-empty', !hardware);
    bolts.forEach((bolt, index) => {
      const tx = trucksX[index < 4 ? 0 : 1];
      const dx = index % 2 === 0 ? -16 : 16;
      const dy = index % 4 < 2 ? -15 : 15;
      set(bolt, { cx: tx + dx, cy: CY + dy, fill: color(hardware?.color, FALLBACK.hardware) });
    });

    // Dimensions ----------------------------------------------------------------------------
    set(this.q('dim-length'), { d: `M${x} ${y - 20}h${L}` });
    set(this.q('dim-length-label'), { x: CX, y: y - 26 });
    this.q('dim-length-label').textContent = `${fmt(length)}"`;
    const dimX = x + L + 22;
    set(this.q('dim-width'), { d: `M${dimX} ${y}v${W}` });
    set(this.q('dim-width-label'), { x: dimX + 16, y: CY, transform: `rotate(90 ${dimX + 16} ${CY})` });
    this.q('dim-width-label').textContent = `${fmt(width)}"`;
    const wbY = Math.min(y + W + 30, 236);
    set(this.q('dim-wheelbase'), { d: `M${trucksX[0]} ${wbY}H${trucksX[1]}` });
    set(this.q('dim-wheelbase-label'), { x: CX, y: wbY - 6 });
    this.q('dim-wheelbase-label').textContent = `WB ${fmt(wheelbase)}"`;

    // Side profile ---------------------------------------------------------------------------
    const radius = wheelLength / 2;
    const axleY = GROUND - radius;
    const heightKey = String(trucks?.specs?.truck_height || 'mid').toLowerCase();
    const truckPx = ((TRUCK_HEIGHT_MM[heightKey] || TRUCK_HEIGHT_MM.mid) / 25.4) * PX;
    const riserIn = num(riser?.specs?.riser_height) ?? (riser ? 0.125 : 0);
    const riserPx = riser ? Math.max(4, riserIn * PX * 2) : 0;
    const baseplateY = axleY - truckPx;
    const deckY = baseplateY - riserPx;
    const nose = Math.min(48, L * 0.075);

    const profileDeck = this.q('profile-deck');
    set(profileDeck, { d: `M${x} ${deckY - 16} L${x + nose} ${deckY} H${x + L - nose} L${x + L} ${deckY - 16}` });
    profileDeck?.classList.toggle('is-empty', !deck);

    this.qa('profile-truck').forEach((path, index) => {
      const tx = trucksX[index];
      set(path, { d: `M${tx - 22} ${baseplateY}h44l-9 ${truckPx}h-26z`, fill: color(trucks?.color, FALLBACK.trucks) });
      path.classList.toggle('is-empty', !trucks);
    });
    this.qa('profile-riser').forEach((rect, index) => {
      set(rect, { x: trucksX[index] - 22, y: deckY, width: 44, height: riserPx });
    });
    this.qa('profile-wheel').forEach((circle, index) => {
      set(circle, { cx: trucksX[index], cy: axleY, r: radius, fill: color(wheels?.color, FALLBACK.wheels) });
      circle.classList.toggle('is-empty', !wheels);
      circle.classList.toggle('is-warn', Boolean(parts.warn?.wheels));
    });
    const wheelLabel = this.q('profile-wheel-label');
    if (wheelLabel) wheelLabel.textContent = wheels ? `Ø ${Math.round(wheelMm)} mm` : '';

    // Accessible summary ---------------------------------------------------------------------
    const title = this.querySelector('[data-preview-title]');
    if (title && parts.title) title.textContent = parts.title;

    if (this.lastChanged) this.pulse(this.lastChanged);
  }

  /** Short highlight of the part that just changed (disabled for reduced motion via CSS). */
  pulse(part) {
    this.lastChanged = null;
    this.classList.remove('is-pulsing');
    this.dataset.changed = part;
    // Force reflow so the animation restarts.
    void this.offsetWidth; // eslint-disable-line no-void
    this.classList.add('is-pulsing');
  }

  highlight(part) {
    this.lastChanged = part;
  }
}

if (!customElements.get('board-preview')) customElements.define('board-preview', BoardPreview);
