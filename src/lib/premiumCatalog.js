// Feste Preistabelle: 2,5x Aufschlag gegenueber dem guenstigsten EUR-Token-Kurs, damit ein
// Kauf ueber Tokens die direkten EUR-Verkaeufe im Shop nicht unterbietet (Absicht des Nutzers:
// "mach vielleicht die preise fuer premium produkte deutlich hoeher" statt eines Limits).
export const PREMIUM_CATALOG = [
  {
    productKey: 'fahrstuhl_basic',
    name: 'Fahrstuhl Premium',
    priceTokens: 3000,
  },
  {
    productKey: 'fahrstuhl_pro',
    name: 'Fahrstuhl Premium Pro',
    priceTokens: 6000,
  },
  {
    productKey: 'eselbuilder_pro',
    name: 'Eselbuilder Pro',
    priceTokens: 6000,
  },
  {
    productKey: 'eselmoderator_basic',
    name: 'EselModerator Premium',
    priceTokens: 3000,
  },
  {
    productKey: 'eselmoderator_pro',
    name: 'EselModerator Premium Pro',
    priceTokens: 6000,
  },
];

export function findPremiumProduct(productKey) {
  return PREMIUM_CATALOG.find((p) => p.productKey === productKey);
}
