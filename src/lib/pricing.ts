import type { ProviderTier } from './types';

import { locale, tr } from '../i18n';
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

// Promo: zero commission for every provider (free or Pro) until this date —
// keep in sync with the same constant in
// supabase/functions/paydunya-create-job-invoice/index.ts (a Deno Edge
// Function can't import from here, so it's duplicated there).
export const COMMISSION_FREE_UNTIL = new Date('2027-01-04T00:00:00Z');

// Launch rate for the quarter after the free period (announced ahead of the
// move to the standard rates). Also duplicated in the Edge Function above.
export const COMMISSION_RATE_INTRO = 0.05;
export const COMMISSION_RATE_PRO_INTRO = 0.035;
export const COMMISSION_INTRO_UNTIL = new Date('2027-04-04T00:00:00Z');

export function isCommissionIntroPeriod(now: Date = new Date()): boolean {
  return !isCommissionFreePeriod(now) && now.getTime() < COMMISSION_INTRO_UNTIL.getTime();
}

// Rate as shown to people: 5 -> "5%", 3.5 -> "3,5%".
export function pctLabel(rate: number): string {
  return `${String(Math.round(rate * 1000) / 10).replace('.', ',')}%`;
}

export function isCommissionFreePeriod(now: Date = new Date()): boolean {
  return now.getTime() < COMMISSION_FREE_UNTIL.getTime();
}

function formatPromoEndDate(): string {
  // Explicit UTC timeZone — otherwise a local timezone behind UTC (most of
  // the Americas) rolls midnight back to the previous calendar day.
  return COMMISSION_FREE_UNTIL.toLocaleDateString(locale(), { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
}

// A provider's own admin-granted discount (via a redeemed 'commission' code)
// — `pct` is a percentage taken OFF the normal rate (50 = half price), active
// only while `until` is null (permanent) or still in the future.
export type CommissionDiscount = { pct: number; until: string | null };

function isDiscountActive(discount?: CommissionDiscount): discount is CommissionDiscount {
  if (!discount || discount.pct <= 0) return false;
  return !discount.until || new Date(discount.until).getTime() > Date.now();
}

export function getCommissionRate(tier?: ProviderTier, discount?: CommissionDiscount): number {
  if (isCommissionFreePeriod()) return 0;
  const base = isCommissionIntroPeriod()
    ? (tier === 'pro' ? COMMISSION_RATE_PRO_INTRO : COMMISSION_RATE_INTRO)
    : (tier === 'pro' ? COMMISSION_RATE_PRO : COMMISSION_RATE);
  if (isDiscountActive(discount)) return base * (1 - discount.pct / 100);
  return base;
}

export function computeCommission(price: number, tier?: ProviderTier, discount?: CommissionDiscount) {
  const rate = getCommissionRate(tier, discount);
  const commission = Math.round(price * rate);
  return { price, commission, net: price - commission };
}

export function formatCommissionPct(tier?: ProviderTier, discount?: CommissionDiscount): string {
  return pctLabel(getCommissionRate(tier, discount));
}

// Commission line for the free-tier feature list — reflects the promo while
// it's running, the standard rate once it ends.
export function freeTierCommissionLabel(): string {
  if (isCommissionFreePeriod()) return tr("Commission 0% jusqu'au {date}, puis {pct} pendant 3 mois", { date: formatPromoEndDate(), pct: pctLabel(COMMISSION_RATE_INTRO) });
  if (isCommissionIntroPeriod()) return tr('Commission de lancement {intro} (puis {std} dès le 4 avril 2027)', { intro: pctLabel(COMMISSION_RATE_INTRO), std: pctLabel(COMMISSION_RATE) });
  return tr('Commission standard ({pct})', { pct: pctLabel(COMMISSION_RATE) });
}

// Same for the Pro pitch line.
export function proTierCommissionLabel(): string {
  if (isCommissionFreePeriod()) return tr("Commission 0% pour tous jusqu'au {date}, puis {pro} au lieu de {intro} avec Sèvizi Pro", { date: formatPromoEndDate(), pro: pctLabel(COMMISSION_RATE_PRO_INTRO), intro: pctLabel(COMMISSION_RATE_INTRO) });
  if (isCommissionIntroPeriod()) return tr('Commission réduite ({pro} au lieu de {std})', { pro: pctLabel(COMMISSION_RATE_PRO_INTRO), std: pctLabel(COMMISSION_RATE_INTRO) });
  return tr('Commission réduite ({pro} au lieu de {std})', { pro: pctLabel(COMMISSION_RATE_PRO), std: pctLabel(COMMISSION_RATE) });
}

// ---- Sèvizi Pro subscription ----

export const PRO_MONTHLY_FEE = 3000; // FCFA / month
export const GALLERY_CAP_FREE = 3;   // gallery photos allowed on the free tier (unlimited on Pro)

// Function (not a constant array) so the commission line stays accurate
// across the promo boundary without an app restart.
export function getProFeatures(): string[] {
  return [
    tr('Badge « Vérifié » — vetté par Sèvizi'),
    proTierCommissionLabel(),
    tr('Placement prioritaire dans les recherches à proximité'),
    tr('Voir les offres des autres prestataires sur une même demande'),
    tr('Statistiques avancées (tendances, meilleure catégorie, clients fidèles)'),
    tr('Proposer plusieurs services (ex. plomberie + électricité + mécanique)'),
    tr('Galerie de travaux illimitée (contre 3 photos en gratuit)'),
  ];
}
