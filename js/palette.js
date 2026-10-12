// palette.js — Color palette UI management

import { Bus } from './bus.js';
import { State } from './state.js';
import { getContrastColorHex } from './utils.js';

let paletteContainer = null;

export const Palette = {
  init(containerEl) {
    paletteContainer = containerEl;

    Bus.on('state:init', () => this.build());
    Bus.on('state:reset', () => this.updateAll());
    Bus.on('cell:painted', () => this.updateRemaining());
    Bus.on('cells:batch-changed', () => this.updateRemaining());
    Bus.on('color:selected', ({ index }) => this.updateSelection(index));
  },

  build() {
    paletteContainer.innerHTML = '';
    const paletteHex = State.paletteHex;

    for (let i = 0; i < paletteHex.length; i++) {
      const btn = document.createElement('button');
      btn.className = 'color-swatch';
      btn.style.backgroundColor = paletteHex[i];
      btn.style.color = getContrastColorHex(paletteHex[i]);
      btn.dataset.index = i;

      const numSpan = document.createElement('span');
      numSpan.className = 'color-number';
      numSpan.textContent = (i + 1).toString();
      btn.appendChild(numSpan);

      const countSpan = document.createElement('span');
      countSpan.className = 'color-remaining';
      countSpan.textContent = '0';
      btn.appendChild(countSpan);

      btn.addEventListener('click', () => {
        if (State.selectedColorIndex === i) {
          State.selectColor(-1);
        } else {
          State.selectColor(i);
        }
      });

      paletteContainer.appendChild(btn);
    }

    this.updateRemaining();
    this.updateSelection(State.selectedColorIndex);
  },

  updateRemaining() {
    const counts = State.getRemainingCounts();
    const swatches = paletteContainer.querySelectorAll('.color-swatch');

    for (let i = 0; i < swatches.length; i++) {
      const count = i < counts.length ? counts[i] : 0;
      swatches[i].querySelector('.color-remaining').textContent = count.toString();
      swatches[i].classList.toggle('complete', count === 0);
    }
  },

  updateSelection(index) {
    const swatches = paletteContainer.querySelectorAll('.color-swatch');
    for (let i = 0; i < swatches.length; i++) {
      const isSelected = i === index;
      swatches[i].classList.toggle('selected', isSelected);
      if (isSelected) {
        swatches[i].style.borderColor = getContrastColorHex(State.paletteHex[i]);
      } else {
        swatches[i].style.borderColor = 'transparent';
      }
    }

    // Update selected indicator
    const indicator = document.getElementById('selectedIndicator');
    const preview = document.getElementById('selectedPreview');
    if (index >= 0 && index < State.paletteHex.length) {
      indicator.style.display = 'flex';
      preview.style.backgroundColor = State.paletteHex[index];
      indicator.querySelector('.selected-text').textContent =
        `Color ${index + 1}`;
    } else {
      indicator.style.display = 'none';
    }
  },

  updateAll() {
    this.updateRemaining();
    this.updateSelection(State.selectedColorIndex);
  }
};
