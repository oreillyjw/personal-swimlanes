/**
 * Week-grid math. All weeks are Monday-start. Dates are handled as UTC calendar
 * days (yyyy-mm-dd) to avoid timezone drift in placement.
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Parse an ISO yyyy-mm-dd (or full ISO) into a UTC-midnight Date. */
export function parseDay(iso: string): Date {
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

/** "Jun 8" style label. Accepts an ISO date string or a Date. */
export function formatMonthDay(d: string | Date): string {
  const date = typeof d === "string" ? parseDay(d) : d;
  return `${MONTHS[date.getUTCMonth()]} ${date.getUTCDate()}`;
}

/** Build the week ruler from a start-week Monday and a horizon length. */
export function buildWeeks(startWeekISO: string, horizonWeeks: number): Week[] {
  const start = mondayOf(parseDay(startWeekISO));
  const weeks: Week[] = [];
  for (let i = 0; i < horizonWeeks; i++) {
    const ws = new Date(start.getTime() + i * 7 * MS_PER_DAY);
    weeks.push({ index: i, start: ws, label: `W${i + 1}`, dateLabel: formatMonthDay(ws) });
  }
  return weeks;
}

/**
 * Fractional week-index of an arbitrary date relative to the start Monday.
 * 0 = start Monday; 1 = next Monday; 0.5 = Thursday of week 0.
 */
export function weekFraction(startWeekISO: string, dateISO: string): number {
  const start = mondayOf(parseDay(startWeekISO));
  const target = parseDay(dateISO);
  return (target.getTime() - start.getTime()) / (7 * MS_PER_DAY);
}
