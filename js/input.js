// input.js — Mouse, touch, keyboard, drag-drop input handling

import { CONFIG } from './config.js';
import { Bus } from './bus.js';
import { State } from './state.js';
import { Viewport } from './viewport.js';
import { bresenhamLine } from './utils.js';

let canvas = null;
let isPainting = false;
let isPanning = false;
let spaceHeld = false;
let lastPaintCell = null;  // { row, col }
let lastPanPos = null;     // { x, y }
let strokeCells = [];      // cells painted in current stroke

export const Input = {
  init(canvasEl) {
    canvas = canvasEl;

    // Mouse events
    canvas.addEventListener('mousedown', this.onMouseDown.bind(this));
    canvas.addEventListener('mousemove', this.onMouseMove.bind(this));
    canvas.addEventListener('mouseup', this.onMouseUp.bind(this));
    canvas.addEventListener('mouseleave', this.onMouseUp.bind(this));
    canvas.addEventListener('wheel', this.onWheel.bind(this), { passive: false });

    // Context menu
    canvas.addEventListener('contextmenu', e => e.preventDefault());

    // Keyboard
    window.addEventListener('keydown', this.onKeyDown.bind(this));
    window.addEventListener('keyup', this.onKeyUp.bind(this));

    // Touch events
    canvas.addEventListener('touchstart', this.onTouchStart.bind(this), { passive: false });
    canvas.addEventListener('touchmove', this.onTouchMove.bind(this), { passive: false });
    canvas.addEventListener('touchend', this.onTouchEnd.bind(this));
    canvas.addEventListener('touchcancel', this.onTouchEnd.bind(this));
  },

  getCanvasPos(e) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (canvas.width / rect.width),
      y: (e.clientY - rect.top) * (canvas.height / rect.height)
    };
  },

  onMouseDown(e) {
    if (!State.targetColors) return;

    const pos = this.getCanvasPos(e);

    // Middle mouse or space+left = pan
    if (e.button === 1 || (e.button === 0 && spaceHeld)) {
      isPanning = true;
      lastPanPos = pos;
      canvas.style.cursor = 'grabbing';
      e.preventDefault();
      return;
    }

    if (e.button !== 0) return;

    // Check for active power-up click handling
    if (State.activePowerUp) {
      const cell = Viewport.canvasToCell(pos.x, pos.y);
      if (cell.row >= 0 && cell.row < State.gridHeight &&
          cell.col >= 0 && cell.col < State.gridWidth) {
        Bus.emit('powerup:click', { row: cell.row, col: cell.col });
      }
      return;
    }

    // Left click = paint
    isPainting = true;
    strokeCells = [];
    lastPaintCell = null;

    const cell = Viewport.canvasToCell(pos.x, pos.y);
    this.tryPaintCell(cell.row, cell.col);
  },

  onMouseMove(e) {
    if (!State.targetColors) return;

    const pos = this.getCanvasPos(e);

    if (isPanning) {
      const dx = pos.x - lastPanPos.x;
      const dy = pos.y - lastPanPos.y;
      Viewport.pan(dx, dy);
      lastPanPos = pos;
      return;
    }

    // Emit hover for power-ups (reveal lens)
    const cell = Viewport.canvasToCell(pos.x, pos.y);
    Bus.emit('canvas:hover', { row: cell.row, col: cell.col, canvasX: pos.x, canvasY: pos.y });

    if (!isPainting) return;

    // Bresenham interpolation for smooth painting
    if (lastPaintCell) {
      const points = bresenhamLine(lastPaintCell.col, lastPaintCell.row, cell.col, cell.row);
      for (const [c, r] of points) {
        this.tryPaintCell(r, c);
      }
    } else {
      this.tryPaintCell(cell.row, cell.col);
    }
  },

  onMouseUp(e) {
    if (isPanning) {
      isPanning = false;
      canvas.style.cursor = spaceHeld ? 'grab' : 'crosshair';
      return;
    }

    if (isPainting && strokeCells.length > 0) {
      Bus.emit('stroke:end', { cells: strokeCells });
    }
    isPainting = false;
    lastPaintCell = null;
    strokeCells = [];
  },

  tryPaintCell(row, col) {
    if (row < 0 || row >= State.gridHeight || col < 0 || col >= State.gridWidth) return;
    if (State.selectedColorIndex === -1) return;

    const idx = State.cellIndex(row, col);

    // Skip if already painted
    if (State.currentColors[idx] !== -1) {
      lastPaintCell = { row, col };
      return;
    }

    // Check if correct color
    if (State.targetColors[idx] === State.selectedColorIndex) {
      State.paintCell(row, col, State.selectedColorIndex);
      strokeCells.push({ row, col, colorIndex: State.selectedColorIndex });
    } else {
      Bus.emit('cell:wrong', { row, col, expected: State.targetColors[idx], attempted: State.selectedColorIndex });
    }

    lastPaintCell = { row, col };
  },

  onWheel(e) {
    if (!State.targetColors) return;
    e.preventDefault();

    const pos = this.getCanvasPos(e);
    const factor = e.deltaY < 0 ? CONFIG.ZOOM_STEP : 1 / CONFIG.ZOOM_STEP;
    Viewport.zoomAt(pos.x, pos.y, factor);
  },

  onKeyDown(e) {
    if (e.code === 'Space' && !spaceHeld) {
      spaceHeld = true;
      if (!isPainting) canvas.style.cursor = 'grab';
      e.preventDefault();
    }

    // Number keys for color selection (1-9, 0 for 10)
    if (!e.ctrlKey && !e.metaKey && !e.altKey) {
      const num = e.key >= '0' && e.key <= '9' ? (e.key === '0' ? 10 : parseInt(e.key)) : -1;
      if (num > 0) {
        const offset = e.shiftKey ? 10 : 0;
        const index = num - 1 + offset;
        if (index < State.palette.length) {
          State.selectColor(index);
        }
        e.preventDefault();
        return;
      }
    }

    // Keyboard shortcuts
    if (e.ctrlKey || e.metaKey) {
      if (e.key === 'z' || e.key === 'Z') {
        if (e.shiftKey) Bus.emit('action:redo');
        else Bus.emit('action:undo');
        e.preventDefault();
      } else if (e.key === 'y' || e.key === 'Y') {
        Bus.emit('action:redo');
        e.preventDefault();
      } else if (e.key === 's' || e.key === 'S') {
        Bus.emit('action:save');
        e.preventDefault();
      }
    }

    if (e.key === '+' || e.key === '=') {
      Viewport.setZoom(Viewport.zoom * CONFIG.ZOOM_STEP);
      e.preventDefault();
    } else if (e.key === '-' || e.key === '_') {
      Viewport.setZoom(Viewport.zoom / CONFIG.ZOOM_STEP);
      e.preventDefault();
    } else if (e.key === 'f' || e.key === 'F') {
      if (!e.ctrlKey && !e.metaKey) {
        Viewport.fitToCanvas();
        e.preventDefault();
      }
    } else if (e.key === 'h' || e.key === 'H') {
      if (!e.ctrlKey && !e.metaKey) {
        Bus.emit('action:toggleHint');
        e.preventDefault();
      }
    } else if (e.key === 'm' || e.key === 'M') {
      if (!e.ctrlKey && !e.metaKey) {
        Bus.emit('action:toggleMinimap');
        e.preventDefault();
      }
    } else if (e.key === 'd' || e.key === 'D') {
      if (!e.ctrlKey && !e.metaKey) {
        Bus.emit('action:toggleDarkMode');
        e.preventDefault();
      }
    } else if (e.key === '?') {
      Bus.emit('action:showHelp');
      e.preventDefault();
    }
  },

  onKeyUp(e) {
    if (e.code === 'Space') {
      spaceHeld = false;
      canvas.style.cursor = 'crosshair';
    }
  },

  // Touch handling
  activeTouches: new Map(),
  lastPinchDist: 0,
  touchMode: 'none', // 'none', 'paint', 'pan', 'pinch'

  onTouchStart(e) {
    if (!State.targetColors) return;
    e.preventDefault();

    for (const touch of e.changedTouches) {
      this.activeTouches.set(touch.identifier, {
        x: touch.clientX, y: touch.clientY,
        startX: touch.clientX, startY: touch.clientY
      });
    }

    if (this.activeTouches.size === 1) {
      this.touchMode = 'paint';
      const touch = e.changedTouches[0];
      const pos = this.getTouchCanvasPos(touch);
      const cell = Viewport.canvasToCell(pos.x, pos.y);

      isPainting = true;
      strokeCells = [];
      lastPaintCell = null;
      this.tryPaintCell(cell.row, cell.col);
    } else if (this.activeTouches.size === 2) {
      // Switch to pinch/pan
      this.touchMode = 'pinch';
      isPainting = false;
      if (strokeCells.length > 0) {
        Bus.emit('stroke:end', { cells: strokeCells });
        strokeCells = [];
      }
      this.lastPinchDist = this.getPinchDistance();
    }
  },

  onTouchMove(e) {
    if (!State.targetColors) return;
    e.preventDefault();

    for (const touch of e.changedTouches) {
      this.activeTouches.set(touch.identifier, {
        x: touch.clientX, y: touch.clientY,
        startX: this.activeTouches.get(touch.identifier)?.startX ?? touch.clientX,
        startY: this.activeTouches.get(touch.identifier)?.startY ?? touch.clientY
      });
    }

    if (this.touchMode === 'paint' && this.activeTouches.size === 1) {
      const touch = e.changedTouches[0];
      const pos = this.getTouchCanvasPos(touch);
      const cell = Viewport.canvasToCell(pos.x, pos.y);

      if (lastPaintCell) {
        const points = bresenhamLine(lastPaintCell.col, lastPaintCell.row, cell.col, cell.row);
        for (const [c, r] of points) {
          this.tryPaintCell(r, c);
        }
      } else {
        this.tryPaintCell(cell.row, cell.col);
      }
    } else if (this.touchMode === 'pinch' && this.activeTouches.size === 2) {
      const touches = Array.from(this.activeTouches.values());
      const centerX = (touches[0].x + touches[1].x) / 2;
      const centerY = (touches[0].y + touches[1].y) / 2;
      const rect = canvas.getBoundingClientRect();
      const canvasCenterX = (centerX - rect.left) * (canvas.width / rect.width);
      const canvasCenterY = (centerY - rect.top) * (canvas.height / rect.height);

      const dist = this.getPinchDistance();
      if (this.lastPinchDist > 0) {
        const factor = dist / this.lastPinchDist;
        Viewport.zoomAt(canvasCenterX, canvasCenterY, factor);

        // Also handle two-finger pan
        // (pan is implicit via zoomAt center adjustment)
      }
      this.lastPinchDist = dist;
    }
  },

  onTouchEnd(e) {
    for (const touch of e.changedTouches) {
      this.activeTouches.delete(touch.identifier);
    }

    if (this.activeTouches.size === 0) {
      if (this.touchMode === 'paint' && strokeCells.length > 0) {
        Bus.emit('stroke:end', { cells: strokeCells });
      }
      isPainting = false;
      this.touchMode = 'none';
      lastPaintCell = null;
      strokeCells = [];
    } else if (this.activeTouches.size === 1) {
      this.touchMode = 'pan';
    }
  },

  getTouchCanvasPos(touch) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (touch.clientX - rect.left) * (canvas.width / rect.width),
      y: (touch.clientY - rect.top) * (canvas.height / rect.height)
    };
  },

  getPinchDistance() {
    const touches = Array.from(this.activeTouches.values());
    if (touches.length < 2) return 0;
    const dx = touches[0].x - touches[1].x;
    const dy = touches[0].y - touches[1].y;
    return Math.sqrt(dx * dx + dy * dy);
  }
};
