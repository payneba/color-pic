// victory.js — Confetti particles, stats overlay

import { CONFIG } from './config.js';
import { Bus } from './bus.js';
import { State } from './state.js';

let confettiCanvas = null;
let confettiCtx = null;
let particles = [];
let animating = false;

export const Victory = {
  init() {
    confettiCanvas = document.getElementById('confettiCanvas');
    if (confettiCanvas) {
      confettiCtx = confettiCanvas.getContext('2d');
    }

    Bus.on('game:complete', (data) => this.show(data));

    // Button handlers
    const viewBtn = document.getElementById('victoryViewBtn');
    const newBtn = document.getElementById('victoryNewBtn');
    const shareBtn = document.getElementById('victoryShareBtn');
    if (viewBtn) {
      viewBtn.addEventListener('click', () => this.hide());
    }
    if (newBtn) {
      newBtn.addEventListener('click', () => {
        this.hide();
        Bus.emit('action:newImage');
      });
    }
    if (shareBtn) {
      shareBtn.addEventListener('click', () => this.shareStats());
    }
  },

  show(data) {
    const overlay = document.getElementById('victoryOverlay');
    const stats = document.getElementById('victoryStats');
    if (!overlay || !stats) return;

    // Calculate stats
    const elapsed = data.time;
    const minutes = Math.floor(elapsed / 60000);
    const seconds = Math.floor((elapsed % 60000) / 1000);
    const timeStr = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;

    const colorsUsed = State.palette.length;
    const totalCells = data.totalCells;

    stats.innerHTML = `
      <div class="victory-stat"><span>Time:</span><span>${timeStr}</span></div>
      <div class="victory-stat"><span>Cells:</span><span>${totalCells.toLocaleString()}</span></div>
      <div class="victory-stat"><span>Colors:</span><span>${colorsUsed}</span></div>
      <div class="victory-stat"><span>Grid:</span><span>${State.gridWidth}x${State.gridHeight}</span></div>
    `;

    overlay.classList.add('active');
    this.startConfetti();
  },

  hide() {
    const overlay = document.getElementById('victoryOverlay');
    if (overlay) overlay.classList.remove('active');
    this.stopConfetti();
  },

  shareStats() {
    const elapsed = Date.now() - State.startTime;
    const minutes = Math.floor(elapsed / 60000);
    const seconds = Math.floor((elapsed % 60000) / 1000);
    const timeStr = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;

    const text = [
      '🎨 Color Pic - Puzzle Complete!',
      `⏱ Time: ${timeStr}`,
      `🔢 ${State.totalCells.toLocaleString()} cells, ${State.palette.length} colors`,
      `📐 ${State.gridWidth}x${State.gridHeight} grid`,
    ].join('\n');

    navigator.clipboard.writeText(text).then(() => {
      const btn = document.getElementById('victoryShareBtn');
      if (btn) {
        btn.textContent = 'Copied!';
        setTimeout(() => btn.textContent = 'Copy Stats', 2000);
      }
    }).catch(() => {});
  },

  startConfetti() {
    if (!confettiCanvas || !confettiCtx) return;

    const canvasArea = document.getElementById('canvasArea');
    confettiCanvas.width = canvasArea.offsetWidth;
    confettiCanvas.height = canvasArea.offsetHeight;
    confettiCanvas.style.display = 'block';

    particles = [];
    const w = confettiCanvas.width;
    const h = confettiCanvas.height;

    for (let i = 0; i < CONFIG.CONFETTI_COUNT; i++) {
      const colorIdx = Math.floor(Math.random() * State.palette.length);
      const c = State.palette[colorIdx];
      particles.push({
        x: Math.random() * w,
        y: -Math.random() * h * 0.5,
        vx: (Math.random() - 0.5) * 4,
        vy: 1 + Math.random() * 3,
        w: 4 + Math.random() * 8,
        h: 3 + Math.random() * 6,
        rot: Math.random() * Math.PI * 2,
        rotV: (Math.random() - 0.5) * 0.2,
        color: `rgb(${c[0]},${c[1]},${c[2]})`
      });
    }

    animating = true;
    const startTime = Date.now();

    const animate = () => {
      if (!animating) return;

      const elapsed = Date.now() - startTime;
      if (elapsed > CONFIG.CONFETTI_DURATION) {
        this.stopConfetti();
        return;
      }

      const ctx = confettiCtx;
      ctx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);

      const fade = Math.max(0, 1 - (elapsed / CONFIG.CONFETTI_DURATION - 0.7) / 0.3);

      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.05; // gravity
        p.rot += p.rotV;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.globalAlpha = fade;
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      }

      requestAnimationFrame(animate);
    };

    requestAnimationFrame(animate);
  },

  stopConfetti() {
    animating = false;
    if (confettiCanvas) {
      confettiCanvas.style.display = 'none';
    }
    particles = [];
  }
};
