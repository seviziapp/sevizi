// Client + provider must keep all contact and payment on Sèvizi — if they
// exchange raw phone numbers or emails, they can (and often do) move the
// relationship off-platform, and we lose any ability to help if something
// goes wrong. This is a best-effort, low-false-positive check run before a
// message is sent; the database also redacts on insert as a second layer
// (see migration_no_contact_sharing.sql) in case this client-side check is
// bypassed.

const EMAIL_PATTERN = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;

// Require 7+ actual digit characters within a tight run (short gaps of
// spaces/dots/dashes/parens allowed between them) so we flag real phone
// numbers ("90 12 34 56", "+228 90123456") without tripping on incidental
// numbers in normal conversation ("vers 14h30", "5000 F", "3 chambres").
function hasPhoneLikeSequence(text: string): boolean {
  const candidates = text.match(/[0-9][0-9 .()-]{5,}[0-9]/g) ?? [];
  return candidates.some(c => (c.match(/\d/g)?.length ?? 0) >= 7);
}

export function containsContactInfo(text: string): boolean {
  return EMAIL_PATTERN.test(text) || hasPhoneLikeSequence(text);
}
