// gallery.js — 8 procedural image generators + gallery UI

import { PRNG, hslToRgb, clamp } from './utils.js';

const GENERATORS = [
  {
    name: 'Sunset Landscape',
    difficulty: 'Easy',
    generate: (w, h) => generateSunset(w, h)
  },
  {
    name: 'Geometric Mandala',
    difficulty: 'Medium',
    generate: (w, h) => generateMandala(w, h)
  },
  {
    name: 'Pixel Castle',
    difficulty: 'Medium',
    generate: (w, h) => generateCastle(w, h)
  },
  {
    name: 'Rainbow Spiral',
    difficulty: 'Easy',
    generate: (w, h) => generateSpiral(w, h)
  },
  {
    name: 'Mosaic Tiles',
    difficulty: 'Hard',
    generate: (w, h) => generateMosaic(w, h)
  },
  {
    name: 'Floral Pattern',
    difficulty: 'Medium',
    generate: (w, h) => generateFloral(w, h)
  },
  {
    name: 'Ocean Waves',
    difficulty: 'Easy',
    generate: (w, h) => generateOcean(w, h)
  },
  {
    name: 'Stained Glass',
    difficulty: 'Hard',
    generate: (w, h) => generateStainedGlass(w, h)
  }
];

// Generate ImageData for a procedural image
function createImageData(w, h, pixelFn) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  const imageData = ctx.createImageData(w, h);
  const d = imageData.data;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const [r, g, b] = pixelFn(x, y, w, h);
      const i = (y * w + x) * 4;
      d[i] = clamp(Math.round(r), 0, 255);
      d[i + 1] = clamp(Math.round(g), 0, 255);
      d[i + 2] = clamp(Math.round(b), 0, 255);
      d[i + 3] = 255;
    }
  }

  return imageData;
}

// 1. Sunset Landscape
function generateSunset(w, h) {
  return createImageData(w, h, (x, y, W, H) => {
    const ny = y / H;
    const nx = x / W;

    // Sky gradient
    if (ny < 0.6) {
      const t = ny / 0.6;
      // Top: deep blue -> orange/red near horizon
      const r = 30 + t * 220;
      const g = 20 + t * 100;
      const b = 120 - t * 80;
      return [r, g, b];
    }

    // Sun
    const sunCx = 0.5, sunCy = 0.55;
    const sunR = 0.08;
    const dx = nx - sunCx, dy = (y / H) - sunCy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < sunR) {
      return [255, 220, 50];
    }
    if (dist < sunR + 0.03) {
      const t = (dist - sunR) / 0.03;
      return [255 - t * 5, 200 - t * 100, 50 - t * 30];
    }

    // Horizon line
    if (ny >= 0.6 && ny < 0.65) {
      const t = (ny - 0.6) / 0.05;
      return [200 - t * 150, 120 - t * 90, 40 - t * 20];
    }

    // Ground / silhouette
    const groundT = (ny - 0.65) / 0.35;
    // Hills
    const hill1 = 0.65 + Math.sin(nx * 6) * 0.03;
    const hill2 = 0.68 + Math.sin(nx * 4 + 1) * 0.04;

    if (y / H < hill1 || y / H < hill2) {
      return [40, 30, 50]; // dark silhouette
    }

    return [30 - groundT * 15, 20 - groundT * 10, 35 - groundT * 15];
  });
}

// 2. Geometric Mandala
function generateMandala(w, h) {
  return createImageData(w, h, (x, y, W, H) => {
    const cx = W / 2, cy = H / 2;
    const dx = x - cx, dy = y - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const maxDist = Math.min(W, H) / 2;
    const angle = Math.atan2(dy, dx);

    const nd = dist / maxDist;

    // Radial rings
    const ring = Math.floor(nd * 8);
    // Angular segments
    const segments = 12;
    const seg = Math.floor(((angle + Math.PI) / (2 * Math.PI)) * segments);

    // Background
    if (nd > 1.0) return [240, 235, 230];

    // Color based on ring and segment
    const hue = (ring * 45 + seg * 30) % 360;
    const lightness = 0.4 + (ring % 2) * 0.2;
    const saturation = 0.7 + Math.sin(nd * 12) * 0.2;

    return hslToRgb(hue, saturation, lightness);
  });
}

// 3. Pixel Castle
function generateCastle(w, h) {
  // Define a 32x32 castle pattern
  const pattern = [
    '................................',
    '....BB..BB..BB..BB..BB..BB......',
    '....BB..BB..BB..BB..BB..BB......',
    '..BBBBBBBBBBBBBBBBBBBBBBBBBB....',
    '..BBBBBBBBBBBBBBBBBBBBBBBBBB....',
    '..BB..BB..BBBBBBBB..BB..BB.....',
    '..BB..BB..BBBBBBBB..BB..BB.....',
    '..BBBBBB..BBBBBBBB..BBBBBB.....',
    '..BBBBBB..BBBBBBBB..BBBBBB.....',
    '..BBBBBB..BBBBBBBB..BBBBBB.....',
    '..BBBBBB..BBWWWWBB..BBBBBB.....',
    '..BBBBBB..BBWWWWBB..BBBBBB.....',
    '..BBBBBB..BBWWWWBB..BBBBBB.....',
    '......BBBBBBWWWWBBBBBB.........',
    '......BBBBBBBBBBBBBBBB.........',
    '........BBBB....BBBB...........',
    '................................',
    '......GGGGGGGGGGGGGGGG.........',
    '....GGGGGGGGGGGGGGGGGGGG.......',
    '....GGGGGGGGGGGGGGGGGGGG.......',
    '..GGGGGGTTGGGGGGGGTTGGGGGG.....',
    '..GGGGTTTTGGGGGGTTTTGGGGGG.....',
    '..GGTTTTTTTTGGTTTTTTTTGGGG.....',
    '..GGTTTTTTTTGGTTTTTTTTGGGG.....',
    '..GGGGTTTTGGGGGGTTTTGGGGGG.....',
    '....GGGGGGGGGGGGGGGGGGGG.......',
    '....GGGGGGGGGGGGGGGGGGGG.......',
    '......GGGGGGGGGGGGGGGG.........',
    '.........GGGGGGGGG.............',
    '................................',
    'SSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSS',
    'SSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSS',
  ];

  const colors = {
    '.': [135, 206, 235], // sky blue
    'B': [139, 90, 43],   // brown brick
    'W': [200, 200, 220], // window
    'G': [34, 139, 34],   // green foliage
    'T': [101, 67, 33],   // tree trunk
    'S': [34, 120, 34],   // ground
  };

  return createImageData(w, h, (x, y, W, H) => {
    const px = Math.floor(x / W * 32);
    const py = Math.floor(y / H * 32);
    const row = pattern[clamp(py, 0, 31)];
    const ch = row ? row[clamp(px, 0, 31)] || '.' : '.';
    return colors[ch] || colors['.'];
  });
}

// 4. Rainbow Spiral
function generateSpiral(w, h) {
  return createImageData(w, h, (x, y, W, H) => {
    const cx = W / 2, cy = H / 2;
    const dx = x - cx, dy = y - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx);
    const maxDist = Math.min(W, H) / 2;

    // Archimedean spiral with hue rotation
    const spiral = (angle + Math.PI) / (2 * Math.PI) + dist / maxDist * 3;
    const hue = (spiral * 360) % 360;
    const nd = dist / maxDist;

    if (nd > 1.0) return [240, 240, 240];

    const lightness = 0.45 + Math.sin(spiral * 6) * 0.15;
    return hslToRgb(hue, 0.85, lightness);
  });
}

// 5. Mosaic Tiles (Voronoi)
function generateMosaic(w, h) {
  const rng = new PRNG(42);
  const numPoints = 40;
  const points = [];
  const pointColors = [];

  for (let i = 0; i < numPoints; i++) {
    points.push([rng.next() * w, rng.next() * h]);
    pointColors.push(hslToRgb(rng.next() * 360, 0.6 + rng.next() * 0.3, 0.4 + rng.next() * 0.3));
  }

  return createImageData(w, h, (x, y) => {
    let minDist = Infinity;
    let closest = 0;

    for (let i = 0; i < numPoints; i++) {
      const dx = x - points[i][0];
      const dy = y - points[i][1];
      const d = dx * dx + dy * dy;
      if (d < minDist) {
        minDist = d;
        closest = i;
      }
    }

    return pointColors[closest];
  });
}

// 6. Floral Pattern
function generateFloral(w, h) {
  const rng = new PRNG(123);
  const flowers = [];
  for (let i = 0; i < 12; i++) {
    flowers.push({
      cx: rng.next() * w,
      cy: rng.next() * h,
      r: 15 + rng.next() * 25,
      petals: 5 + rng.nextInt(0, 4),
      hue: rng.next() * 360,
    });
  }

  return createImageData(w, h, (x, y) => {
    // Background
    let r = 200, g = 230, b = 200;

    for (const f of flowers) {
      const dx = x - f.cx, dy = y - f.cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const angle = Math.atan2(dy, dx);

      // Petals
      const petalR = f.r * (0.6 + 0.4 * Math.cos(angle * f.petals));
      if (dist < petalR) {
        const [pr, pg, pb] = hslToRgb(f.hue, 0.7, 0.6);
        r = pr; g = pg; b = pb;
      }

      // Center
      if (dist < f.r * 0.25) {
        r = 255; g = 200; b = 50;
      }

      // Stem
      if (Math.abs(x - f.cx) < 2 && y > f.cy && y < f.cy + f.r * 1.5) {
        r = 50; g = 120; b = 40;
      }
    }

    return [r, g, b];
  });
}

// 7. Ocean Waves
function generateOcean(w, h) {
  return createImageData(w, h, (x, y, W, H) => {
    const ny = y / H;
    const nx = x / W;

    // Sky
    if (ny < 0.35) {
      const t = ny / 0.35;
      return [150 + t * 50, 200 + t * 30, 255 - t * 20];
    }

    // Layered waves
    const waveY = ny - 0.35;
    const wave1 = Math.sin(nx * 12 + waveY * 8) * 0.03;
    const wave2 = Math.sin(nx * 8 + waveY * 6 + 2) * 0.04;
    const wave3 = Math.sin(nx * 15 + waveY * 10 + 4) * 0.02;

    const waveFactor = wave1 + wave2 + wave3;
    const depth = (ny - 0.35) / 0.65;

    // Ocean blue with wave patterns
    const r = clamp(20 + depth * 20 + waveFactor * 200, 0, 255);
    const g = clamp(80 + depth * 40 + waveFactor * 150, 0, 255);
    const b = clamp(160 - depth * 40 + waveFactor * 100, 0, 255);

    // Foam/whitecaps
    if (waveFactor > 0.05) {
      const foam = (waveFactor - 0.05) / 0.04;
      return [
        clamp(r + foam * 200, 0, 255),
        clamp(g + foam * 200, 0, 255),
        clamp(b + foam * 100, 0, 255)
      ];
    }

    return [r, g, b];
  });
}

// 8. Stained Glass
function generateStainedGlass(w, h) {
  const rng = new PRNG(77);
  const numRegions = 30;
  const points = [];
  const regionColors = [];

  for (let i = 0; i < numRegions; i++) {
    points.push([rng.next() * w, rng.next() * h]);
    regionColors.push(hslToRgb(
      rng.next() * 360,
      0.5 + rng.next() * 0.4,
      0.3 + rng.next() * 0.4
    ));
  }

  return createImageData(w, h, (x, y) => {
    let minDist = Infinity;
    let secondDist = Infinity;
    let closest = 0;

    for (let i = 0; i < numRegions; i++) {
      const dx = x - points[i][0];
      const dy = y - points[i][1];
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < minDist) {
        secondDist = minDist;
        minDist = d;
        closest = i;
      } else if (d < secondDist) {
        secondDist = d;
      }
    }

    // Dark leading (borders) where two regions meet
    const borderDist = secondDist - minDist;
    if (borderDist < 3) {
      const t = borderDist / 3;
      const c = regionColors[closest];
      return [
        Math.round(c[0] * t * 0.3),
        Math.round(c[1] * t * 0.3),
        Math.round(c[2] * t * 0.3)
      ];
    }

    // Slightly brighter in center of region
    const c = regionColors[closest];
    const brighten = Math.min(1.3, 1 + (borderDist - 3) * 0.005);
    return [
      clamp(Math.round(c[0] * brighten), 0, 255),
      clamp(Math.round(c[1] * brighten), 0, 255),
      clamp(Math.round(c[2] * brighten), 0, 255)
    ];
  });
}

// Generate thumbnail for gallery display
function generateThumbnail(gen, thumbW, thumbH) {
  const imageData = gen.generate(thumbW, thumbH);
  const canvas = document.createElement('canvas');
  canvas.width = thumbW;
  canvas.height = thumbH;
  canvas.getContext('2d').putImageData(imageData, 0, 0);
  return canvas;
}

export const Gallery = {
  init(stripEl) {
    if (!stripEl) return;

    const thumbW = 110;
    const thumbH = 80;

    for (let i = 0; i < GENERATORS.length; i++) {
      const gen = GENERATORS[i];
      const item = document.createElement('div');
      item.className = 'gallery-item';

      const thumbCanvas = generateThumbnail(gen, thumbW, thumbH);
      item.appendChild(thumbCanvas);

      const label = document.createElement('div');
      label.className = 'gallery-label';
      label.textContent = gen.name;
      item.appendChild(label);

      const diff = document.createElement('div');
      diff.className = 'gallery-difficulty';
      diff.textContent = gen.difficulty;
      item.appendChild(diff);

      item.addEventListener('click', () => {
        this.loadGalleryImage(i);
      });

      stripEl.appendChild(item);
    }
  },

  loadGalleryImage(index) {
    const gen = GENERATORS[index];
    // Generate at a reasonable resolution for quantization
    const genW = 200;
    const genH = 150;
    const imageData = gen.generate(genW, genH);

    // Use the global processImage function with ImageData
    if (window._processImage) {
      window._processImage(imageData);
    }
  }
};
