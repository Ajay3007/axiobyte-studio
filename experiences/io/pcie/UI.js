const $ = (id) => document.getElementById(id);

/**
 * Where each part sits between the card and the CPU, shown under its description. The current
 * part is marked; the ends (endpoint, root complex) are what the asset's ports connect to.
 */
const PLACE = {
  slot: ['Card (endpoint)', 'Slot', 'Lanes', 'Root complex (CPU)'],
  sideband: ['Card (endpoint)', 'Power and sideband', 'Board power and control'],
  link: ['Endpoint (card)', 'Link x8', 'Root complex (CPU)'],
};
const placeOf = (id) => {
  if (PLACE[id]) return { path: PLACE[id], current: PLACE[id][1] };
  const lane = /^lane-(\d)$/.exec(id);
  if (!lane) return null;
  return { path: ['Card (endpoint)', 'Slot', `Lane ${lane[1]}`, 'Root complex (CPU)'], current: `Lane ${lane[1]}` };
};

/**
 * Explanation/UI layer. Pure DOM: it receives part metadata and emits intents (preset, reset,
 * link, part, about, close) through callbacks. One panel shows either a part or the asset's
 * About page, so on a phone both use the same bottom sheet.
 */
export class UI {
  constructor({ onPreset, onReset, onLink, onPart, onAbout, onClose }) {
    this.tooltip = $('tooltip');
    this.info = $('info');
    this.part = $('part');
    this.about = $('about');
    this.hint = $('hint');
    this.linkButton = $('show-link');
    this.cleanups = [];
    const on = (el, type, fn) => {
      el.addEventListener(type, fn);
      this.cleanups.push(() => el.removeEventListener(type, fn));
    };
    this.presetButtons = [...document.querySelectorAll('[data-preset]')];
    this.presetButtons.forEach((b) => on(b, 'click', () => onPreset(b.dataset.preset)));
    document.querySelectorAll('[data-part]').forEach((b) => on(b, 'click', () => onPart(b.dataset.part)));
    on($('reset-camera'), 'click', onReset);
    on(this.linkButton, 'click', onLink);
    on($('about-open'), 'click', onAbout);
    on($('info-close'), 'click', onClose);
  }

  setActivePreset(name) {
    this.presetButtons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.preset === name)));
  }

  setLinkShown(shown) {
    this.linkButton.setAttribute('aria-pressed', String(shown));
    this.linkButton.textContent = shown ? 'Hide link' : 'Show link';
  }

  fadeHint() {
    this.hint?.classList.add('is-faded');
  }

  showTooltip(meta, x, y) {
    if (!meta) return this.hideTooltip();
    this.tooltip.innerHTML = '';
    const title = document.createElement('strong');
    title.textContent = meta.name;
    const sub = document.createElement('span');
    sub.textContent = [meta.designator, meta.category].filter(Boolean).join(' · ');
    this.tooltip.append(title, sub);
    this.tooltip.hidden = false;
    this.moveTooltip(x, y);
  }

  moveTooltip(x, y) {
    if (this.tooltip.hidden) return;
    const pad = 14;
    const w = this.tooltip.offsetWidth;
    const h = this.tooltip.offsetHeight;
    const nx = Math.min(x + pad, window.innerWidth - w - 8);
    const ny = y + pad + h > window.innerHeight - 8 ? y - h - pad : y + pad;
    this.tooltip.style.transform = `translate(${Math.round(nx)}px, ${Math.round(ny)}px)`;
  }

  hideTooltip() {
    this.tooltip.hidden = true;
  }

  /** Show a part's metadata, or close the panel (null). */
  showInfo(id, meta) {
    if (!meta) {
      this.part.hidden = true;
      if (this.about.hidden) this.info.hidden = true;
      return;
    }
    this.about.hidden = true;
    $('info-designator').textContent = meta.designator ?? '';
    $('info-category').textContent = meta.category ?? '';
    $('info-title').textContent = meta.name;
    $('info-summary').textContent = meta.summary ?? '';
    $('info-desc').textContent = meta.description ?? '';
    const dl = $('info-details');
    dl.innerHTML = '';
    (meta.details ?? []).forEach(([k, v]) => {
      const dt = document.createElement('dt');
      dt.textContent = k;
      const dd = document.createElement('dd');
      dd.textContent = v;
      dl.append(dt, dd);
    });
    const place = placeOf(id);
    const pathEl = $('info-path');
    pathEl.innerHTML = '';
    if (place) {
      const label = document.createElement('span');
      label.className = 'path-label';
      label.textContent = 'Where it sits';
      pathEl.append(label);
      place.path.forEach((stage, i) => {
        if (i) pathEl.append(Object.assign(document.createElement('span'), { textContent: '→', ariaHidden: 'true' }));
        const s = document.createElement('span');
        s.className = 'stage' + (stage === place.current ? ' is-current' : '');
        s.textContent = stage;
        pathEl.append(s);
      });
    }
    pathEl.hidden = !place;
    this.part.hidden = false;
    this.open();
  }

  showAbout(shown) {
    this.about.hidden = !shown;
    if (shown) {
      this.part.hidden = true;
      this.open();
    } else if (this.part.hidden) {
      this.info.hidden = true;
    }
  }

  get aboutOpen() {
    return !this.about.hidden && !this.info.hidden;
  }

  open() {
    this.info.hidden = false;
    this.info.scrollTop = 0;
    // restart the entrance animation
    this.info.style.animation = 'none';
    void this.info.offsetWidth;
    this.info.style.animation = '';
  }

  dispose() {
    this.cleanups.forEach((fn) => fn());
    this.hideTooltip();
    this.info.hidden = true;
  }
}
