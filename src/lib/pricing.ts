import type { ProviderTier } from './types';

// Sèvizi's commission model — single source of truth.
//
// Suggested launch rate: 10%, deducted from the provider's payout (the client
// always pays exactly the price they agreed to). Reasoning: established gig/
// service marketplaces typically run 15-30%+ (Handy, TaskRabbit, Uber-type
// platforms); starting lower keeps friction low for both sides while the
// marketplace is still building trust and liquidity in a new market, and it's
// easy to raise later once supply/demand is established. Change this one
// constant to adjust the rate everywhere it's shown or calculated.
export const COMMISSION_RATE = 0.10;

// Sèvizi Pro subscribers get a lower commission (see PRO_MONTHLY_FEE) — the
// headline perk since it's directly tied to money providers already track.
export const COMMISSION_RATE_PRO = 0.07;

export function getCommissionRate(tier?: ProviderTier): number {
  return tier === 'pro' ? COMMISSION_RATE_PRO : COMMISSION_RATE;
}

export function computeCommission(price: number, tier?: ProviderTier) {
  const rate = getCommissionRate(tier);
  const commission = Math.round(price * rate);
  return { price, commission, net: price - commission };
}

export function formatCommissionPct(tier?: ProviderTier): string {
  return `${Math.round(getCommissionRate(tier) * 100)}%`;
}

// ---- Sèvizi Pro subscription ----

export const PRO_MONTHLY_FEE = 5000; // FCFA / month
export const GALLERY_CAP_FREE = 3;   // gallery photos allowed on the free tier (unlimited on Pro)

export const PRO_FEATURES = [
  'Badge « Vérifié » — vetté par Sèvizi',
  `Commission réduite (${Math.round(COMMISSION_RATE_PRO * 100)}% au lieu de ${Math.round(COMMISSION_RATE * 100)}%)`,
  'Placement prioritaire dans les recherches à proximité',
  'Voir les offres des autres prestataires sur une même demande',
  'Statistiques avancées (tendances, meilleure catégorie, clients fidèles)',
  'Proposer plusieurs services (ex. plomberie + électricité + mécanique)',
  'Galerie de travaux illimitée (contre 3 photos en gratuit)',
];
