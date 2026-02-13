// theme.js — Dark mode management

import { Bus } from './bus.js';

const THEME_KEY = 'colorpic_theme';
let darkMode = false;

export const Theme = {
  init() {
    // Check saved preference, then system preference
    const saved = localStorage.getItem(THEME_KEY);
    if (saved !== null) {
      darkMode = saved === 'dark';
    } else {
      darkMode = window.matchMedia?.('(prefers-color-scheme: dark)').matches || false;
    }

    this.apply();

    Bus.on('action:toggleDarkMode', () => this.toggle());
  },

  toggle() {
    darkMode = !darkMode;
    this.apply();
    try {
      localStorage.setItem(THEME_KEY, darkMode ? 'dark' : 'light');
    } catch (e) {}
    Bus.emit('theme:changed', { dark: darkMode });
  },

  apply() {
    document.body.classList.toggle('dark', darkMode);
    const btn = document.getElementById('darkModeBtn');
    if (btn) btn.textContent = darkMode ? 'Dark' : 'Light';
  },

  isDark() {
    return darkMode;
  }
};
