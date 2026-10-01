import { STAGES } from '@axiobyte/three/domains/networking/dataplane.js';

const $ = (id) => document.getElementById(id);

/**
 * Explanation/UI layer. Pure DOM: it receives component metadata and emits
 * intents (preset, reset, action, close, mode) through callbacks.
 */
export class UI {
  constructor({ onPreset, onReset, onAction, onClose, getActionState, getPath, onMode }) {
    this.onAction = onAction;
    this.getActionState = getActionState;
    this.getPath = getPath;
    this.tooltip = $('tooltip');
    this.info = $('info');
    this.hint = $('hint');
    this.selectedMeta = null;
    this.cleanups = [];

    const on = (el, type, fn) => {
      el.addEventListener(type, fn);
      this.cleanups.push(() => el.removeEventListener(type, fn));
    };

    this.presetButtons = [...document.querySelectorAll('[data-preset]')];
    this.presetButtons.forEach((b) => on(b, 'click', () => onPreset(b.dataset.preset)));
    on($('reset-camera'), 'click', onReset);
    on($('info-close'), 'click', onClose);
    document.querySelectorAll('[data-mode]').forEach((b) =>
      on(b, 'click', () => {
        if (b.disabled || b.getAttribute('aria-pressed') === 'true') return;
        document.querySelectorAll('[data-mode]').forEach((o) => o.setAttribute('aria-pressed', String(o === b)));
        onMode?.(b.dataset.mode);
      }),
    );
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
    const maxX = window.innerWidth - w - 8;
    const nx = Math.min(x + pad, maxX);
    const ny = y + pad + h > window.innerHeight - 8 ? y - h - pad : y + pad;
    this.tooltip.style.transform = `translate(${Math.round(nx)}px, ${Math.round(ny)}px)`;
  }

  hideTooltip() {
    this.tooltip.hidden = true;
  }

  showInfo(meta) {
    this.selectedMeta = meta;
    if (!meta) {
      this.info.hidden = true;
      return;
    }
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

    const pathEl = $('info-path');
    pathEl.innerHTML = '';
    const path = this.getPath?.(meta.id);
    if (path) {
      const label = document.createElement('span');
      label.className = 'path-label';
      label.textContent = 'On the receive path';
      pathEl.append(label);
      [path.prev, path.stage, path.next].forEach((s, i) => {
        if (!s) return;
        if (i > 0 && pathEl.childElementCount > 1) pathEl.append('→');
        const chip = document.createElement('span');
        chip.className = `stage${i === 1 ? ' is-current' : ''}`;
        chip.textContent = s.name;
        chip.title = STAGES[s.key]?.summary ?? '';
        pathEl.append(chip);
      });
      pathEl.hidden = false;
    } else {
      pathEl.hidden = true;
    }

    this.renderActions();
    this.info.hidden = false;
    // restart the entrance animation
    this.info.style.animation = 'none';
    void this.info.offsetWidth;
    this.info.style.animation = '';
  }

  renderActions() {
    const box = $('info-actions');
    box.innerHTML = '';
    (this.selectedMeta?.actions ?? []).forEach((a) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn';
      const active = this.getActionState?.(a.id);
      btn.textContent = active && a.activeLabel ? a.activeLabel : a.label;
      btn.addEventListener('click', () => {
        this.onAction(a.id);
        this.renderActions();
      });
      box.append(btn);
    });
  }

  dispose() {
    this.cleanups.forEach((fn) => fn());
    this.hideTooltip();
    this.info.hidden = true;
  }
}
