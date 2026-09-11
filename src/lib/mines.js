import crypto from 'crypto';

export const GRID_SIZE = 25;
export const MIN_MINES = 1;
export const MAX_MINES = 24;
export const HOUSE_EDGE = 0.97;

// Fisher-Yates mit crypto.randomInt statt Math.random, damit Minenpositionen
// nicht vorhersagbar sind (gleiche Anforderung wie beim Coinflip-Zufall).
export function generateMinePositions(gridSize, mineCount) {
  const positions = Array.from({ length: gridSize }, (_, i) => i);
  for (let i = positions.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [positions[i], positions[j]] = [positions[j], positions[i]];
  }
  return positions.slice(0, mineCount).sort((a, b) => a - b);
}

// Fairer Multiplikator: Produkt der Wahrscheinlichkeiten, bei jedem weiteren
// Zug kein Feld mit einer Mine zu treffen, minus einem festen Hausvorteil.
// safeTiles = gridSize - mineCount; nach k sicheren Feldern:
// mult = houseEdge * prod_{i=0}^{k-1} (gridSize - i) / (safeTiles - i)
export function computeMultiplier(gridSize, mineCount, revealedCount) {
  if (revealedCount <= 0) return 1;
  const safeTiles = gridSize - mineCount;
  let mult = 1;
  for (let i = 0; i < revealedCount; i++) {
    mult *= (gridSize - i) / (safeTiles - i);
  }
  return Math.round(mult * HOUSE_EDGE * 10000) / 10000;
}
