# Color Pic - Paint by Numbers

A full-featured paint-by-numbers web application. Load any image or choose from a gallery of procedural designs, then fill in cells with the correct colors to complete the puzzle.

## Features

- **Paint by Numbers**: Click or drag to paint cells with the selected color. Only correct colors are accepted.
- **Image Loading**: Upload from file, paste from clipboard, drag-and-drop, or load from URL.
- **Procedural Gallery**: 8 built-in designs (Sunset, Mandala, Castle, Spiral, Mosaic, Floral, Ocean, Stained Glass) generated programmatically.
- **User Image Gallery**: Drop `.jpg`, `.png`, or `.heic` files into the `images/` folder and they appear in the gallery automatically. Use `images/gallery.json` to set preferred colors/resolution per image and flag a default for auto-load on startup.
- **Perceptual Quantization**: Oklab color space with variance-weighted median-cut and k-means refinement for accurate color reduction, especially on photographic images.
- **Zoom & Pan**: Scroll-wheel zoom centered on cursor, spacebar+drag or middle-mouse to pan. Supports grids up to 256x256 cells.
- **Touch Support**: Single-finger paint, pinch-to-zoom, two-finger pan.
- **Mini-Map**: Overview with viewport rectangle, click to navigate. Auto-shows at high zoom levels.
- **Undo/Redo**: Full undo stack with batch support for drag strokes and power-up operations (Ctrl+Z / Ctrl+Y).
- **Save/Load**: Auto-saves to localStorage every 30 seconds. Continue button on reload.
- **Power-Ups**: Earn charges through milestones — Reveal Lens, Color Bomb, Auto-Fill, Flood Fill, and passive Streak Bonus.
- **Sound Effects**: Procedural Web Audio synthesis (toggle on/off).
- **Dark Mode**: Respects system preference, toggle with D key or header button.
- **Victory Celebration**: Confetti particle system with stats overlay and clipboard sharing.
- **Keyboard Shortcuts**: Number keys for color selection, zoom controls, and more. Press `?` for full list.

## Usage

Open `index.html` in a modern web browser. No build tools or server required (ES modules need a file server for local development — use `npx serve .` or similar if loading from `file://` doesn't work).

### Quick Start

1. Open the app in a browser
2. Choose a design from the gallery, or upload your own image
3. Adjust grid size (up to 65,536 cells) and color count (4-64)
4. Select a color from the palette, then click/drag cells to paint
5. Use zoom (scroll wheel) and pan (space+drag) for large grids
6. Earn power-ups as you hit milestones

## Architecture

Multi-file vanilla JavaScript with ES module imports. No frameworks or build tools.

```
color_pic/
├── index.html          # Shell HTML, screen layouts, modals
├── css/style.css       # Styles with CSS custom properties, dark mode, responsive
├── images/             # Drop .jpg/.png/.heic files here for gallery
│   └── gallery.json    # Optional manifest: per-image settings + default
├── js/
│   ├── config.js       # Constants and tuning parameters
│   ├── bus.js          # Lightweight pub/sub event bus
│   ├── state.js        # Central state with typed arrays
│   ├── utils.js        # Color math, Bresenham, PRNG, HSL conversion
│   ├── quantize.js     # Oklab perceptual quantization + k-means
│   ├── gallery.js      # Procedural generators + user image gallery
│   ├── viewport.js     # Zoom, pan, coordinate transforms
│   ├── renderer.js     # Canvas rendering with dirty tracking
│   ├── minimap.js      # Mini-map overlay
│   ├── input.js        # Mouse, touch, keyboard input
│   ├── palette.js      # Color palette UI
│   ├── powerups.js     # Power-up system
│   ├── audio.js        # Web Audio procedural sounds
│   ├── storage.js      # localStorage save/load
│   ├── undo.js         # Undo/redo stack
│   ├── progress.js     # Progress tracking, milestones
│   ├── theme.js        # Dark mode
│   ├── victory.js      # Confetti and stats
│   ├── ui.js           # Screen transitions, toasts, modals
│   └── game.js         # Top-level lifecycle and boot
└── README.md
```

## Browser Support

Tested on modern browsers (Chrome, Firefox, Safari, Edge). Requires ES module support and Canvas 2D API.

## License

MIT
