import { W, H } from './overlay/theme.js';

/**
 * Flattens the frame: background, the WebGL render, then the 2D overlay.
 *
 * The WebGL canvas is transparent and may be supersampled (a 3840x2160 backing
 * store downscaled here), which is where most of the edge quality in the final
 * file comes from. Nothing else ever touches these pixels, so whatever the
 * compositor produces is exactly what ffmpeg encodes.
 */
export class Compositor {
  constructor({ width = W, height = H } = {}) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = width;
    this.canvas.height = height;
    this.ctx = this.canvas.getContext('2d', { alpha: false });
    this.ctx.imageSmoothingEnabled = true;
    this.ctx.imageSmoothingQuality = 'high';
    this.width = width;
    this.height = height;
    this._bg = null;
  }

  background() {
    if (this._bg) return this._bg;
    const g = this.ctx.createRadialGradient(this.width * 0.5, this.height * 0.36, 0, this.width * 0.5, this.height * 0.36, this.width * 0.72);
    g.addColorStop(0, '#242B34');
    g.addColorStop(0.55, '#171B21');
    g.addColorStop(1, '#0B0E12');
    this._bg = g;
    return g;
  }

  compose(threeCanvas, overlayCanvas) {
    const ctx = this.ctx;
    ctx.fillStyle = this.background();
    ctx.fillRect(0, 0, this.width, this.height);
    ctx.drawImage(threeCanvas, 0, 0, this.width, this.height);
    if (overlayCanvas) ctx.drawImage(overlayCanvas, 0, 0, this.width, this.height);
    return this.canvas;
  }
}
