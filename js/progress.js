// progress.js — Progress tracking, milestone detection

import { Bus } from './bus.js';
import { State } from './state.js';

let progressFill = null;
let progressText = null;
let lastMilestone = 0;

// Milestone thresholds (percentages)
const MILESTONES = [10, 15, 20, 25, 30, 40, 50, 60, 70, 75, 80, 90, 100];

export const Progress = {
  init(fillEl, textEl) {
    progressFill = fillEl;
    progressText = textEl;

    Bus.on('state:init', () => this.reset());
    Bus.on('state:reset', () => this.reset());
    Bus.on('cell:painted', () => this.update());
    Bus.on('cells:batch-changed', () => this.update());
  },

  reset() {
    lastMilestone = 0;
    this.update();
  },

  update() {
    const pct = State.totalCells > 0
      ? (State.filledCells / State.totalCells) * 100
      : 0;

    progressFill.style.width = pct + '%';
    progressText.textContent = pct.toFixed(1) + '% Complete';

    // Check milestones
    for (const m of MILESTONES) {
      if (pct >= m && lastMilestone < m) {
        lastMilestone = m;
        Bus.emit('progress:milestone', { percent: m });
      }
    }
  },

  getPercent() {
    return State.totalCells > 0
      ? (State.filledCells / State.totalCells) * 100
      : 0;
  }
};
