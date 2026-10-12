// storage.js — Save/load via localStorage

import { CONFIG } from './config.js';
import { Bus } from './bus.js';
import { State } from './state.js';
import { UI } from './ui.js';

const STORAGE_KEY = 'colorpic_saves';
const AUTO_SAVE_KEY = 'colorpic_autosave';

let autoSaveTimer = null;

function encodeTypedArray(arr) {
  const bytes = new Uint8Array(arr.buffer, arr.byteOffset, arr.byteLength);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function decodeToInt8Array(base64, length) {
  const binary = atob(base64);
  const arr = new Int8Array(length);
  for (let i = 0; i < binary.length && i < length; i++) {
    arr[i] = binary.charCodeAt(i) << 24 >> 24; // sign-extend
  }
  return arr;
}

function decodeToUint8Array(base64, length) {
  const binary = atob(base64);
  const arr = new Uint8Array(length);
  for (let i = 0; i < binary.length && i < length; i++) {
    arr[i] = binary.charCodeAt(i);
  }
  return arr;
}

export const Storage = {
  init() {
    Bus.on('action:save', () => this.saveToSlot());
    Bus.on('state:init', () => this.startAutoSave());
    Bus.on('state:reset', () => this.clearAutoSave());

    // Auto-save on page unload
    window.addEventListener('beforeunload', () => {
      if (State.targetColors && State.filledCells > 0) {
        this.autoSave();
      }
    });
  },

  startAutoSave() {
    this.stopAutoSave();
    autoSaveTimer = setInterval(() => {
      if (State.targetColors && State.filledCells > 0) {
        this.autoSave();
      }
    }, CONFIG.AUTO_SAVE_INTERVAL);
  },

  stopAutoSave() {
    if (autoSaveTimer) {
      clearInterval(autoSaveTimer);
      autoSaveTimer = null;
    }
  },

  serialize() {
    return {
      version: 1,
      gridWidth: State.gridWidth,
      gridHeight: State.gridHeight,
      palette: State.palette,
      targetColors: encodeTypedArray(State.targetColors),
      currentColors: encodeTypedArray(State.currentColors),
      filledCells: State.filledCells,
      startTime: State.startTime,
      date: Date.now(),
      progress: State.totalCells > 0
        ? Math.round((State.filledCells / State.totalCells) * 100)
        : 0
    };
  },

  deserialize(data) {
    if (!data || data.version !== 1) return false;

    const totalCells = data.gridWidth * data.gridHeight;
    State.gridWidth = data.gridWidth;
    State.gridHeight = data.gridHeight;
    State.totalCells = totalCells;
    State.palette = data.palette;
    State.paletteHex = data.palette.map(([r, g, b]) => {
      const toHex = n => {
        const hex = Math.round(n).toString(16);
        return hex.length === 1 ? '0' + hex : hex;
      };
      return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
    });

    State.targetColors = decodeToUint8Array(data.targetColors, totalCells);
    State.currentColors = decodeToInt8Array(data.currentColors, totalCells);
    State.filledCells = data.filledCells || 0;
    State.startTime = data.startTime || Date.now();
    State.isComplete = State.filledCells === totalCells;
    State.selectedColorIndex = -1;
    State.activePowerUp = null;

    return true;
  },

  autoSave() {
    try {
      const data = this.serialize();
      localStorage.setItem(AUTO_SAVE_KEY, JSON.stringify(data));
    } catch (e) {
      // localStorage full or unavailable
    }
  },

  clearAutoSave() {
    try {
      localStorage.removeItem(AUTO_SAVE_KEY);
    } catch (e) {}
  },

  hasAutoSave() {
    try {
      return localStorage.getItem(AUTO_SAVE_KEY) !== null;
    } catch (e) {
      return false;
    }
  },

  loadAutoSave() {
    try {
      const raw = localStorage.getItem(AUTO_SAVE_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  },

  saveToSlot(name) {
    try {
      const saves = this.getSaves();
      const data = this.serialize();
      data.name = name || `Save ${new Date().toLocaleString()}`;

      // Add to front, cap at max slots
      saves.unshift(data);
      while (saves.length > CONFIG.MAX_SAVE_SLOTS) {
        saves.pop();
      }

      localStorage.setItem(STORAGE_KEY, JSON.stringify(saves));
      UI.toast('Game saved!', 'success');
      Bus.emit('saves:changed');
    } catch (e) {
      UI.toast('Failed to save: ' + e.message, 'error');
    }
  },

  getSaves() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      return JSON.parse(raw);
    } catch (e) {
      return [];
    }
  },

  loadSlot(index) {
    const saves = this.getSaves();
    if (index >= 0 && index < saves.length) {
      return saves[index];
    }
    return null;
  },

  deleteSlot(index) {
    try {
      const saves = this.getSaves();
      if (index >= 0 && index < saves.length) {
        saves.splice(index, 1);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(saves));
        Bus.emit('saves:changed');
      }
    } catch (e) {}
  }
};
