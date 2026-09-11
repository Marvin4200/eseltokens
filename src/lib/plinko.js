import crypto from 'crypto';

export const ROWS = 16;

// Multiplier pro Landeslot (17 Slots fuer 16 Reihen). Symmetrische U-Form wie beim klassischen
// Plinko -- Rand = hoher Multiplikator, Mitte = niedrig. Basis-Verhaeltnisse sind die ueblichen
// Plinko-Werte, mit Faktor 1.3337 hochskaliert, damit der Erwartungswert bei denselben 0.97
// Hausvorteil landet wie Mines/Dice/Coinflip (siehe scripts/plinko-ev-check.js fuer die Rechnung).
export const MULTIPLIERS = [
  21.34, 12, 2.67, 1.87, 1.6, 1.47, 1.33, 0.67, 0.4,
  0.67, 1.33, 1.47, 1.6, 1.87, 2.67, 12, 21.34,
];

// Simuliert den Fall der Kugel: 16 unabhaengige Links/Rechts-Entscheidungen per
// crypto.randomInt, der Landeslot ist die Anzahl "rechts" (klassische Binomialverteilung,
// gleiche Fairness-Garantie wie bei Coinflip/Dice).
export function dropBall() {
  const path = [];
  let rightCount = 0;
  for (let i = 0; i < ROWS; i++) {
    const goRight = crypto.randomInt(2) === 1;
    path.push(goRight ? 'R' : 'L');
    if (goRight) rightCount++;
  }
  return { path, slot: rightCount, multiplier: MULTIPLIERS[rightCount] };
}
