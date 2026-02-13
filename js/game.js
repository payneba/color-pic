// game.js — Top-level lifecycle: init, processImage, reset + boot

import { CONFIG } from './config.js';
import { Bus } from './bus.js';
import { State } from './state.js';
import { Viewport } from './viewport.js';
import { Renderer } from './renderer.js';
import { Input } from './input.js';
import { Palette } from './palette.js';
import { Progress } from './progress.js';
import { UI } from './ui.js';
import { quantizeImage, calculateGridDimensions } from './quantize.js';
import { Minimap } from './minimap.js';
import { Undo } from './undo.js';
import { Storage } from './storage.js';
import { Gallery } from './gallery.js';
import { PowerUps } from './powerups.js';
import { Audio } from './audio.js';
import { Theme } from './theme.js';
import { Victory } from './victory.js';

// DOM elements
let canvas, loaderScreen, gameScreen;
let fileInput, browseBtn, urlForm, urlInput;
let gridSizeInput, gridSizeValue, numColorsInput, numColorsValue;
let processingIndicator, errorMessage, previewSection, previewImage;
let hintBtn, resetBtn, newImageBtn;
let zoomInBtn, zoomOutBtn, zoomFitBtn, zoomText;

function showError(msg) {
  errorMessage.textContent = 'Error: ' + msg;
  errorMessage.classList.remove('hidden');
}

function hideError() {
  errorMessage.classList.add('hidden');
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image. For URLs, the server must allow CORS.'));
    img.src = src;
  });
}

async function processImage(source) {
  hideError();
  processingIndicator.classList.remove('hidden');
  previewSection.classList.add('hidden');

  try {
    let img;
    if (source instanceof File) {
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = e => resolve(e.target.result);
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsDataURL(source);
      });
      img = await loadImage(dataUrl);
    } else if (source instanceof ImageData) {
      // Direct ImageData (from gallery)
      startGame(source, source.width, source.height);
      processingIndicator.classList.add('hidden');
      return;
    } else {
      img = await loadImage(source);
    }

    // Show preview
    previewImage.src = img.src;
    previewSection.classList.remove('hidden');

    // Get image data
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = img.naturalWidth;
    tempCanvas.height = img.naturalHeight;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.drawImage(img, 0, 0);
    const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);

    startGame(imageData, img.naturalWidth, img.naturalHeight);
    processingIndicator.classList.add('hidden');
  } catch (err) {
    processingIndicator.classList.add('hidden');
    showError(err.message);
  }
}

function startGame(imageData, imgWidth, imgHeight) {
  const maxCells = parseInt(gridSizeInput.value, 10);
  const numColors = parseInt(numColorsInput.value, 10);
  const dims = calculateGridDimensions(imgWidth, imgHeight, maxCells);

  // Quantize
  const result = quantizeImage(imageData, dims.width, dims.height, numColors);

  // Initialize state
  State.init(dims.width, dims.height, result.palette, result.targetIndices);

  // Switch to game screen first so canvas has dimensions
  UI.showScreen('game');

  // Now resize canvas to fill container
  UI.resizeCanvas(canvas);

  // Initialize viewport
  Viewport.init(dims.width, dims.height, canvas);
  Viewport.fitToCanvas();

  updateZoomText();
}

function updateZoomText() {
  if (zoomText) {
    zoomText.textContent = Math.round(Viewport.zoom * 100) + '%';
  }
}

let showingSolution = false;

function toggleHint() {
  showingSolution = !showingSolution;
  Renderer.setShowingSolution(showingSolution);
  hintBtn.textContent = showingSolution ? 'Hide Solution' : 'Show Hint';
  hintBtn.classList.toggle('active', showingSolution);
}

function resetGame() {
  State.reset();
  showingSolution = false;
  Renderer.setShowingSolution(false);
  hintBtn.textContent = 'Show Hint';
  hintBtn.classList.remove('active');
  Renderer.requestFullRedraw();
}

function newImage() {
  UI.showScreen('loader');
  previewSection.classList.add('hidden');
  hideError();
  urlInput.value = '';
  fileInput.value = '';
}

export function boot() {
  // Get DOM elements
  canvas = document.getElementById('gameCanvas');
  loaderScreen = document.getElementById('loaderScreen');
  gameScreen = document.getElementById('gameScreen');
  fileInput = document.getElementById('fileInput');
  browseBtn = document.getElementById('browseBtn');
  urlForm = document.getElementById('urlForm');
  urlInput = document.getElementById('urlInput');
  gridSizeInput = document.getElementById('gridSizeInput');
  gridSizeValue = document.getElementById('gridSizeValue');
  numColorsInput = document.getElementById('numColorsInput');
  numColorsValue = document.getElementById('numColorsValue');
  processingIndicator = document.getElementById('processingIndicator');
  errorMessage = document.getElementById('errorMessage');
  previewSection = document.getElementById('previewSection');
  previewImage = document.getElementById('previewImage');
  hintBtn = document.getElementById('hintBtn');
  resetBtn = document.getElementById('resetBtn');
  newImageBtn = document.getElementById('newImageBtn');
  zoomInBtn = document.getElementById('zoomInBtn');
  zoomOutBtn = document.getElementById('zoomOutBtn');
  zoomFitBtn = document.getElementById('zoomFitBtn');
  zoomText = document.getElementById('zoomText');

  // Initialize modules
  UI.init();
  Theme.init();
  Renderer.init(canvas);
  Input.init(canvas);
  Palette.init(document.getElementById('paletteGrid'));
  Progress.init(
    document.getElementById('progressFill'),
    document.getElementById('progressText')
  );
  Minimap.init(
    document.getElementById('minimapContainer'),
    document.getElementById('minimapCanvas')
  );
  Undo.init();
  Storage.init();
  Gallery.init(document.getElementById('galleryStrip'));
  PowerUps.init(
    document.getElementById('powerupToolbar'),
    document.getElementById('powerupSection'),
    document.getElementById('streakDisplay')
  );
  Audio.init();
  Victory.init();

  // Settings slider updates
  gridSizeInput.addEventListener('input', () => {
    gridSizeValue.textContent = parseInt(gridSizeInput.value).toLocaleString() + ' cells';
  });
  numColorsInput.addEventListener('input', () => {
    numColorsValue.textContent = numColorsInput.value;
  });

  // File/URL loading
  browseBtn.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', e => {
    const file = e.target.files[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        showError('Please select an image file.');
        return;
      }
      processImage(file);
    }
  });

  urlForm.addEventListener('submit', e => {
    e.preventDefault();
    const url = urlInput.value.trim();
    if (url) {
      if (!url.match(/^https?:\/\//i)) {
        showError('Please enter a valid URL starting with http:// or https://');
        return;
      }
      processImage(url);
    }
  });

  // Drag and drop
  const dropZone = loaderScreen;
  dropZone.addEventListener('dragover', e => {
    e.preventDefault();
    dropZone.classList.add('drag-over');
  });
  dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('drag-over');
  });
  dropZone.addEventListener('drop', e => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      processImage(file);
    } else {
      showError('Please drop an image file.');
    }
  });

  // Clipboard paste
  window.addEventListener('paste', e => {
    if (gameScreen && !gameScreen.classList.contains('hidden')) return;
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) processImage(file);
        break;
      }
    }
  });

  // Game controls
  hintBtn.addEventListener('click', toggleHint);
  resetBtn.addEventListener('click', () => {
    if (State.filledCells > 0) {
      if (confirm('Reset all progress? This cannot be undone.')) {
        resetGame();
      }
    }
  });
  newImageBtn.addEventListener('click', newImage);

  // Undo/Redo/Save buttons
  const undoBtn = document.getElementById('undoBtn');
  const redoBtn = document.getElementById('redoBtn');
  const saveBtn = document.getElementById('saveBtn');
  if (undoBtn) undoBtn.addEventListener('click', () => Bus.emit('action:undo'));
  if (redoBtn) redoBtn.addEventListener('click', () => Bus.emit('action:redo'));
  if (saveBtn) saveBtn.addEventListener('click', () => Bus.emit('action:save'));

  // Undo button state
  Bus.on('undo:changed', ({ canUndo, canRedo }) => {
    if (undoBtn) undoBtn.disabled = !canUndo;
    if (redoBtn) redoBtn.disabled = !canRedo;
  });

  // Header controls
  const darkModeBtn = document.getElementById('darkModeBtn');
  const soundBtn = document.getElementById('soundBtn');
  const helpBtn = document.getElementById('helpBtn');

  if (darkModeBtn) {
    darkModeBtn.addEventListener('click', () => Bus.emit('action:toggleDarkMode'));
    Bus.on('theme:changed', ({ dark }) => {
      darkModeBtn.textContent = dark ? 'Dark' : 'Light';
    });
  }

  if (soundBtn) {
    soundBtn.addEventListener('click', () => {
      const on = Audio.toggle();
      soundBtn.textContent = 'Sound: ' + (on ? 'On' : 'Off');
    });
  }

  if (helpBtn) {
    helpBtn.addEventListener('click', () => UI.showModal('helpModal'));
  }
  Bus.on('action:showHelp', () => UI.showModal('helpModal'));

  const helpCloseBtn = document.getElementById('helpCloseBtn');
  if (helpCloseBtn) {
    helpCloseBtn.addEventListener('click', () => UI.hideModal('helpModal'));
  }

  // Continue from save
  const continueSection = document.getElementById('continueSection');
  const continueBtn = document.getElementById('continueBtn');
  if (Storage.hasAutoSave() && continueSection && continueBtn) {
    continueSection.classList.remove('hidden');
    continueBtn.addEventListener('click', () => {
      const data = Storage.loadAutoSave();
      if (data && Storage.deserialize(data)) {
        // Show game screen first so canvas has dimensions
        UI.showScreen('game');
        UI.resizeCanvas(canvas);
        Viewport.init(State.gridWidth, State.gridHeight, canvas);
        Viewport.fitToCanvas();
        Bus.emit('state:init', {
          gridWidth: State.gridWidth,
          gridHeight: State.gridHeight,
          palette: State.palette,
          paletteHex: State.paletteHex
        });
        updateZoomText();
        UI.toast('Game resumed!', 'success');
      }
    });
  }

  // New image from victory
  Bus.on('action:newImage', newImage);

  // Zoom controls
  if (zoomInBtn) {
    zoomInBtn.addEventListener('click', () => {
      Viewport.setZoom(Viewport.zoom * CONFIG.ZOOM_STEP);
      updateZoomText();
    });
  }
  if (zoomOutBtn) {
    zoomOutBtn.addEventListener('click', () => {
      Viewport.setZoom(Viewport.zoom / CONFIG.ZOOM_STEP);
      updateZoomText();
    });
  }
  if (zoomFitBtn) {
    zoomFitBtn.addEventListener('click', () => {
      Viewport.fitToCanvas();
      updateZoomText();
    });
  }

  Bus.on('viewport:changed', updateZoomText);
  Bus.on('action:toggleHint', toggleHint);

  // Canvas resize on window resize
  let resizeTimeout;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      if (State.targetColors) {
        UI.resizeCanvas(canvas);
        Viewport.resize(canvas.width, canvas.height);
        Renderer.requestFullRedraw();
      }
    }, 100);
  });

  // Expose processImage for gallery
  window._processImage = processImage;
  window._startGame = startGame;

  // Show loader screen
  UI.showScreen('loader');
}
