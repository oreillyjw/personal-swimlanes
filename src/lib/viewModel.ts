import type { Board, Synced } from "./types";
import { issueKey, refKey } from "./refKey";
import { formatMonthDay } from "./weeks";
import { bucketFor, currentWindow, isOverdue, type Bucket } from "./bucket";

/** A single issue rendered as a tile in one column of a swimlane. */
export interface Tile {
  key: string; // provider:project:number — stable id for hide/pin
  number: string;
  title: string;
  date: string | null; // ISO
  dateLabel: string; // "Jun 8" or "No date"
  state: "open" | "closed";
  bucket: Bucket;
  overdue: boolean;
  milestoneTitle: string | null;
  url: string;
  pinned: boolean;
  hidden: boolean;
}

export interface ResolvedSwimlane {
  id: string;
  title: string;
  color: string;
  isCatchAll: boolean;
  past: Tile[];
  current: Tile[];
  future: Tile[];
  /** Visible tile count across all columns. */
  count: number;
}

export interface ResolvedBoard {
  name: string;
  swimlanes: ResolvedSwimlane[];
  lastSyncAt: string | null;
  counts: { shown: number; hidden: number; total: number };
}

const CATCH_ALL_ID = "__catch_all__";

/** Split a "provider:project" source key back into its parts. */
function splitSourceKey(key: string): { provider: string; project: string } {
  const idx = key.indexOf(":");
  return { provider: key.slice(0, idx), project: key.slice(idx + 1) };
}

/** Pinned first, then by date (undated last), then title. */
function sortTiles(tiles: Tile[]): void {
  tiles.sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    if (a.date && b.date) return a.date < b.date ? -1 : a.date > b.date ? 1 : a.title.localeCompare(b.title);
    if (a.date) return -1;
    if (b.date) return 1;
    return a.title.localeCompare(b.title);
  });
}

/**
 * Build the render-ready board: every synced issue placed into a swimlane (by its
 * native milestone → swimlane map, else Catch-all) and a Past/Current/Future
 * column (by state + date). Local hide/pin from board.issueState is applied.
 */
export function buildViewModel(
  board: Board,
  synced: Synced,
  today: Date = new Date(),
  opts: { showHidden?: boolean } = {}
): ResolvedBoard {
  const showHidden = opts.showHidden ?? false;
  const window = currentWindow(today, board.board.currentWindowWeeks);

  // milestone refKey -> swimlane id
  const milestoneToLane = new Map<string, string>();
  for (const lane of board.swimlanes) {
    for (const ref of lane.milestones) milestoneToLane.set(refKey(ref), lane.id);
  }

  // Init a bucket-holder per configured swimlane, plus the synthetic catch-all.
  const make = (id: string, title: string, color: string, isCatchAll: boolean): ResolvedSwimlane => ({
    id,
    title,
    color,
    isCatchAll,
    past: [],
    current: [],
    future: [],
    count: 0,
  });
  const lanes = new Map<string, ResolvedSwimlane>();
  for (const l of board.swimlanes) lanes.set(l.id, make(l.id, l.title, l.color, false));
  const catchAll = make(CATCH_ALL_ID, "Catch-all", "#64748b", true);

  let hidden = 0;
  let shown = 0;
  let total = 0;

  for (const [srcKey, src] of Object.entries(synced.sources)) {
    const { provider, project } = splitSourceKey(srcKey);
    for (const issue of src.issues) {
      total++;
      const key = issueKey(provider, project, issue.number);
      const override = board.issueState[key];
      const isHidden = override?.hidden ?? false;
      const isPinned = override?.pinned ?? false;
      if (isHidden) {
        hidden++;
        if (!showHidden) continue;
      } else {
        shown++;
      }

      const laneId = issue.milestone
        ? milestoneToLane.get(refKey({ provider: provider as "gitlab" | "github", project, id: issue.milestone.id }))
        : undefined;
      const lane = (laneId && lanes.get(laneId)) || catchAll;

      const bucket = bucketFor(issue, window);
      const tile: Tile = {
        key,
        number: issue.number,
        title: issue.title,
        date: issue.dueDate,
        dateLabel: issue.dueDate ? formatMonthDay(issue.dueDate) : "No date",
        state: issue.state,
        bucket,
        overdue: isOverdue(issue, window),
        milestoneTitle: issue.milestone?.title ?? null,
        url: issue.url,
        pinned: isPinned,
        hidden: isHidden,
      };
      lane[bucket].push(tile);
    }
  }

  const finalize = (l: ResolvedSwimlane): ResolvedSwimlane => {
    sortTiles(l.past);
    sortTiles(l.current);
    sortTiles(l.future);
    l.count = l.past.length + l.current.length + l.future.length;
    return l;
  };

  const swimlanes = board.swimlanes.map((l) => finalize(lanes.get(l.id)!));
  finalize(catchAll);
  if (catchAll.count > 0) swimlanes.push(catchAll);

  return {
    name: board.board.name,
    swimlanes,
    lastSyncAt: synced.lastSyncAt,
    counts: { shown, hidden, total },
  };
}
