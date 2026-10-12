// minimap.js — Mini-map canvas overlay

import { CONFIG } from './config.js';
import { Bus } from './bus.js';
import { State } from './state.js';
import { Viewport } from './viewport.js';

let minimapCanvas = null;
let minimapCtx = null;
let container = null;
let visible = false;
let lastRedraw = 0;
let isDragging = false;

export const Minimap = {
  init(containerEl, canvasEl) {
    container = containerEl;
    minimapCanvas = canvasEl;
    minimapCtx = canvasEl.getContext('2d');

    minimapCanvas.width = CONFIG.MINIMAP_SIZE;
    minimapCanvas.height = CONFIG.MINIMAP_SIZE;

    // Click/drag to navigate
    minimapCanvas.addEventListener('mousedown', e => {
      isDragging = true;
      this.navigateTo(e);
    });
    minimapCanvas.addEventListener('mousemove', e => {
      if (isDragging) this.navigateTo(e);
    });
    minimapCanvas.addEventListener('mouseup', () => isDragging = false);
    minimapCanvas.addEventListener('mouseleave', () => isDragging = false);

    Bus.on('viewport:changed', () => this.scheduleRedraw());
    Bus.on('state:init', () => this.scheduleRedraw());
    Bus.on('state:reset', () => this.scheduleRedraw());
    Bus.on('cell:painted', () => this.scheduleRedraw());
    Bus.on('cells:batch-changed', () => this.scheduleRedraw());
    Bus.on('action:toggleMinimap', () => this.toggle());
  },

  toggle() {
    visible = !visible;
    this.updateVisibility();
  },

  updateVisibility() {
    // Show when zoom > threshold or manually toggled
    const shouldShow = visible || Viewport.zoom > CONFIG.MINIMAP_SHOW_ZOOM;
    container.classList.toggle('hidden', !shouldShow);
    if (shouldShow) this.scheduleRedraw();
  },

  scheduleRedraw() {
    const now = Date.now();
    const interval = 1000 / CONFIG.MINIMAP_FPS;
    if (now - lastRedraw < interval) return;
    lastRedraw = now;
    requestAnimationFrame(() => this.draw());
  },

  draw() {
    if (!State.targetColors || container.classList.contains('hidden')) return;

    const ctx = minimapCtx;
    const w = CONFIG.MINIMAP_SIZE;
    const h = CONFIG.MINIMAP_SIZE;
    const gw = State.gridWidth;
    const gh = State.gridHeight;

    // Fit grid into minimap
    const scale = Math.min(w / gw, h / gh);
    const offsetX = (w - gw * scale) / 2;
    const offsetY = (h - gh * scale) / 2;

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#e0e0e0';
    ctx.fillRect(0, 0, w, h);

    // Draw cells
    const imageData = ctx.createImageData(gw, gh);
    const pixels = imageData.data;

    for (let i = 0; i < gw * gh; i++) {
      const colorIdx = State.currentColors[i];
      const pi = i * 4;

      if (colorIdx === -1) {
        pixels[pi] = 200;
        pixels[pi + 1] = 200;
        pixels[pi + 2] = 200;
      } else {
        const c = State.palette[colorIdx];
        pixels[pi] = c[0];
        pixels[pi + 1] = c[1];
        pixels[pi + 2] = c[2];
      }
      pixels[pi + 3] = 255;
    }

    // Draw imageData scaled
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = gw;
    tempCanvas.height = gh;
    tempCanvas.getContext('2d').putImageData(imageData, 0, 0);

    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(tempCanvas, offsetX, offsetY, gw * scale, gh * scale);

    // Draw viewport rectangle
    const vp = Viewport;
    const cellSizeZ = vp.cellSize * vp.zoom;
    const vpLeft = -vp.panX / cellSizeZ;
    const vpTop = -vp.panY / cellSizeZ;
    const vpWidth = vp.canvasWidth / cellSizeZ;
    const vpHeight = vp.canvasHeight / cellSizeZ;

    ctx.strokeStyle = '#ff0000';
    ctx.lineWidth = 2;
    ctx.strokeRect(
      offsetX + vpLeft * scale,
      offsetY + vpTop * scale,
      vpWidth * scale,
      vpHeight * scale
    );
  },

  navigateTo(e) {
    const rect = minimapCanvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    const w = CONFIG.MINIMAP_SIZE;
    const h = CONFIG.MINIMAP_SIZE;
    const gw = State.gridWidth;
    const gh = State.gridHeight;
    const scale = Math.min(w / gw, h / gh);
    const offsetX = (w - gw * scale) / 2;
    const offsetY = (h - gh * scale) / 2;

    // Convert minimap click to grid position
    const gridX = (mx - offsetX) / scale;
    const gridY = (my - offsetY) / scale;

    // Center viewport on this grid position
    const cellSizeZ = Viewport.cellSize * Viewport.zoom;
    Viewport.panX = Viewport.canvasWidth / 2 - gridX * cellSizeZ;
    Viewport.panY = Viewport.canvasHeight / 2 - gridY * cellSizeZ;
    Viewport.clampPan();
    Bus.emit('viewport:changed');
  }
};
