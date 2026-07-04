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

export function computeCommission(price: number) {
  const commission = Math.round(price * COMMISSION_RATE);
  return { price, commission, net: price - commission };
}

export function formatCommissionPct(): string {
  return `${Math.round(COMMISSION_RATE * 100)}%`;
}
