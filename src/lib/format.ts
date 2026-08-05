// Shared "time ago" formatting — minutes under a day, days beyond that.
export function timeAgo(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 60) return `${Math.max(mins, 0)} min`;
  if (mins < 1440) return `${Math.round(mins / 60)} h`;
  const days = Math.round(mins / 1440);
  return `${days} j`;
}

// Turns a business name into a URL-safe handle — strips accents (so "Élec
// Express" survives), lowercases, collapses anything non-alphanumeric into a
// single hyphen, trims to the DB's 3-30 char constraint
// (providers_username_format in migration_provider_username.sql).
export function slugify(input: string): string {
  const slug = input
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // strip diacritics
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 30);
  return slug.length >= 3 ? slug : slug.padEnd(3, '0');
}
