// viewport.js — Zoom, pan, coordinate transforms

import { CONFIG } from './config.js';
import { Bus } from './bus.js';
import { clamp } from './utils.js';

export const Viewport = {
  // Current transform state
  zoom: 1.0,
  panX: 0,
  panY: 0,

  // Canvas dimensions (set during init)
  canvasWidth: 0,
  canvasHeight: 0,

  // Grid dimensions in pixels at zoom 1.0
  gridPixelWidth: 0,
  gridPixelHeight: 0,

  // Cell size at zoom 1.0 (computed to fit canvas)
  cellSize: 20,

  init(gridWidth, gridHeight, canvasEl) {
    this.canvasWidth = canvasEl.width;
    this.canvasHeight = canvasEl.height;

    // Compute cell size to fit grid in canvas at zoom 1.0
    const fitW = this.canvasWidth / gridWidth;
    const fitH = this.canvasHeight / gridHeight;
    this.cellSize = Math.min(fitW, fitH);

    this.gridPixelWidth = gridWidth * this.cellSize;
    this.gridPixelHeight = gridHeight * this.cellSize;

    this.zoom = 1.0;
    // Center the grid
    this.panX = (this.canvasWidth - this.gridPixelWidth) / 2;
    this.panY = (this.canvasHeight - this.gridPixelHeight) / 2;
  },

  // Zoom centered on a canvas point (e.g., cursor position)
  zoomAt(canvasX, canvasY, factor) {
    const newZoom = clamp(this.zoom * factor, CONFIG.MIN_ZOOM, CONFIG.MAX_ZOOM);
    if (newZoom === this.zoom) return;

    // Adjust pan so the point under cursor stays fixed
    const scale = newZoom / this.zoom;
    this.panX = canvasX - (canvasX - this.panX) * scale;
    this.panY = canvasY - (canvasY - this.panY) * scale;
    this.zoom = newZoom;

    this.clampPan();
    Bus.emit('viewport:changed');
  },

  setZoom(newZoom) {
    const centerX = this.canvasWidth / 2;
    const centerY = this.canvasHeight / 2;
    this.zoomAt(centerX, centerY, newZoom / this.zoom);
  },

  pan(dx, dy) {
    this.panX += dx;
    this.panY += dy;
    this.clampPan();
    Bus.emit('viewport:changed');
  },

  clampPan() {
    const gridW = this.gridPixelWidth * this.zoom;
    const gridH = this.gridPixelHeight * this.zoom;

    // Allow panning so at least 10% of grid is visible
    const margin = 0.1;
    const minX = this.canvasWidth - gridW * (1 - margin);
    const maxX = gridW * margin - gridW + this.canvasWidth;
    const minY = this.canvasHeight - gridH * (1 - margin);
    const maxY = gridH * margin - gridH + this.canvasHeight;

    if (gridW <= this.canvasWidth) {
      // Grid fits — center it
      this.panX = (this.canvasWidth - gridW) / 2;
    } else {
      this.panX = clamp(this.panX, Math.min(minX, maxX), Math.max(minX, maxX));
    }

    if (gridH <= this.canvasHeight) {
      this.panY = (this.canvasHeight - gridH) / 2;
    } else {
      this.panY = clamp(this.panY, Math.min(minY, maxY), Math.max(minY, maxY));
    }
  },

  fitToCanvas() {
    const fitW = this.canvasWidth / this.gridPixelWidth;
    const fitH = this.canvasHeight / this.gridPixelHeight;
    this.zoom = Math.min(fitW, fitH);
    this.panX = (this.canvasWidth - this.gridPixelWidth * this.zoom) / 2;
    this.panY = (this.canvasHeight - this.gridPixelHeight * this.zoom) / 2;
    Bus.emit('viewport:changed');
  },

  // Convert canvas coordinates to grid cell (row, col)
  canvasToCell(canvasX, canvasY) {
    const gridX = (canvasX - this.panX) / this.zoom;
    const gridY = (canvasY - this.panY) / this.zoom;
    const col = Math.floor(gridX / this.cellSize);
    const row = Math.floor(gridY / this.cellSize);
    return { row, col };
  },

  // Convert grid cell to canvas coordinates (top-left of cell)
  cellToCanvas(row, col) {
    return {
      x: col * this.cellSize * this.zoom + this.panX,
      y: row * this.cellSize * this.zoom + this.panY
    };
  },

  // Get visible cell range (for culling)
  getVisibleRange(gridWidth, gridHeight) {
    const cellSizeZ = this.cellSize * this.zoom;
    const startCol = Math.max(0, Math.floor(-this.panX / cellSizeZ));
    const startRow = Math.max(0, Math.floor(-this.panY / cellSizeZ));
    const endCol = Math.min(gridWidth - 1, Math.floor((this.canvasWidth - this.panX) / cellSizeZ));
    const endRow = Math.min(gridHeight - 1, Math.floor((this.canvasHeight - this.panY) / cellSizeZ));
    return { startRow, startCol, endRow, endCol };
  },

  // Apply transform to a canvas context
  applyTransform(ctx) {
    ctx.setTransform(this.zoom, 0, 0, this.zoom, this.panX, this.panY);
  },

  resetTransform(ctx) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  },

  resize(width, height) {
    this.canvasWidth = width;
    this.canvasHeight = height;
    this.clampPan();
    Bus.emit('viewport:changed');
  }
};
