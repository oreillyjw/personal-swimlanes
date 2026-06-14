import { mondayOf, toISODate } from "./weeks";

/**
 * Past / Current / Future placement for issue tiles.
 *
 * The Current window starts on the Monday of the current week and spans
 * `currentWindowWeeks` weeks. Closed issues are always Past. Open issues land in
 * Future only if their date falls on/after the window end; everything else
 * (in-window, overdue, or undated) is Current.
 */

export type Bucket = "past" | "current" | "future";

export interface CurrentWindow {
  /** ISO Monday of the current week (inclusive). */
  startISO: string;
  /** ISO start of the week after the window (exclusive). */
  endISO: string;
  /** ISO today (UTC day). */
  todayISO: string;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function currentWindow(today: Date, currentWindowWeeks: number): CurrentWindow {
  const start = mondayOf(today);
  const end = new Date(start.getTime() + currentWindowWeeks * 7 * MS_PER_DAY);
  return { startISO: toISODate(start), endISO: toISODate(end), todayISO: toISODate(today) };
}

/**
 * ISO yyyy-mm-dd strings sort lexicographically in chronological order, so plain
 * string comparison is safe (and timezone-free) here.
 */
export function bucketFor(
  issue: { state: "open" | "closed"; dueDate: string | null },
  w: CurrentWindow
): Bucket {
  if (issue.state === "closed") return "past";
  if (issue.dueDate == null) return "current";
  if (issue.dueDate >= w.endISO) return "future";
  return "current"; // in-window or overdue
}

/** An open, dated issue whose date is before today. */
export function isOverdue(
  issue: { state: "open" | "closed"; dueDate: string | null },
  w: CurrentWindow
): boolean {
  return issue.state === "open" && issue.dueDate != null && issue.dueDate < w.todayISO;
}
