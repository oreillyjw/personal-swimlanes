/**
 * Date helpers. Dates are handled as UTC calendar days (yyyy-mm-dd) to avoid
 * timezone drift in week/bucket placement.
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Parse an ISO yyyy-mm-dd (or full ISO) into a UTC-midnight Date. */
export function parseDay(iso: string): Date {
  // Take just the date portion so a time/zone suffix can't shift the day.
  const datePart = iso.slice(0, 10);
  const [y, m, d] = datePart.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Monday of the week containing `d` (UTC). */
export function mondayOf(d: Date): Date {
  const day = d.getUTCDay(); // 0=Sun..6=Sat
  const diff = (day + 6) % 7; // days since Monday
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - diff * MS_PER_DAY);
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "Jun 8" style label for an ISO date (UTC). */
export function formatMonthDay(iso: string): string {
  const d = parseDay(iso);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
}
