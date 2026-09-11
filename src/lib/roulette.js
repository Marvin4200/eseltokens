import crypto from 'crypto';

// Europaeisches Roulette: 37 Taschen (0-36), eine einzige Null -> der Hausvorteil
// entsteht allein durch die 0 (kein zusaetzlicher Multiplikator-Abschlag noetig,
// anders als bei Mines/Dice/Plinko wo der Edge explizit eingerechnet wird).
export const RED_NUMBERS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);

export const BET_TYPES = [
  'straight', 'red', 'black', 'even', 'odd', 'low', 'high',
  'dozen1', 'dozen2', 'dozen3', 'column1', 'column2', 'column3',
];

export function spinWheel() {
  return crypto.randomInt(37);
}

export function colorOf(number) {
  if (number === 0) return 'green';
  return RED_NUMBERS.has(number) ? 'red' : 'black';
}

// Gibt den Auszahlungs-Multiplikator (inkl. Einsatz) zurueck, oder 0 bei Verlust.
export function evaluateBet(betType, betValue, number) {
  const color = colorOf(number);
  switch (betType) {
    case 'straight':
      return number === betValue ? 36 : 0;
    case 'red':
      return color === 'red' ? 2 : 0;
    case 'black':
      return color === 'black' ? 2 : 0;
    case 'even':
      return number !== 0 && number % 2 === 0 ? 2 : 0;
    case 'odd':
      return number !== 0 && number % 2 === 1 ? 2 : 0;
    case 'low':
      return number >= 1 && number <= 18 ? 2 : 0;
    case 'high':
      return number >= 19 && number <= 36 ? 2 : 0;
    case 'dozen1':
      return number >= 1 && number <= 12 ? 3 : 0;
    case 'dozen2':
      return number >= 13 && number <= 24 ? 3 : 0;
    case 'dozen3':
      return number >= 25 && number <= 36 ? 3 : 0;
    case 'column1':
      return number !== 0 && number % 3 === 1 ? 3 : 0;
    case 'column2':
      return number !== 0 && number % 3 === 2 ? 3 : 0;
    case 'column3':
      return number !== 0 && number % 3 === 0 ? 3 : 0;
    default:
      return 0;
  }
}
