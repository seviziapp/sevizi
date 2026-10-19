import { tr } from '../i18n';
// Shared "time ago" formatting — minutes under a day, days beyond that.
/** "Il y a 5 min" / "5 min ago" */
export function agoText(iso: string): string {
  return tr('Il y a {t}', { t: timeAgo(iso) });
}

export function timeAgo(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 60) return tr('{n} min', { n: Math.max(mins, 0) });
  if (mins < 1440) return tr('{n} h', { n: Math.round(mins / 60) });
  const days = Math.round(mins / 1440);
  return tr('{n} j', { n: days });
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
