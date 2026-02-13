// state.js — Central game state with typed arrays

import { Bus } from './bus.js';

export const State = {
  // Grid dimensions
  gridWidth: 0,
  gridHeight: 0,

  // Typed arrays for grid data
  // targetColors: Uint8Array — palette index for each cell
  // currentColors: Int8Array — palette index or -1 for unpainted
  targetColors: null,
  currentColors: null,

  // Palette: array of [r, g, b] arrays
  palette: [],
  // Palette as hex strings (cached for rendering)
  paletteHex: [],

  // Selected color index (-1 = none)
  selectedColorIndex: -1,

  // Game status
  totalCells: 0,
  filledCells: 0,
  startTime: 0,
  isComplete: false,

  // Active power-ups state (managed by powerups.js)
  activePowerUp: null,

  // Initialize game state from quantization result
  init(gridWidth, gridHeight, palette, targetIndices) {
    this.gridWidth = gridWidth;
    this.gridHeight = gridHeight;
    this.totalCells = gridWidth * gridHeight;
    this.filledCells = 0;
    this.isComplete = false;
    this.selectedColorIndex = -1;
    this.startTime = Date.now();
    this.activePowerUp = null;

    this.palette = palette;         // [[r,g,b], ...]
    this.paletteHex = palette.map(([r, g, b]) => {
      const toHex = n => {
        const hex = Math.round(n).toString(16);
        return hex.length === 1 ? '0' + hex : hex;
      };
      return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
    });

    this.targetColors = new Uint8Array(targetIndices);
    this.currentColors = new Int8Array(this.totalCells).fill(-1);

    Bus.emit('state:init', {
      gridWidth, gridHeight,
      palette: this.palette,
      paletteHex: this.paletteHex
    });
  },

  // Get cell index from row, col
  cellIndex(row, col) {
    return row * this.gridWidth + col;
  },

  // Paint a single cell, returns true if successful
  paintCell(row, col, colorIndex) {
    if (row < 0 || row >= this.gridHeight || col < 0 || col >= this.gridWidth) return false;
    const idx = this.cellIndex(row, col);
    if (this.currentColors[idx] !== -1) return false; // already painted
    if (this.targetColors[idx] !== colorIndex) return false; // wrong color

    this.currentColors[idx] = colorIndex;
    this.filledCells++;

    Bus.emit('cell:painted', { row, col, colorIndex, idx });

    if (this.filledCells === this.totalCells) {
      this.isComplete = true;
      Bus.emit('game:complete', {
        time: Date.now() - this.startTime,
        totalCells: this.totalCells
      });
    }

    return true;
  },

  // Force-paint a cell (for undo/power-ups), bypasses color check
  setCellColor(row, col, colorIndex) {
    const idx = this.cellIndex(row, col);
    const prev = this.currentColors[idx];
    this.currentColors[idx] = colorIndex;

    if (prev === -1 && colorIndex !== -1) this.filledCells++;
    else if (prev !== -1 && colorIndex === -1) this.filledCells--;

    return prev;
  },

  // Get remaining count per palette color
  getRemainingCounts() {
    const counts = new Uint32Array(this.palette.length);
    for (let i = 0; i < this.totalCells; i++) {
      if (this.currentColors[i] === -1) {
        counts[this.targetColors[i]]++;
      }
    }
    return counts;
  },

  // Reset all cells to unpainted
  reset() {
    this.currentColors.fill(-1);
    this.filledCells = 0;
    this.isComplete = false;
    this.selectedColorIndex = -1;
    this.startTime = Date.now();
    this.activePowerUp = null;
    Bus.emit('state:reset');
  },

  // Select a color
  selectColor(index) {
    this.selectedColorIndex = index;
    Bus.emit('color:selected', { index });
  }
};
