// ui.js — Screen transitions, modal management, DOM helpers

import { Bus } from './bus.js';

const screens = {};
let toastContainer = null;

export const UI = {
  init() {
    // Register screens
    screens.loader = document.getElementById('loaderScreen');
    screens.game = document.getElementById('gameScreen');

    // Create toast container
    toastContainer = document.createElement('div');
    toastContainer.className = 'toast-container';
    document.body.appendChild(toastContainer);
  },

  showScreen(name) {
    for (const [key, el] of Object.entries(screens)) {
      el.classList.toggle('hidden', key !== name);
    }
    Bus.emit('screen:changed', { screen: name });
  },

  // Toast notification
  toast(message, type = 'info', duration = 3000) {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    toastContainer.appendChild(toast);

    // Trigger animation
    requestAnimationFrame(() => toast.classList.add('show'));

    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, duration);
  },

  // Show/hide modal
  showModal(id) {
    const modal = document.getElementById(id);
    if (modal) {
      modal.classList.add('active');
      modal.addEventListener('click', e => {
        if (e.target === modal) this.hideModal(id);
      });
    }
  },

  hideModal(id) {
    const modal = document.getElementById(id);
    if (modal) modal.classList.remove('active');
  },

  // Resize canvas to fill available space
  resizeCanvas(canvas) {
    const container = canvas.parentElement;
    const rect = container.getBoundingClientRect();
    // Account for padding
    const style = getComputedStyle(container);
    const padX = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
    const padY = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);

    const w = Math.floor(rect.width - padX);
    const h = Math.floor(rect.height - padY);

    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      return true;
    }
    return false;
  }
};
