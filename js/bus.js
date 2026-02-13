// bus.js — Lightweight pub/sub event bus

const listeners = new Map();

export const Bus = {
  on(event, fn) {
    if (!listeners.has(event)) listeners.set(event, []);
    listeners.get(event).push(fn);
    return () => Bus.off(event, fn);
  },

  off(event, fn) {
    const fns = listeners.get(event);
    if (!fns) return;
    const idx = fns.indexOf(fn);
    if (idx !== -1) fns.splice(idx, 1);
  },

  emit(event, data) {
    const fns = listeners.get(event);
    if (!fns) return;
    for (const fn of fns) {
      fn(data);
    }
  },

  clear() {
    listeners.clear();
  }
};
