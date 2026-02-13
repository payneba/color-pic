// config.js — Constants and tuning parameters

export const CONFIG = {
  // Grid limits
  MIN_GRID_DIM: 5,
  MAX_GRID_DIM: 256,
  MAX_CELLS: 65536,
  DEFAULT_CELLS: 2500,

  // Color limits
  MIN_COLORS: 4,
  MAX_COLORS: 64,
  DEFAULT_COLORS: 16,

  // Rendering
  BUFFER_CELL_SIZE: 4,        // px per cell on offscreen buffer
  MIN_ZOOM: 0.15,
  MAX_ZOOM: 8.0,
  DEFAULT_ZOOM: 1.0,
  ZOOM_STEP: 1.1,             // multiplier per scroll tick
  ZOOM_SMOOTH_FACTOR: 0.15,   // lerp factor for smooth zoom
  LABEL_MIN_ZOOM: 0.6,        // don't draw labels below this
  GRID_LINE_MIN_ZOOM: 0.3,    // don't draw grid lines below this

  // Mini-map
  MINIMAP_SIZE: 150,
  MINIMAP_SHOW_ZOOM: 1.5,
  MINIMAP_FPS: 10,

  // Undo
  UNDO_MAX_DEPTH: 200,

  // Save/Load
  MAX_SAVE_SLOTS: 5,
  AUTO_SAVE_INTERVAL: 30000,  // ms

  // Power-ups
  REVEAL_RADIUS: 5,
  REVEAL_DURATION: 10000,     // ms
  BOMB_RADIUS: 5,
  FREEZE_DURATION: 15000,     // ms
  SLOW_REVEAL_DURATION: 7000, // ms

  // Victory
  CONFETTI_COUNT: 150,
  CONFETTI_DURATION: 3000,    // ms

  // Audio
  AUDIO_ENABLED: true,

  // Streak
  STREAK_FLAME_THRESHOLD: 5,
  STREAK_SPARKLE_THRESHOLD: 10,
  STREAK_BONUS_THRESHOLD: 20,
};
