// powerups.js — Power-up system (definitions, economy, activation)

import { CONFIG } from './config.js';
import { Bus } from './bus.js';
import { State } from './state.js';
import { Renderer } from './renderer.js';
import { Undo } from './undo.js';
import { UI } from './ui.js';

const powerups = {
  reveal: { name: 'Reveal', icon: 'eye', charges: 1, description: 'Hover shows correct colors in 5x5 radius (10s)' },
  bomb: { name: 'Bomb', icon: 'boom', charges: 0, description: 'Fill matching cells within radius 5' },
  autofill: { name: 'Auto-Fill', icon: 'fill', charges: 0, description: 'Fill ALL remaining cells of selected color' },
  freeze: { name: 'Freeze', icon: 'ice', charges: 1, description: 'Highlights matching cells for 15s' },
  slowReveal: { name: 'Preview', icon: 'play', charges: 1, description: 'Cinematic preview of solution' },
};

let streak = 0;
let revealActive = false;
let revealTimer = null;
let freezeActive = false;
let freezeTimer = null;
let freezeColorIndex = -1;
let slowRevealActive = false;
let slowRevealCancel = false;
let toolbarEl = null;
let sectionEl = null;
let streakEl = null;

export const PowerUps = {
  init(toolbarElement, sectionElement, streakElement) {
    toolbarEl = toolbarElement;
    sectionEl = sectionElement;
    streakEl = streakElement;

    Bus.on('state:init', () => this.reset());
    Bus.on('state:reset', () => this.reset());
    Bus.on('cell:painted', () => this.onCellPainted());
    Bus.on('cell:wrong', () => this.onCellWrong());
    Bus.on('progress:milestone', ({ percent }) => this.onMilestone(percent));
    Bus.on('powerup:click', ({ row, col }) => this.onPowerupClick(row, col));
    Bus.on('canvas:hover', ({ row, col }) => this.onHover(row, col));
  },

  reset() {
    powerups.reveal.charges = 1;
    powerups.bomb.charges = 0;
    powerups.autofill.charges = 0;
    powerups.freeze.charges = 1;
    powerups.slowReveal.charges = 1;
    streak = 0;
    revealActive = false;
    freezeActive = false;
    slowRevealActive = false;
    State.activePowerUp = null;

    this.buildToolbar();
    this.updateStreak();
  },

  buildToolbar() {
    if (!toolbarEl) return;
    toolbarEl.innerHTML = '';
    sectionEl.style.display = '';

    for (const [key, pu] of Object.entries(powerups)) {
      const btn = document.createElement('button');
      btn.className = 'powerup-btn';
      btn.dataset.powerup = key;
      btn.title = pu.description;
      btn.textContent = pu.name;

      const badge = document.createElement('span');
      badge.className = 'powerup-badge';
      badge.textContent = pu.charges.toString();
      btn.appendChild(badge);

      btn.addEventListener('click', () => this.activate(key));
      toolbarEl.appendChild(btn);
    }

    this.updateToolbar();
  },

  updateToolbar() {
    if (!toolbarEl) return;

    for (const btn of toolbarEl.querySelectorAll('.powerup-btn')) {
      const key = btn.dataset.powerup;
      const pu = powerups[key];
      const badge = btn.querySelector('.powerup-badge');
      badge.textContent = pu.charges.toString();
      btn.disabled = pu.charges <= 0;
      btn.classList.toggle('active', State.activePowerUp === key);
    }
  },

  activate(key) {
    const pu = powerups[key];
    if (pu.charges <= 0) return;

    if (State.activePowerUp === key) {
      State.activePowerUp = null;
      this.deactivateAll();
      this.updateToolbar();
      return;
    }

    this.deactivateAll();

    switch (key) {
      case 'reveal':
        this.activateReveal();
        break;
      case 'bomb':
        State.activePowerUp = 'bomb';
        UI.toast('Click a cell to fill matching neighbors!', 'info');
        break;
      case 'autofill':
        this.activateAutoFill();
        break;
      case 'freeze':
        this.activateFreeze();
        break;
      case 'slowReveal':
        this.activateSlowReveal();
        break;
    }

    this.updateToolbar();
  },

  deactivateAll() {
    if (revealTimer) { clearTimeout(revealTimer); revealTimer = null; }
    if (freezeTimer) { clearTimeout(freezeTimer); freezeTimer = null; }
    revealActive = false;
    freezeActive = false;
    slowRevealCancel = true;
    State.activePowerUp = null;
    Renderer.clearOverlay();
  },

  // Reveal Lens: show correct colors in 5x5 radius while hovering
  activateReveal() {
    powerups.reveal.charges--;
    State.activePowerUp = 'reveal';
    revealActive = true;
    UI.toast('Reveal Lens active! Hover to see colors (10s)', 'info');

    revealTimer = setTimeout(() => {
      revealActive = false;
      State.activePowerUp = null;
      Renderer.clearOverlay();
      this.updateToolbar();
      UI.toast('Reveal Lens expired', 'info');
    }, CONFIG.REVEAL_DURATION);
  },

  onHover(row, col) {
    if (!revealActive) return;
    if (row < 0 || row >= State.gridHeight || col < 0 || col >= State.gridWidth) return;

    const radius = CONFIG.REVEAL_RADIUS;
    const cells = [];
    for (let r = row - radius; r <= row + radius; r++) {
      for (let c = col - radius; c <= col + radius; c++) {
        if (r < 0 || r >= State.gridHeight || c < 0 || c >= State.gridWidth) continue;
        const idx = State.cellIndex(r, c);
        if (State.currentColors[idx] === -1) {
          cells.push({ row: r, col: c, colorIndex: State.targetColors[idx] });
        }
      }
    }
    Renderer.showOverlay(cells);
  },

  // Color Bomb: fill matching cells within radius
  onPowerupClick(row, col) {
    if (State.activePowerUp === 'bomb') {
      this.executeBomb(row, col);
    }
  },

  executeBomb(row, col) {
    if (State.selectedColorIndex === -1) {
      UI.toast('Select a color first!', 'warning');
      return;
    }

    powerups.bomb.charges--;
    const radius = CONFIG.BOMB_RADIUS;
    const undoCells = [];
    const changedIndices = [];

    for (let r = row - radius; r <= row + radius; r++) {
      for (let c = col - radius; c <= col + radius; c++) {
        if (r < 0 || r >= State.gridHeight || c < 0 || c >= State.gridWidth) continue;
        const dx = r - row, dy = c - col;
        if (dx * dx + dy * dy > radius * radius) continue;

        const idx = State.cellIndex(r, c);
        if (State.currentColors[idx] === -1 && State.targetColors[idx] === State.selectedColorIndex) {
          undoCells.push({ row: r, col: c, prev: -1, next: State.selectedColorIndex });
          State.setCellColor(r, c, State.selectedColorIndex);
          changedIndices.push(idx);
        }
      }
    }

    if (undoCells.length > 0) {
      Undo.pushBatch(undoCells);
      Bus.emit('cells:batch-changed', { indices: changedIndices });
      UI.toast(`Bomb filled ${undoCells.length} cells!`, 'success');
    } else {
      UI.toast('No matching cells in range', 'info');
      powerups.bomb.charges++; // refund
    }

    State.activePowerUp = null;
    this.updateToolbar();
  },

  // Auto-Fill: fill ALL remaining cells of selected color
  activateAutoFill() {
    if (State.selectedColorIndex === -1) {
      UI.toast('Select a color first!', 'warning');
      return;
    }

    powerups.autofill.charges--;
    const colorIdx = State.selectedColorIndex;
    const undoCells = [];
    const changedIndices = [];

    for (let i = 0; i < State.totalCells; i++) {
      if (State.currentColors[i] === -1 && State.targetColors[i] === colorIdx) {
        const col = i % State.gridWidth;
        const row = (i - col) / State.gridWidth;
        undoCells.push({ row, col, prev: -1, next: colorIdx });
        State.setCellColor(row, col, colorIdx);
        changedIndices.push(i);
      }
    }

    if (undoCells.length > 0) {
      Undo.pushBatch(undoCells);
      Bus.emit('cells:batch-changed', { indices: changedIndices });
      UI.toast(`Auto-filled ${undoCells.length} cells!`, 'success');
    } else {
      UI.toast('No remaining cells of this color', 'info');
      powerups.autofill.charges++; // refund
    }

    State.activePowerUp = null;
    this.updateToolbar();
  },

  // Color Freeze: highlight matching cells
  activateFreeze() {
    if (State.selectedColorIndex === -1) {
      UI.toast('Select a color first!', 'warning');
      return;
    }

    powerups.freeze.charges--;
    freezeActive = true;
    freezeColorIndex = State.selectedColorIndex;
    State.activePowerUp = 'freeze';

    // Highlight all cells of this color
    const cells = [];
    for (let i = 0; i < State.totalCells; i++) {
      if (State.currentColors[i] === -1 && State.targetColors[i] === freezeColorIndex) {
        const col = i % State.gridWidth;
        const row = (i - col) / State.gridWidth;
        cells.push({ row, col, colorIndex: freezeColorIndex });
      }
    }
    Renderer.showOverlay(cells, 'pulse');

    UI.toast(`Freeze active! Matching cells highlighted (15s)`, 'info');

    freezeTimer = setTimeout(() => {
      freezeActive = false;
      State.activePowerUp = null;
      Renderer.clearOverlay();
      this.updateToolbar();
      UI.toast('Freeze expired', 'info');
    }, CONFIG.FREEZE_DURATION);
  },

  // Slow Reveal: cinematic preview
  async activateSlowReveal() {
    powerups.slowReveal.charges--;
    slowRevealActive = true;
    slowRevealCancel = false;
    State.activePowerUp = 'slowReveal';
    this.updateToolbar();

    UI.toast('Preview playing... click to stop', 'info');

    const totalCells = State.totalCells;
    const revealOrder = [];
    for (let i = 0; i < totalCells; i++) {
      if (State.currentColors[i] === -1) {
        revealOrder.push(i);
      }
    }

    // Shuffle for cinematic effect
    for (let i = revealOrder.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [revealOrder[i], revealOrder[j]] = [revealOrder[j], revealOrder[i]];
    }

    const batchSize = Math.max(1, Math.floor(revealOrder.length / 100));
    const delayMs = CONFIG.SLOW_REVEAL_DURATION / (revealOrder.length / batchSize);

    const cells = [];
    for (let i = 0; i < revealOrder.length && !slowRevealCancel; i += batchSize) {
      const batch = [];
      for (let j = i; j < Math.min(i + batchSize, revealOrder.length); j++) {
        const idx = revealOrder[j];
        const col = idx % State.gridWidth;
        const row = (idx - col) / State.gridWidth;
        batch.push({ row, col, colorIndex: State.targetColors[idx] });
      }
      cells.push(...batch);
      Renderer.showOverlay(cells);
      await new Promise(r => setTimeout(r, delayMs));
    }

    // Clean up
    Renderer.clearOverlay();
    slowRevealActive = false;
    State.activePowerUp = null;
    this.updateToolbar();
  },

  // Streak tracking
  onCellPainted() {
    streak++;
    this.updateStreak();

    if (streak === CONFIG.STREAK_BONUS_THRESHOLD) {
      powerups.reveal.charges++;
      UI.toast('Streak bonus! +1 Reveal charge!', 'success');
      this.updateToolbar();
    }
  },

  onCellWrong() {
    streak = 0;
    this.updateStreak();
  },

  updateStreak() {
    if (!streakEl) return;
    if (streak === 0) {
      streakEl.textContent = '';
      streakEl.className = 'streak-display';
      return;
    }

    if (streak >= CONFIG.STREAK_SPARKLE_THRESHOLD) {
      streakEl.textContent = `Streak: ${streak} ✨`;
      streakEl.className = 'streak-display sparkle';
    } else if (streak >= CONFIG.STREAK_FLAME_THRESHOLD) {
      streakEl.textContent = `Streak: ${streak} 🔥`;
      streakEl.className = 'streak-display flame';
    } else {
      streakEl.textContent = `Streak: ${streak}`;
      streakEl.className = 'streak-display';
    }
  },

  // Milestone rewards
  onMilestone(percent) {
    // Reveal: +1 per 10%
    if (percent % 10 === 0) {
      powerups.reveal.charges++;
    }

    // Bomb: +1 per 20%
    if (percent % 20 === 0) {
      powerups.bomb.charges++;
      UI.toast('+1 Bomb charge!', 'success');
    }

    // Auto-fill: +1 at 50% and 75%
    if (percent === 50 || percent === 75) {
      powerups.autofill.charges++;
      UI.toast('+1 Auto-Fill charge!', 'success');
    }

    // Freeze: +1 per 15%
    if (percent % 15 === 0) {
      powerups.freeze.charges++;
    }

    // Slow Reveal: +1 at 25%
    if (percent === 25) {
      powerups.slowReveal.charges++;
    }

    this.updateToolbar();
  }
};
