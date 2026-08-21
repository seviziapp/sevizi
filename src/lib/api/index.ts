// Sèvizi — API barrel. Re-exports every domain module so existing imports
// like `from '../../src/lib/api'` keep working unchanged after the Phase 1
// split of the former monolithic api.ts into client/profile/provider/admin/
// booking/discounts. Only LOME is re-exported from shared.ts — hasSupabase,
// currentUser, the mock data, and byTierThenDistance were never part of the
// original public API and stay internal to the api/* modules.
export { LOME } from './shared';
export * from './client';
export * from './profile';
export * from './provider';
export * from './admin';
export * from './booking';
export * from './discounts';
