const $ = (id) => document.getElementById(id);

/**
 * Where each selection sits, shown under its description. The descriptors live in host memory —
 * the ring's residence when it is composed; head and tail are positions on the ring itself.
 */
const PLACE = {
  descriptors: { path: ['Host memory', 'Descriptor region', 'Descriptor ring', 'Descriptors'], current: 'Descriptors' },
  head: { path: ['Descriptor ring', 'Head: the next descriptor the NIC fills'], current: 'Head: the next descriptor the NIC fills' },
  tail: { path: ['Descriptor ring', 'Tail: how far software has refilled'], current: 'Tail: how far software has refilled' },
};

/**
 * Explanation/UI layer. Pure DOM: it receives part metadata and emits intents (preset, reset,
 * part, about, close) through callbacks. One panel shows either a part or the About page,
 * so on a phone both use the same bottom sheet.
 */
export class UI {
  constructor({ onPreset, onReset, onPart, onAbout, onClose }) {
    this.tooltip = $('tooltip');
    this.info = $('info');
    this.part = $('part');
    this.about = $('about');
    this.hint = $('hint');
    this.cleanups = [];
    const on = (el, type, fn) => {
      el.addEventListener(type, fn);
      this.cleanups.push(() => el.removeEventListener(type, fn));
    };
    this.presetButtons = [...document.querySelectorAll('[data-preset]')];
    this.presetButtons.forEach((b) => on(b, 'click', () => onPreset(b.dataset.preset)));
    document.querySelectorAll('[data-part]').forEach((b) => on(b, 'click', () => onPart(b.dataset.part)));
    on($('reset-camera'), 'click', onReset);
    on($('about-open'), 'click', onAbout);
    on($('info-close'), 'click', onClose);
  }

  setActivePreset(name) {
    this.presetButtons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.preset === name)));
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

  /** Show a part's metadata, or close the part view (null). */
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
    const place = PLACE[id];
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
