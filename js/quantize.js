// quantize.js — Median-cut color quantization (up to 64 colors)

import { findClosestColorIndex } from './utils.js';
import { CONFIG } from './config.js';

function createBox(colors) {
  let rMin = 255, rMax = 0, gMin = 255, gMax = 0, bMin = 255, bMax = 0;
  for (const c of colors) {
    if (c[0] < rMin) rMin = c[0]; if (c[0] > rMax) rMax = c[0];
    if (c[1] < gMin) gMin = c[1]; if (c[1] > gMax) gMax = c[1];
    if (c[2] < bMin) bMin = c[2]; if (c[2] > bMax) bMax = c[2];
  }
  return { colors, rMin, rMax, gMin, gMax, bMin, bMax };
}

function getBoxVolume(box) {
  return (box.rMax - box.rMin + 1) * (box.gMax - box.gMin + 1) * (box.bMax - box.bMin + 1);
}

function splitBox(box) {
  const rRange = box.rMax - box.rMin;
  const gRange = box.gMax - box.gMin;
  const bRange = box.bMax - box.bMin;

  let dim;
  if (rRange >= gRange && rRange >= bRange) dim = 0;
  else if (gRange >= rRange && gRange >= bRange) dim = 1;
  else dim = 2;

  const sorted = box.colors.slice().sort((a, b) => a[dim] - b[dim]);
  const mid = sorted.length >> 1;
  return [createBox(sorted.slice(0, mid)), createBox(sorted.slice(mid))];
}

function getAverageColor(box) {
  let r = 0, g = 0, b = 0;
  for (const c of box.colors) { r += c[0]; g += c[1]; b += c[2]; }
  const n = box.colors.length;
  return [Math.round(r / n), Math.round(g / n), Math.round(b / n)];
}

function medianCut(colors, numColors) {
  if (colors.length === 0) return [];
  if (colors.length <= numColors) return colors;

  let boxes = [createBox(colors)];
  while (boxes.length < numColors) {
    // Sort by volume descending, prefer splitting largest
    boxes.sort((a, b) => getBoxVolume(b) - getBoxVolume(a));
    const splitIdx = boxes.findIndex(b => b.colors.length > 1);
    if (splitIdx === -1) break;
    const [b1, b2] = splitBox(boxes[splitIdx]);
    boxes.splice(splitIdx, 1, b1, b2);
  }
  return boxes.map(getAverageColor);
}

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

  // Sample colors at grid cell centers
  const sampledColors = new Array(totalCells);
  for (let row = 0; row < gridHeight; row++) {
    for (let col = 0; col < gridWidth; col++) {
      const x = Math.floor(col * cellWidth + cellWidth / 2);
      const y = Math.floor(row * cellHeight + cellHeight / 2);
      const pixIdx = (y * width + x) * 4;
      sampledColors[row * gridWidth + col] = [data[pixIdx], data[pixIdx + 1], data[pixIdx + 2]];
    }
  }

  // Generate palette via median cut
  const palette = medianCut(sampledColors, numColors);

  // Map each cell to closest palette color
  const targetIndices = new Uint8Array(totalCells);
  for (let i = 0; i < totalCells; i++) {
    const c = sampledColors[i];
    targetIndices[i] = findClosestColorIndex(c[0], c[1], c[2], palette);
  }

  return { palette, targetIndices };
}
