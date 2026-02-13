// renderer.js — Canvas rendering pipeline with dirty tracking and compositing

import { CONFIG } from './config.js';
import { Bus } from './bus.js';
import { State } from './state.js';
import { Viewport } from './viewport.js';
import { getContrastColor } from './utils.js';

// Dirty cell tracking
const dirtyCells = new Set();
let fullRedrawNeeded = true;
let needsRedraw = true;

// Offscreen buffer
let bufferCanvas = null;
let bufferCtx = null;

// Main canvas
let mainCanvas = null;
let mainCtx = null;

// Hint/solution overlay
let showingSolution = false;

// Selected color for highlighting matching cells
let selectedColorIndex = -1;

// Power-up overlay cells: [{row, col, colorIndex}]
let overlayCells = [];
let overlayStyle = 'solid'; // 'solid' or 'pulse'
let overlayPulsePhase = 0;

export const Renderer = {
  init(canvas) {
    mainCanvas = canvas;
    mainCtx = canvas.getContext('2d');

    // Create offscreen buffer
    bufferCanvas = document.createElement('canvas');
    bufferCtx = bufferCanvas.getContext('2d');

    // Listen for events that trigger redraws
    Bus.on('state:init', () => this.onStateInit());
    Bus.on('state:reset', () => this.requestFullRedraw());
    Bus.on('cell:painted', ({ idx }) => this.markDirty(idx));
    Bus.on('viewport:changed', () => this.requestRedraw());
    Bus.on('cells:batch-changed', ({ indices }) => {
      for (const idx of indices) this.markDirty(idx);
    });
    Bus.on('color:selected', ({ index }) => {
      selectedColorIndex = index;
      this.requestFullRedraw();
    });

    this.startLoop();
  },

  onStateInit() {
    // Size the buffer: each cell gets BUFFER_CELL_SIZE pixels
    const bcs = CONFIG.BUFFER_CELL_SIZE;
    bufferCanvas.width = State.gridWidth * bcs;
    bufferCanvas.height = State.gridHeight * bcs;
    this.requestFullRedraw();
  },

  markDirty(cellIndex) {
    dirtyCells.add(cellIndex);
    needsRedraw = true;
  },

  requestRedraw() {
    needsRedraw = true;
  },

  requestFullRedraw() {
    fullRedrawNeeded = true;
    needsRedraw = true;
  },

  setShowingSolution(show) {
    showingSolution = show;
    this.requestFullRedraw();
  },

  // Rendering loop
  startLoop() {
    const loop = () => {
      if (needsRedraw) {
        this.render();
        needsRedraw = false;
      }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  },

  render() {
    if (!State.targetColors) return;

    // Update offscreen buffer (dirty cells or full redraw)
    if (fullRedrawNeeded) {
      this.renderBufferFull();
      fullRedrawNeeded = false;
      dirtyCells.clear();
    } else if (dirtyCells.size > 0) {
      this.renderBufferDirty();
      dirtyCells.clear();
    }

    // Composite to main canvas
    this.compositeToMain();
  },

  renderBufferFull() {
    const bcs = CONFIG.BUFFER_CELL_SIZE;
    const w = State.gridWidth;
    const h = State.gridHeight;
    const target = State.targetColors;
    const current = State.currentColors;
    const paletteHex = State.paletteHex;

    bufferCtx.fillStyle = '#f0f0f0';
    bufferCtx.fillRect(0, 0, bufferCanvas.width, bufferCanvas.height);

    // Color-batched rendering: group cells by color
    // First pass: unpainted cells
    // Highlight cells matching selected color in a darker gray
    const highlightSelected = !showingSolution && selectedColorIndex >= 0;
    bufferCtx.fillStyle = '#f5f5f5';
    for (let i = 0; i < w * h; i++) {
      if (current[i] === -1 && !showingSolution) {
        if (highlightSelected && target[i] === selectedColorIndex) {
          bufferCtx.fillStyle = '#d0d0d0';
        } else {
          bufferCtx.fillStyle = '#f5f5f5';
        }
        const col = i % w;
        const row = (i - col) / w;
        bufferCtx.fillRect(col * bcs, row * bcs, bcs, bcs);
      }
    }

    // Second pass: painted cells (batch by color)
    for (let ci = 0; ci < paletteHex.length; ci++) {
      bufferCtx.fillStyle = paletteHex[ci];
      for (let i = 0; i < w * h; i++) {
        const colorIdx = showingSolution ? target[i] : current[i];
        if (colorIdx === ci) {
          const col = i % w;
          const row = (i - col) / w;
          bufferCtx.fillRect(col * bcs, row * bcs, bcs, bcs);
        }
      }
    }
  },

  renderBufferDirty() {
    const bcs = CONFIG.BUFFER_CELL_SIZE;
    const w = State.gridWidth;
    const paletteHex = State.paletteHex;
    const current = State.currentColors;
    const target = State.targetColors;

    for (const idx of dirtyCells) {
      const col = idx % w;
      const row = (idx - col) / w;
      const colorIdx = showingSolution ? target[idx] : current[idx];

      if (colorIdx === -1) {
        const match = !showingSolution && selectedColorIndex >= 0 && target[idx] === selectedColorIndex;
        bufferCtx.fillStyle = match ? '#d0d0d0' : '#f5f5f5';
      } else {
        bufferCtx.fillStyle = paletteHex[colorIdx];
      }
      bufferCtx.fillRect(col * bcs, row * bcs, bcs, bcs);
    }
  },

  compositeToMain() {
    const ctx = mainCtx;
    const vp = Viewport;

    // Clear
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#e0e0e0';
    ctx.fillRect(0, 0, mainCanvas.width, mainCanvas.height);

    // Draw buffer scaled
    vp.applyTransform(ctx);
    ctx.imageSmoothingEnabled = false;

    // Scale buffer to grid pixel size
    const gridW = State.gridWidth * vp.cellSize;
    const gridH = State.gridHeight * vp.cellSize;
    ctx.drawImage(bufferCanvas, 0, 0, gridW, gridH);

    // Get visible range for overlays
    const range = vp.getVisibleRange(State.gridWidth, State.gridHeight);
    const cellSizeZ = vp.cellSize * vp.zoom;

    // Grid lines (only above minimum zoom)
    if (vp.zoom >= CONFIG.GRID_LINE_MIN_ZOOM && cellSizeZ >= 3) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.strokeStyle = showingSolution ? 'rgba(0,0,0,0.1)' : 'rgba(0,0,0,0.15)';
      ctx.lineWidth = 1;

      ctx.beginPath();
      // Horizontal lines
      for (let row = range.startRow; row <= range.endRow + 1; row++) {
        const y = Math.round(row * vp.cellSize * vp.zoom + vp.panY) + 0.5;
        const x1 = range.startCol * vp.cellSize * vp.zoom + vp.panX;
        const x2 = (range.endCol + 1) * vp.cellSize * vp.zoom + vp.panX;
        ctx.moveTo(x1, y);
        ctx.lineTo(x2, y);
      }
      // Vertical lines
      for (let col = range.startCol; col <= range.endCol + 1; col++) {
        const x = Math.round(col * vp.cellSize * vp.zoom + vp.panX) + 0.5;
        const y1 = range.startRow * vp.cellSize * vp.zoom + vp.panY;
        const y2 = (range.endRow + 1) * vp.cellSize * vp.zoom + vp.panY;
        ctx.moveTo(x, y1);
        ctx.lineTo(x, y2);
      }
      ctx.stroke();
    }

    // Number labels (only above minimum zoom and when cells are large enough)
    if (!showingSolution && vp.zoom >= CONFIG.LABEL_MIN_ZOOM && cellSizeZ >= 12) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      const fontSize = Math.max(8, Math.min(14, cellSizeZ * 0.45));
      ctx.font = `${fontSize}px Arial, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      for (let row = range.startRow; row <= range.endRow; row++) {
        for (let col = range.startCol; col <= range.endCol; col++) {
          const idx = row * State.gridWidth + col;
          if (State.currentColors[idx] !== -1) continue; // painted, no label

          const num = State.targetColors[idx] + 1;
          const cx = col * vp.cellSize * vp.zoom + vp.panX + cellSizeZ / 2;
          const cy = row * vp.cellSize * vp.zoom + vp.panY + cellSizeZ / 2;

          ctx.fillStyle = '#666666';
          ctx.fillText(num.toString(), cx, cy);
        }
      }
    }

    // Power-up overlay
    if (overlayCells.length > 0) {
      overlayPulsePhase = (overlayPulsePhase + 0.05) % (Math.PI * 2);
      const alpha = overlayStyle === 'pulse'
        ? 0.3 + Math.sin(overlayPulsePhase) * 0.3
        : 0.6;

      for (const cell of overlayCells) {
        const x = cell.col * vp.cellSize * vp.zoom + vp.panX;
        const y = cell.row * vp.cellSize * vp.zoom + vp.panY;
        const hex = State.paletteHex[cell.colorIndex];
        ctx.globalAlpha = alpha;
        ctx.fillStyle = hex;
        ctx.fillRect(x, y, cellSizeZ, cellSizeZ);

        if (overlayStyle === 'pulse') {
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2;
          ctx.strokeRect(x + 1, y + 1, cellSizeZ - 2, cellSizeZ - 2);
        }
      }
      ctx.globalAlpha = 1;

      // Keep redrawing for animation
      if (overlayStyle === 'pulse') needsRedraw = true;
    }

    ctx.setTransform(1, 0, 0, 1, 0, 0);
  },

  showOverlay(cells, style = 'solid') {
    overlayCells = cells;
    overlayStyle = style;
    needsRedraw = true;
  },

  clearOverlay() {
    overlayCells = [];
    needsRedraw = true;
  },

  getMainCanvas() {
    return mainCanvas;
  },

  getMainCtx() {
    return mainCtx;
  }
};
