/**
 * Week-grid math. All weeks are Monday-start. Dates are handled as UTC calendar
 * days (yyyy-mm-dd) to avoid timezone drift in week placement.
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
  return new Date(d.getTime() - diff * MS_PER_DAY);
}

export function isMonday(iso: string): boolean {
  return parseDay(iso).getUTCDay() === 1;
}

export interface Week {
  index: number; // 0-based
  start: Date; // Monday (UTC midnight)
  label: string; // "W1"
  dateLabel: string; // "Jun 8"
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function formatMonthDay(d: Date): string {
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

/** Build the week ruler from a start-week Monday and a horizon length. */
export function buildWeeks(startWeekISO: string, horizonWeeks: number): Week[] {
  const start = mondayOf(parseDay(startWeekISO));
  const weeks: Week[] = [];
  for (let i = 0; i < horizonWeeks; i++) {
    const ws = new Date(start.getTime() + i * 7 * MS_PER_DAY);
    weeks.push({
      index: i,
      start: ws,
      label: `W${i + 1}`,
      dateLabel: formatMonthDay(ws),
    });
  }
  return weeks;
}

/**
 * Fractional week-index of an arbitrary date relative to the start Monday.
 * 0 = start Monday; 1 = next Monday; 0.5 = Thursday of week 0. A date snaps to
 * a card column via Math.floor; the fraction is used for the Today marker and
 * for precise card centering within its week.
 */
export function weekFraction(startWeekISO: string, dateISO: string): number {
  const start = mondayOf(parseDay(startWeekISO));
  const target = parseDay(dateISO);
  return (target.getTime() - start.getTime()) / (7 * MS_PER_DAY);
}

/** Integer week column for a date (clamped into [0, horizon-1]). */
export function weekIndexFor(startWeekISO: string, dateISO: string, horizonWeeks: number): number {
  const idx = Math.floor(weekFraction(startWeekISO, dateISO));
  return Math.max(0, Math.min(horizonWeeks - 1, idx));
}
