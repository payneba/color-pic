// audio.js — Web Audio API procedural sound effects

import { Bus } from './bus.js';

let audioCtx = null;
let enabled = true;

function getCtx() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioCtx;
}

function playTone(freq, duration, type = 'sine', volume = 0.15) {
  if (!enabled) return;
  try {
    const ctx = getCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration);
  } catch (e) {}
}

function playSequence(notes, interval, type = 'sine', volume = 0.12) {
  if (!enabled) return;
  notes.forEach((freq, i) => {
    setTimeout(() => playTone(freq, interval * 1.5, type, volume), i * interval * 1000);
  });
}

export const Audio = {
  init() {
    Bus.on('cell:painted', ({ colorIndex }) => {
      // Pitch varies by color index
      const baseFreq = 400 + (colorIndex % 12) * 40;
      playTone(baseFreq, 0.08, 'sine', 0.1);
    });

    Bus.on('cell:wrong', () => {
      playTone(150, 0.2, 'sawtooth', 0.08);
    });

    Bus.on('progress:milestone', ({ percent }) => {
      if (percent === 100) return; // victory handles this
      // Rising arpeggio
      playSequence([523, 659, 784], 0.1, 'sine', 0.12);
    });

    Bus.on('game:complete', () => {
      // Triumphant chord sequence
      playSequence([523, 659, 784, 1047], 0.15, 'sine', 0.15);
      setTimeout(() => {
        playSequence([587, 740, 880], 0.15, 'sine', 0.12);
      }, 700);
    });
  },

  toggle() {
    enabled = !enabled;
    return enabled;
  },

  isEnabled() {
    return enabled;
  }
};
