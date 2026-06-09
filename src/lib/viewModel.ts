import type { Board, Milestone, Synced, SyncedEntry } from "./types";
import { refKey } from "./refKey";
import { buildWeeks, toISODate, weekFraction, type Week } from "./weeks";
import type { IssueLive } from "./providers/types";

/**
 * Render-ready milestone: hand-authored config with live synced values merged
 * over the top (live wins where a sourceRef resolves; hand values are fallback).
 */
export interface ResolvedMilestone {
  id: string;
  title: string;
  detail: string;
  isLaunch: boolean;
  /** Display status string for the card. */
  status: string;
  /** Live milestone state if synced, else null. */
  liveState: "active" | "closed" | null;
  /** Effective target date (live dueDate wins, else hand targetDate). */
  targetDate: string | null;
  /** Fractional week position; null when there is no date at all. */
  weekFraction: number | null;
  /** Progress from synced issues, or null if not synced. */
  progress: { closed: number; total: number } | null;
  /** Deep link to the underlying VCS milestone (synced only). */
  url: string | null;
  issues: IssueLive[];
  synced: boolean;
  syncedAt: string | null;
  hasSourceRef: boolean;
}

export interface ResolvedLane {
  id: string;
  title: string;
  color: string;
  launchLabel: string;
  provider: "gitlab" | "github";
  milestones: ResolvedMilestone[];
}

export interface ResolvedBoard {
  name: string;
  startWeek: string;
  horizonWeeks: number;
  weeks: Week[];
  lanes: ResolvedLane[];
  dependencies: { from: string; to: string }[];
  /** Fractional week position of "today" (may be outside [0, horizon]). */
  todayFraction: number;
  lastSyncAt: string | null;
}

function resolveMilestone(m: Milestone, startWeek: string, synced: Synced): ResolvedMilestone {
  const entry: SyncedEntry | undefined = m.sourceRef ? synced.entries[refKey(m.sourceRef)] : undefined;

  const targetDate = entry?.dueDate ?? m.targetDate ?? null;
  const liveState = entry?.state ?? null;
  const status = entry && entry.state === "closed" ? "Closed" : m.status;

  return {
    id: m.id,
    title: m.title,
    detail: m.detail ?? "",
    isLaunch: m.isLaunch ?? false,
    status,
    liveState,
    targetDate,
    weekFraction: targetDate ? weekFraction(startWeek, targetDate) : null,
    progress: entry ? { closed: entry.issuesClosed, total: entry.issuesTotal } : null,
    url: entry?.url ?? null,
    issues: entry?.issues ?? [],
    synced: Boolean(entry),
    syncedAt: entry?.syncedAt ?? null,
    hasSourceRef: Boolean(m.sourceRef),
  };
}

/** Merge board.json + synced.json into a single render-ready view model. */
export function buildViewModel(board: Board, synced: Synced, today: Date = new Date()): ResolvedBoard {
  const { startWeek, horizonWeeks, name } = board.board;
  const weeks = buildWeeks(startWeek, horizonWeeks);

  const lanes: ResolvedLane[] = board.lanes.map((lane) => ({
    id: lane.id,
    title: lane.title,
    color: lane.color,
    launchLabel: lane.launchLabel ?? "",
    provider: lane.provider,
    milestones: lane.milestones.map((m) => resolveMilestone(m, startWeek, synced)),
  }));

  return {
    name,
    startWeek,
    horizonWeeks,
    weeks,
    lanes,
    dependencies: board.dependencies,
    todayFraction: weekFraction(startWeek, toISODate(today)),
    lastSyncAt: synced.lastSyncAt,
  };
}
