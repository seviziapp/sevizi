// Shared "time ago" formatting — minutes under a day, days beyond that.
export function timeAgo(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 60) return `${Math.max(mins, 0)} min`;
  if (mins < 1440) return `${Math.round(mins / 60)} h`;
  const days = Math.round(mins / 1440);
  return `${days} j`;
}
