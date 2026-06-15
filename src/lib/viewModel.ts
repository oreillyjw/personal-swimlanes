import type { Board, Item, Synced, SyncedIssue } from "./types";
import { buildWeeks, formatMonthDay, toISODate, weekFraction, type Week } from "./weeks";

export interface IssueLite {
  title: string;
  state: string;
  url: string;
}

/** A planned item resolved with live status from the synced cache. */
export interface ResolvedItem {
  id: string;
  laneId: string;
  kind: "milestone" | "issue";
  title: string; // live title if linked, else the planned title
  detail: string;
  isLaunch: boolean;
  targetDate: string | null;
  dateLabel: string;
  weekFraction: number | null;
  /** Display status: "Done" | "In Progress" | "To Do" | "Planned". */
  status: string;
  liveState: "active" | "closed" | null;
  progress: { closed: number; total: number } | null; // milestones only
  issues: IssueLite[]; // milestone's issues, for the detail view
  overdue: boolean;
  url: string | null;
  tags: string[];
  /** The linked VCS ref, if any (for display + unlink). */
  sourceRef: { provider: "gitlab" | "github"; project: string; type: "milestone" | "issue"; id: string } | null;
  /** True when sourceRef is set but no matching data was found in the last sync. */
  linkUnresolved: boolean;
  hasSourceRef: boolean;
}

export interface ResolvedLane {
  id: string;
  title: string;
  color: string;
  items: ResolvedItem[];
}

/** A milestone/issue from the sync that is not yet placed on the plan. */
export interface AvailableRef {
  key: string; // provider:project:type:id
  provider: "gitlab" | "github";
  project: string;
  type: "milestone" | "issue";
  id: string;
  title: string;
  dueDate: string | null;
  state: "open" | "closed" | "mixed";
}

export interface ResolvedDependency {
  from: string;
  to: string;
  /** Prerequisite is planned to finish after the dependent — ordering violated. */
  slip: boolean;
}

export interface ResolvedBoard {
  name: string;
  startWeek: string;
  horizonWeeks: number;
  weeks: Week[];
  lanes: ResolvedLane[];
  dependencies: ResolvedDependency[];
  todayFraction: number;
  lastSyncAt: string | null;
  /** Unplaced milestones + issues, for the "Add to plan" panel. */
  available: { milestones: AvailableRef[]; issues: AvailableRef[] };
  /** Every synced milestone + issue (placed or not), for the link picker. */
  allRefs: { milestones: AvailableRef[]; issues: AvailableRef[] };
}

/** Index of synced data for fast lookup while resolving items. */
interface SyncIndex {
  /** key provider:project:number -> issue */
  issueByKey: Map<string, SyncedIssue>;
  /** key provider:project:milestoneId -> issues in that milestone */
  milestoneIssues: Map<string, SyncedIssue[]>;
  /** key provider:project:milestoneId -> {title, dueDate} */
  milestoneMeta: Map<string, { title: string; dueDate: string | null }>;
}

function buildIndex(synced: Synced): SyncIndex {
  const issueByKey = new Map<string, SyncedIssue>();
  const milestoneIssues = new Map<string, SyncedIssue[]>();
  const milestoneMeta = new Map<string, { title: string; dueDate: string | null }>();

  for (const [srcKey, src] of Object.entries(synced.sources)) {
    for (const issue of src.issues) {
      issueByKey.set(`${srcKey}:${issue.number}`, issue);
      if (issue.milestone) {
        const mKey = `${srcKey}:${issue.milestone.id}`;
        const arr = milestoneIssues.get(mKey) ?? [];
        arr.push(issue);
        milestoneIssues.set(mKey, arr);
        if (!milestoneMeta.has(mKey)) {
          milestoneMeta.set(mKey, { title: issue.milestone.title, dueDate: issue.milestone.dueDate });
        }
      }
    }
  }
  return { issueByKey, milestoneIssues, milestoneMeta };
}

function statusFor(liveState: "active" | "closed" | null, progress: { closed: number; total: number } | null): string {
  if (liveState === "closed") return "Done";
  if (progress && progress.closed > 0 && progress.closed < progress.total) return "In Progress";
  if (liveState === "active") return "To Do";
  return "Planned";
}

function resolveItem(item: Item, startWeek: string, todayISO: string, idx: SyncIndex): ResolvedItem {
  let liveState: "active" | "closed" | null = null;
  let progress: { closed: number; total: number } | null = null;
  let issues: IssueLite[] = [];
  let url: string | null = null;
  let liveTitle: string | null = null;
  let resolved = false;

  if (item.sourceRef) {
    const base = `${item.sourceRef.provider}:${item.sourceRef.project}:${item.sourceRef.id}`;
    if (item.sourceRef.type === "milestone") {
      const list = idx.milestoneIssues.get(base) ?? [];
      const meta = idx.milestoneMeta.get(base);
      if (meta || list.length) {
        resolved = true;
        const closed = list.filter((i) => i.state === "closed").length;
        progress = { closed, total: list.length };
        liveState = list.length > 0 && closed === list.length ? "closed" : "active";
        issues = list.map((i) => ({ title: i.title, state: i.state, url: i.url }));
        liveTitle = meta?.title ?? null;
      }
    } else {
      const issue = idx.issueByKey.get(base);
      if (issue) {
        resolved = true;
        liveState = issue.state === "closed" ? "closed" : "active";
        url = issue.url;
        liveTitle = issue.title;
      }
    }
  }

  const targetDate = item.targetDate ?? null;
  const overdue = Boolean(targetDate && targetDate < todayISO && liveState !== "closed");

  return {
    id: item.id,
    laneId: item.laneId,
    kind: item.kind,
    title: liveTitle || item.title,
    detail: item.detail ?? "",
    isLaunch: item.isLaunch ?? false,
    targetDate,
    dateLabel: targetDate ? formatMonthDay(targetDate) : "no date",
    weekFraction: targetDate ? weekFraction(startWeek, targetDate) : null,
    status: statusFor(liveState, progress),
    liveState,
    progress,
    issues,
    overdue,
    url,
    tags: item.tags ?? [],
    sourceRef: item.sourceRef ?? null,
    linkUnresolved: Boolean(item.sourceRef) && !resolved,
    hasSourceRef: Boolean(item.sourceRef),
  };
}

const byProjectTitle = (a: AvailableRef, b: AvailableRef) =>
  a.project.localeCompare(b.project) || a.title.localeCompare(b.title);

/** Collect every synced milestone + issue as AvailableRefs. */
function collectRefs(synced: Synced): { milestones: AvailableRef[]; issues: AvailableRef[] } {
  const milestones = new Map<string, AvailableRef>();
  const issues: AvailableRef[] = [];

  for (const [srcKey, src] of Object.entries(synced.sources)) {
    const idx = srcKey.indexOf(":");
    const provider = srcKey.slice(0, idx) as "gitlab" | "github";
    const project = srcKey.slice(idx + 1);

    for (const issue of src.issues) {
      issues.push({
        key: `${provider}:${project}:issue:${issue.number}`,
        provider,
        project,
        type: "issue",
        id: issue.number,
        title: issue.title,
        dueDate: issue.dueDate,
        state: issue.state,
      });
      if (issue.milestone) {
        const mKey = `${provider}:${project}:milestone:${issue.milestone.id}`;
        if (!milestones.has(mKey)) {
          milestones.set(mKey, {
            key: mKey,
            provider,
            project,
            type: "milestone",
            id: issue.milestone.id,
            title: issue.milestone.title,
            dueDate: issue.milestone.dueDate,
            state: "mixed",
          });
        }
      }
    }
  }

  return {
    milestones: [...milestones.values()].sort(byProjectTitle),
    issues: issues.sort(byProjectTitle),
  };
}

/** Merge board (the plan) + synced (live state) into a render-ready timeline. */
export function buildViewModel(board: Board, synced: Synced, today: Date = new Date()): ResolvedBoard {
  const { startWeek, horizonWeeks, name } = board.board;
  const todayISO = toISODate(today);
  const weeks = buildWeeks(startWeek, horizonWeeks);
  const idx = buildIndex(synced);

  const itemById = new Map<string, Item>();
  for (const it of board.items) itemById.set(it.id, it);

  const lanes: ResolvedLane[] = board.lanes.map((lane) => ({
    id: lane.id,
    title: lane.title,
    color: lane.color,
    items: board.items
      .filter((it) => it.laneId === lane.id)
      .map((it) => resolveItem(it, startWeek, todayISO, idx)),
  }));

  const dependencies: ResolvedDependency[] = board.dependencies.map((dep) => {
    const from = itemById.get(dep.from);
    const to = itemById.get(dep.to);
    const slip = Boolean(from?.targetDate && to?.targetDate && from.targetDate > to.targetDate);
    return { from: dep.from, to: dep.to, slip };
  });

  // Refs already placed (so the Add panel doesn't offer them again).
  const placed = new Set<string>();
  for (const it of board.items) {
    if (it.sourceRef) {
      placed.add(`${it.sourceRef.provider}:${it.sourceRef.project}:${it.sourceRef.type}:${it.sourceRef.id}`);
    }
  }
  const allRefs = collectRefs(synced);
  const available = {
    milestones: allRefs.milestones.filter((r) => !placed.has(r.key)),
    issues: allRefs.issues.filter((r) => !placed.has(r.key)),
  };

  return {
    name,
    startWeek,
    horizonWeeks,
    weeks,
    lanes,
    dependencies,
    todayFraction: weekFraction(startWeek, todayISO),
    lastSyncAt: synced.lastSyncAt,
    available,
    allRefs,
  };
}
