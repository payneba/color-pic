// undo.js — Undo/redo stack with batch support

import { CONFIG } from './config.js';
import { Bus } from './bus.js';
import { State } from './state.js';
import { Renderer } from './renderer.js';

// Stack entries: { cells: [{row, col, prev, next}] }
const undoStack = [];
const redoStack = [];

export const Undo = {
  init() {
    Bus.on('stroke:end', ({ cells }) => {
      if (cells.length > 0) {
        this.push(cells.map(c => ({
          row: c.row,
          col: c.col,
          prev: -1,
          next: c.colorIndex
        })));
      }
    });

    Bus.on('action:undo', () => this.undo());
    Bus.on('action:redo', () => this.redo());
    Bus.on('state:init', () => this.clear());
    Bus.on('state:reset', () => this.clear());
  },

  // Push a batch of cell changes
  push(cells) {
    if (cells.length === 0) return;

    undoStack.push({ cells });
    redoStack.length = 0; // clear redo on new action

    // Trim to max depth
    while (undoStack.length > CONFIG.UNDO_MAX_DEPTH) {
      undoStack.shift();
    }

    Bus.emit('undo:changed', { canUndo: undoStack.length > 0, canRedo: false });
  },

  // Push a batch from power-up (explicit prev/next values)
  pushBatch(cells) {
    this.push(cells);
  },

  undo() {
    if (undoStack.length === 0) return;

    const entry = undoStack.pop();
    const redoCells = [];
    const changedIndices = [];

    for (const c of entry.cells) {
      const idx = State.cellIndex(c.row, c.col);
      const current = State.currentColors[idx];
      redoCells.push({ row: c.row, col: c.col, prev: current, next: c.prev });

      State.setCellColor(c.row, c.col, c.prev);
      changedIndices.push(idx);
    }

    redoStack.push({ cells: redoCells });

    Bus.emit('cells:batch-changed', { indices: changedIndices });
    Bus.emit('undo:changed', {
      canUndo: undoStack.length > 0,
      canRedo: redoStack.length > 0
    });
  },

  redo() {
    if (redoStack.length === 0) return;

    const entry = redoStack.pop();
    const undoCells = [];
    const changedIndices = [];

    for (const c of entry.cells) {
      const idx = State.cellIndex(c.row, c.col);
      const current = State.currentColors[idx];
      undoCells.push({ row: c.row, col: c.col, prev: current, next: c.next });

      State.setCellColor(c.row, c.col, c.next);
      changedIndices.push(idx);
    }

    undoStack.push({ cells: undoCells });

    Bus.emit('cells:batch-changed', { indices: changedIndices });
    Bus.emit('undo:changed', {
      canUndo: undoStack.length > 0,
      canRedo: redoStack.length > 0
    });
  },

  clear() {
    undoStack.length = 0;
    redoStack.length = 0;
    Bus.emit('undo:changed', { canUndo: false, canRedo: false });
  },

  canUndo() { return undoStack.length > 0; },
  canRedo() { return redoStack.length > 0; }
};
