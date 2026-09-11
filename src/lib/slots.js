import crypto from 'crypto';

// Gewichte summieren sich zu 100 -- crypto.randomInt(100) pro Walze bildet damit direkt die
// Wahrscheinlichkeit ab. pay2/pay3 sind mit Faktor 0.8623 auf denselben 0.97-Erwartungswert
// skaliert wie die anderen Spiele (siehe scripts/slots-ev-check.js fuer die Rechnung:
// EV = sum_i [ P(exactly 3 same)_i * pay3_i + P(exactly 2 same)_i * pay2_i ]).
export const SYMBOLS = [
  { name: 'cherry', emoji: '🍒', weight: 35, pay2: 0.86, pay3: 2.59 },
  { name: 'lemon', emoji: '🍋', weight: 25, pay2: 1.29, pay3: 4.31 },
  { name: 'bell', emoji: '🔔', weight: 20, pay2: 1.72, pay3: 6.9 },
  { name: 'diamond', emoji: '💎', weight: 12, pay2: 2.59, pay3: 12.93 },
  { name: 'seven', emoji: '7️⃣', weight: 6, pay2: 4.31, pay3: 34.49 },
  { name: 'donkey', emoji: '🫏', weight: 2, pay2: 8.62, pay3: 129.35 },
];

const TOTAL_WEIGHT = SYMBOLS.reduce((s, x) => s + x.weight, 0);

function spinReel() {
  let roll = crypto.randomInt(TOTAL_WEIGHT);
  for (const s of SYMBOLS) {
    if (roll < s.weight) return s;
    roll -= s.weight;
  }
  return SYMBOLS[0];
}

export function spinSlots() {
  const reels = [spinReel(), spinReel(), spinReel()];
  const [a, b, c] = reels;

  let multiplier = 0;
  if (a.name === b.name && b.name === c.name) {
    multiplier = a.pay3;
  } else if (a.name === b.name || b.name === c.name || a.name === c.name) {
    const matched = a.name === b.name ? a : b.name === c.name ? b : a;
    multiplier = matched.pay2;
  }

  return {
    symbols: reels.map((s) => s.emoji),
    multiplier: Math.round(multiplier * 100) / 100,
  };
}
