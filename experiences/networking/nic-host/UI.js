const $ = (id) => document.getElementById(id);

/**
 * Where a selection sits in the system, shown under its description: the chain from the card to
 * memory, with the selected asset, connection or interaction marked.
 */
const SYSTEM = ['NIC', 'PCIe', 'CPU', 'Host memory'];
const ASSET_NAME = { nic: 'NIC', pcie: 'PCIe', cpu: 'CPU', memory: 'Host memory' };
function placeOf(id) {
  if (id === 'route.pcie') return { path: ['NIC', 'PCIe', 'PCIe x8', 'CPU', 'Host memory'], current: 'PCIe x8' };
  if (id === 'route.memory') return { path: ['NIC', 'PCIe', 'CPU', 'memory channels', 'Host memory'], current: 'memory channels' };
  if (id === 'interaction.dma') return { path: ['NIC DMA engine', 'PCIe', 'root complex', 'memory controller', 'packet buffer'], current: null };
  return { path: SYSTEM, current: ASSET_NAME[id.split('.')[0]] };
}

/**
 * Explanation/UI layer. Pure DOM: it receives part metadata and emits intents (preset, DMA,
 * reset, part, about, close) through callbacks. One panel shows either a part or the About page,
 * so on a phone both use the same bottom sheet.
 */
export class UI {
  constructor({ onPreset, onDma, onReset, onPart, onAbout, onClose }) {
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
    this.dmaButton = $('dma-toggle');
    this.presetButtons.forEach((b) => on(b, 'click', () => onPreset(b.dataset.preset)));
    on(this.dmaButton, 'click', () => onDma(this.dmaButton.getAttribute('aria-pressed') !== 'true'));
    document.querySelectorAll('[data-part]').forEach((b) => on(b, 'click', () => onPart(b.dataset.part)));
    on($('reset-camera'), 'click', onReset);
    on($('about-open'), 'click', onAbout);
    on($('info-close'), 'click', onClose);
  }

  setActivePreset(name) {
    this.presetButtons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.preset === name)));
  }

  setDma(on) {
    this.dmaButton.setAttribute('aria-pressed', String(on));
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
    // A part of an asset says which asset it belongs to; the asset keeps its own designator.
    $('info-designator').textContent = [meta.asset, meta.designator].filter(Boolean).join(' · ');
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
    const page = $('info-page');
    page.hidden = !meta.page;
    if (meta.page) page.href = meta.page;
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
        s.className = 'stage' + (stage === place.current || place.current === null ? ' is-current' : '');
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
