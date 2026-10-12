// powerups.js — Power-up system (definitions, economy, activation)

import { CONFIG } from './config.js';
import { Bus } from './bus.js';
import { State } from './state.js';
import { Renderer } from './renderer.js';
import { Undo } from './undo.js';
import { UI } from './ui.js';

const powerups = {
  reveal: { name: 'Reveal', color: '#4a90d9', charges: 1, description: 'Hover shows correct colors in 5x5 radius (10s)' },
  bomb: { name: 'Bomb', color: '#e74c3c', charges: 0, description: 'Fill matching cells within radius 5' },
  autofill: { name: 'Auto-Fill', color: '#4caf50', charges: 0, description: 'Fill ALL remaining cells of selected color' },
  flood: { name: 'Flood', color: '#00acc1', charges: 1, description: 'Fill connected region of matching color' },
};

// SVG icon paths (viewBox 0 0 24 24)
const iconSVGs = {
  reveal: '<path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zm0 12.5c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>',
  bomb: '<circle cx="12" cy="13" r="7"/><path d="M12 6V2M14.5 4.5l2-2" stroke="white" stroke-width="1.8" stroke-linecap="round" fill="none"/><circle cx="14" cy="10" r="1.5" fill="rgba(255,255,255,0.5)"/>',
  autofill: '<path d="M16 6l-2.29-2.29a1 1 0 00-1.42 0L4 12v4h4l8.29-8.29a1 1 0 000-1.42L16 6zM6 14l6-6 2 2-6 6H6v-2z"/><path d="M2 20h20v2H2z"/>',
  flood: '<path d="M12 2c-1 3-6 7.2-6 11a6 6 0 0012 0c0-3.8-5-8-6-11z"/>',
};

let streak = 0;
let revealActive = false;
let revealTimer = null;
let barEl = null;
let streakEl = null;

// Super streak tracking: detect completing all remaining cells of a color in one streak
let streakStartRemaining = null; // Uint32Array snapshot when streak began
let powerUpColorCounts = null;   // Uint32Array — cells painted by power-ups per color (game-wide)

export const PowerUps = {
  init(barElement, streakElement) {
    barEl = barElement;
    streakEl = streakElement;

    Bus.on('state:init', () => this.reset());
    Bus.on('state:reset', () => this.reset());
    Bus.on('cell:painted', ({ colorIndex }) => this.onCellPainted(colorIndex));
    Bus.on('cell:wrong', () => this.onCellWrong());
    Bus.on('progress:milestone', ({ percent }) => this.onMilestone(percent));
    Bus.on('powerup:click', ({ row, col }) => this.onPowerupClick(row, col));
    Bus.on('canvas:hover', ({ row, col }) => this.onHover(row, col));
  },

  reset() {
    powerups.reveal.charges = 1;
    powerups.bomb.charges = 0;
    powerups.autofill.charges = 0;
    powerups.flood.charges = 1;
    streak = 0;
    revealActive = false;
    streakStartRemaining = null;
    powerUpColorCounts = new Uint32Array(State.palette.length);
    State.activePowerUp = null;

    this.buildToolbar();
    this.updateStreak();
  },

  buildToolbar() {
    if (!barEl) return;
    barEl.innerHTML = '';
    barEl.classList.add('visible');

    for (const [key, pu] of Object.entries(powerups)) {
      const btn = document.createElement('button');
      btn.className = 'powerup-icon-btn';
      btn.dataset.powerup = key;
      btn.title = pu.description;
      btn.style.background = pu.color;

      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('viewBox', '0 0 24 24');
      svg.innerHTML = iconSVGs[key];
      btn.appendChild(svg);

      const badge = document.createElement('span');
      badge.className = 'powerup-badge';
      badge.textContent = pu.charges.toString();
      btn.appendChild(badge);

      const label = document.createElement('span');
      label.className = 'powerup-label';
      label.textContent = pu.name;
      btn.appendChild(label);

      btn.addEventListener('click', () => this.activate(key));
      barEl.appendChild(btn);
    }

    this.updateToolbar();
  },

  updateToolbar() {
    if (!barEl) return;

    for (const btn of barEl.querySelectorAll('.powerup-icon-btn')) {
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
      case 'flood':
        State.activePowerUp = 'flood';
        UI.toast('Click a cell to flood-fill its connected region!', 'info');
        break;
    }

    this.updateToolbar();
  },

  deactivateAll() {
    if (revealTimer) { clearTimeout(revealTimer); revealTimer = null; }
    revealActive = false;
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
    } else if (State.activePowerUp === 'flood') {
      this.executeFlood(row, col);
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
      powerUpColorCounts[State.selectedColorIndex] += undoCells.length;
      UI.toast(`Bomb filled ${undoCells.length} cells!`, 'success');
    } else {
      UI.toast('No matching cells in range', 'info');
      powerups.bomb.charges++; // refund
    }

    State.activePowerUp = null;
    this.updateToolbar();
  },

  // Flood Fill: BFS from clicked cell, fill connected region of same target color
  executeFlood(row, col) {
    const idx = State.cellIndex(row, col);
    if (State.currentColors[idx] !== -1) {
      UI.toast('Cell already painted', 'info');
      return;
    }

    const targetColor = State.targetColors[idx];
    powerups.flood.charges--;

    // BFS to find connected region of same target color (unpainted only)
    const w = State.gridWidth;
    const h = State.gridHeight;
    const visited = new Uint8Array(State.totalCells);
    const queue = [idx];
    visited[idx] = 1;

    // Collect cells with their BFS distance for ripple animation
    const rings = [[idx]]; // rings[0] = origin, rings[1] = distance 1, etc.
    let currentRing = 0;
    let nextRingStart = 1;

    const allCells = [idx];

    while (queue.length > 0) {
      const nextQueue = [];
      for (const ci of queue) {
        const c = ci % w;
        const r = (ci - c) / w;
        // 4-directional neighbors
        const neighbors = [];
        if (r > 0) neighbors.push(ci - w);
        if (r < h - 1) neighbors.push(ci + w);
        if (c > 0) neighbors.push(ci - 1);
        if (c < w - 1) neighbors.push(ci + 1);

        for (const ni of neighbors) {
          if (visited[ni]) continue;
          if (State.currentColors[ni] !== -1) continue;
          if (State.targetColors[ni] !== targetColor) continue;
          visited[ni] = 1;
          nextQueue.push(ni);
          allCells.push(ni);
        }
      }
      if (nextQueue.length > 0) {
        rings.push(nextQueue);
      }
      queue.length = 0;
      queue.push(...nextQueue);
    }

    if (allCells.length === 0) {
      powerups.flood.charges++; // refund
      UI.toast('No connected cells to fill', 'info');
      State.activePowerUp = null;
      this.updateToolbar();
      return;
    }

    // Animate ring-by-ring, then commit all as one undo batch
    const undoCells = [];
    const changedIndices = [];
    let ringIdx = 0;

    const animateRing = () => {
      if (ringIdx >= rings.length) {
        // All rings done — commit undo batch
        Undo.pushBatch(undoCells);
        Renderer.clearOverlay();
        powerUpColorCounts[targetColor] += undoCells.length;
        State.activePowerUp = null;
        this.updateToolbar();
        UI.toast(`Flood filled ${undoCells.length} cells!`, 'success');
        return;
      }

      const ring = rings[ringIdx];
      for (const ci of ring) {
        const c = ci % w;
        const r = (ci - c) / w;
        undoCells.push({ row: r, col: c, prev: -1, next: targetColor });
        State.setCellColor(r, c, targetColor);
        changedIndices.push(ci);
      }
      Bus.emit('cells:batch-changed', { indices: changedIndices.slice(-ring.length) });

      // Show remaining rings as overlay for preview effect
      const previewCells = [];
      for (let ri = ringIdx + 1; ri < rings.length; ri++) {
        for (const ci of rings[ri]) {
          const c = ci % w;
          const r = (ci - c) / w;
          previewCells.push({ row: r, col: c, colorIndex: targetColor });
        }
      }
      Renderer.showOverlay(previewCells, 'pulse');

      ringIdx++;
      // Speed scales with total rings — keep total animation under ~2 seconds
      const delay = Math.max(16, Math.min(100, 2000 / rings.length));
      setTimeout(animateRing, delay);
    };

    // Show preview of entire region first, then start filling
    const previewCells = allCells.map(ci => {
      const c = ci % w;
      const r = (ci - c) / w;
      return { row: r, col: c, colorIndex: targetColor };
    });
    Renderer.showOverlay(previewCells, 'pulse');
    setTimeout(animateRing, 300);
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
      powerUpColorCounts[colorIdx] += undoCells.length;
      UI.toast(`Auto-filled ${undoCells.length} cells!`, 'success');
    } else {
      UI.toast('No remaining cells of this color', 'info');
      powerups.autofill.charges++; // refund
    }

    State.activePowerUp = null;
    this.updateToolbar();
  },

  // Streak tracking
  onCellPainted(colorIndex) {
    // Snapshot remaining counts when streak begins
    if (streak === 0) {
      streakStartRemaining = State.getRemainingCounts();
      // The cell that just triggered this event is already painted,
      // so add 1 back to get the count at moment before this paint
      streakStartRemaining[colorIndex]++;
    }

    streak++;
    this.updateStreak();

    if (streak === CONFIG.STREAK_BONUS_THRESHOLD) {
      powerups.reveal.charges++;
      UI.toast('Streak bonus! +1 Reveal charge!', 'success');
      this.updateToolbar();
    }

    // Super streak: check if we just completed all cells of this color.
    // Qualifies if every non-power-up cell of this color was painted in this streak.
    // Power-up painted cells don't count against you.
    if (streakStartRemaining && streakStartRemaining[colorIndex] > 0) {
      const remaining = State.getRemainingCounts();
      if (remaining[colorIndex] === 0) {
        // Count total cells of this color in the image
        let totalOfColor = 0;
        for (let i = 0; i < State.totalCells; i++) {
          if (State.targetColors[i] === colorIndex) totalOfColor++;
        }
        // Cells painted before this streak = total - remaining at streak start
        // These must all be accounted for by power-ups
        const paintedBeforeStreak = totalOfColor - streakStartRemaining[colorIndex];
        const puCount = powerUpColorCounts ? powerUpColorCounts[colorIndex] : 0;
        if (paintedBeforeStreak <= puCount) {
          powerups.flood.charges++;
          this.updateToolbar();
          UI.toast(`Full color streak! +1 Flood charge!`, 'success');
        }
      }
    }
  },

  onCellWrong() {
    streak = 0;
    streakStartRemaining = null;
    this.updateStreak();
  },

  updateStreak() {
    if (!streakEl) return;
    if (streak === 0) {
      streakEl.textContent = '\u00A0';
      streakEl.className = 'streak-display';
      return;
    }

    if (streak >= CONFIG.STREAK_SPARKLE_THRESHOLD) {
      streakEl.textContent = `Streak: ${streak} \u2728`;
      streakEl.className = 'streak-display sparkle';
    } else if (streak >= CONFIG.STREAK_FLAME_THRESHOLD) {
      streakEl.textContent = `Streak: ${streak} \uD83D\uDD25`;
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

    // Flood: +1 per 25%
    if (percent % 25 === 0) {
      powerups.flood.charges++;
      UI.toast('+1 Flood charge!', 'success');
    }

    this.updateToolbar();
  }
};
