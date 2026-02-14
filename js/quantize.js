// quantize.js — Oklab perceptual color quantization with variance-weighted median-cut + k-means

import { CONFIG } from './config.js';

// --- Oklab color space conversions ---

function srgbToLinear(c) {
  c /= 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function linearToSrgb(c) {
  c = c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
  return Math.round(Math.max(0, Math.min(255, c * 255)));
}

function srgbToOklab(r, g, b) {
  const lr = srgbToLinear(r), lg = srgbToLinear(g), lb = srgbToLinear(b);
  const l_ = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m_ = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s_ = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  return [
    0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_,
    1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_,
    0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_
  ];
}

function oklabToSrgb(L, a, b) {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.2914855480 * b;
  const lr = l_ * l_ * l_, mg = m_ * m_ * m_, sb = s_ * s_ * s_;
  return [
    linearToSrgb(+4.0767416621 * lr - 3.3077115913 * mg + 0.2309699292 * sb),
    linearToSrgb(-1.2684380046 * lr + 2.6097574011 * mg - 0.3413193965 * sb),
    linearToSrgb(-0.0041960863 * lr - 0.7034186147 * mg + 1.7076147010 * sb)
  ];
}

// --- Variance-weighted median-cut in Oklab space ---

function createBox(colors) {
  const n = colors.length;
  let sumL = 0, sumA = 0, sumB = 0;
  let sumL2 = 0, sumA2 = 0, sumB2 = 0;
  for (let i = 0; i < n; i++) {
    const c = colors[i];
    sumL += c[0]; sumA += c[1]; sumB += c[2];
    sumL2 += c[0] * c[0]; sumA2 += c[1] * c[1]; sumB2 += c[2] * c[2];
  }
  const varL = sumL2 / n - (sumL / n) ** 2;
  const varA = sumA2 / n - (sumA / n) ** 2;
  const varB = sumB2 / n - (sumB / n) ** 2;
  const maxVar = Math.max(varL, varA, varB);
  const splitAxis = maxVar === varL ? 0 : maxVar === varA ? 1 : 2;
  return { colors, splitAxis, maxVar, count: n };
}

function splitBox(box) {
  const sorted = box.colors.slice().sort((a, b) => a[box.splitAxis] - b[box.splitAxis]);
  const mid = sorted.length >> 1;
  return [createBox(sorted.slice(0, mid)), createBox(sorted.slice(mid))];
}

function getAverageColor(box) {
  let L = 0, a = 0, b = 0;
  for (const c of box.colors) { L += c[0]; a += c[1]; b += c[2]; }
  const n = box.colors.length;
  return [L / n, a / n, b / n];
}

function medianCut(colors, numColors) {
  if (colors.length === 0) return [];
  if (colors.length <= numColors) return colors.map(c => [c[0], c[1], c[2]]);

  let boxes = [createBox(colors)];
  while (boxes.length < numColors) {
    // Pick box with highest count * maxVariance (skip boxes with only 1 color)
    let bestIdx = -1, bestScore = -1;
    for (let i = 0; i < boxes.length; i++) {
      if (boxes[i].count <= 1) continue;
      const score = boxes[i].count * boxes[i].maxVar;
      if (score > bestScore) { bestScore = score; bestIdx = i; }
    }
    if (bestIdx === -1) break;
    const [b1, b2] = splitBox(boxes[bestIdx]);
    boxes.splice(bestIdx, 1, b1, b2);
  }
  return boxes.map(getAverageColor);
}

// --- K-means refinement in Oklab space ---

function oklabDistSq(a, b) {
  const dL = a[0] - b[0], da = a[1] - b[1], db = a[2] - b[2];
  return dL * dL + da * da + db * db;
}

function findNearestCenter(color, centers) {
  let minDist = Infinity, closest = 0;
  for (let i = 0; i < centers.length; i++) {
    const d = oklabDistSq(color, centers[i]);
    if (d < minDist) { minDist = d; closest = i; }
  }
  return closest;
}

function kmeansRefine(cellColors, centers, iterations) {
  const n = cellColors.length;
  const k = centers.length;
  // Work on a mutable copy of centers
  centers = centers.map(c => [c[0], c[1], c[2]]);

  for (let iter = 0; iter < iterations; iter++) {
    // Accumulate sums per cluster
    const sumL = new Float64Array(k);
    const sumA = new Float64Array(k);
    const sumB = new Float64Array(k);
    const counts = new Uint32Array(k);

    for (let i = 0; i < n; i++) {
      const ci = findNearestCenter(cellColors[i], centers);
      sumL[ci] += cellColors[i][0];
      sumA[ci] += cellColors[i][1];
      sumB[ci] += cellColors[i][2];
      counts[ci]++;
    }

    for (let j = 0; j < k; j++) {
      if (counts[j] > 0) {
        centers[j][0] = sumL[j] / counts[j];
        centers[j][1] = sumA[j] / counts[j];
        centers[j][2] = sumB[j] / counts[j];
      }
    }
  }
  return centers;
}

// --- Public API ---

// Calculate grid dimensions preserving aspect ratio
export function calculateGridDimensions(imgWidth, imgHeight, maxCells) {
  const aspect = imgWidth / imgHeight;
  let height = Math.floor(Math.sqrt(maxCells / aspect));
  let width = Math.floor(height * aspect);

  // Clamp
  width = Math.max(CONFIG.MIN_GRID_DIM, Math.min(CONFIG.MAX_GRID_DIM, width));
  height = Math.max(CONFIG.MIN_GRID_DIM, Math.min(CONFIG.MAX_GRID_DIM, height));

  // Ensure total cells doesn't exceed max
  while (width * height > CONFIG.MAX_CELLS) {
    if (width > height) width--;
    else height--;
  }

  return { width, height };
}

// Quantize image data into grid with palette indices
// Returns { palette: [[r,g,b],...], targetIndices: Uint8Array }
export function quantizeImage(imageData, gridWidth, gridHeight, numColors) {
  const { data, width, height } = imageData;
  const cellWidth = width / gridWidth;
  const cellHeight = height / gridHeight;
  const totalCells = gridWidth * gridHeight;

  // Area-averaged cell sampling in Oklab space
  const cellColors = new Array(totalCells);
  for (let row = 0; row < gridHeight; row++) {
    for (let col = 0; col < gridWidth; col++) {
      const x0 = Math.floor(col * cellWidth);
      const y0 = Math.floor(row * cellHeight);
      const x1 = Math.floor((col + 1) * cellWidth);
      const y1 = Math.floor((row + 1) * cellHeight);
      let sumL = 0, sumA = 0, sumB = 0, count = 0;
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const idx = (y * width + x) * 4;
          const lab = srgbToOklab(data[idx], data[idx + 1], data[idx + 2]);
          sumL += lab[0]; sumA += lab[1]; sumB += lab[2];
          count++;
        }
      }
      if (count === 0) {
        // Fallback to center pixel
        const cx = Math.floor(col * cellWidth + cellWidth / 2);
        const cy = Math.floor(row * cellHeight + cellHeight / 2);
        const idx = (cy * width + cx) * 4;
        cellColors[row * gridWidth + col] = srgbToOklab(data[idx], data[idx + 1], data[idx + 2]);
      } else {
        cellColors[row * gridWidth + col] = [sumL / count, sumA / count, sumB / count];
      }
    }
  }

  // Median-cut in Oklab space
  let palette = medianCut(cellColors, numColors);

  // K-means refinement (3 iterations)
  palette = kmeansRefine(cellColors, palette, 3);

  // Convert palette from Oklab to sRGB
  const rgbPalette = palette.map(c => oklabToSrgb(c[0], c[1], c[2]));

  // Assign each cell to nearest palette color (in Oklab space)
  const targetIndices = new Uint8Array(totalCells);
  for (let i = 0; i < totalCells; i++) {
    targetIndices[i] = findNearestCenter(cellColors[i], palette);
  }

  return { palette: rgbPalette, targetIndices };
}
