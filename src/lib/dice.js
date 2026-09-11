export const MIN_TARGET = 2;
export const MAX_TARGET = 98;
export const HOUSE_EDGE = 0.97;

// roll ist 0.00-99.99 in 0.01-Schritten (randomInt auf 0-9999 skaliert).
// 'under': gewinnt wenn roll < target, Gewinnchance = target%.
// 'over':  gewinnt wenn roll > target, Gewinnchance = (100-target)%.
export function computeWinChance(direction, target) {
  return direction === 'under' ? target : 100 - target;
}

export function computeMultiplier(direction, target) {
  const winChance = computeWinChance(direction, target);
  return Math.round((HOUSE_EDGE * 100 / winChance) * 10000) / 10000;
}
