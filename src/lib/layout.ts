import type { ResolvedBoard, ResolvedLane, ResolvedItem } from "./viewModel";

/** Fixed geometry. WEEK_WIDTH is variable (zoom) and passed in. */
export const LABEL_WIDTH = 220;
export const RULER_HEIGHT = 56;
export const LANE_HEIGHT = 188;
export const CARD_HEIGHT = 120;
export const SLOT_GAP = 12; // horizontal gap between cards sharing a week
export const MIN_WEEK_WIDTH = 96;
export const MAX_WEEK_WIDTH = 260;
export const DEFAULT_WEEK_WIDTH = 156;

export interface ItemPlacement {
  item: ResolvedItem;
  laneId: string;
  laneIndex: number;
  column: number;
  cx: number; // center X within the track
  cy: number; // center Y within the track
  left: number;
  top: number;
  width: number;
}

export interface BoardLayout {
  weekWidth: number;
  trackWidth: number;
  lanesHeight: number;
  visibleLanes: ResolvedLane[];
  placements: ItemPlacement[];
  byId: Map<string, ItemPlacement>;
}

export function clampColumn(weekFraction: number, horizonWeeks: number): number {
  return Math.max(0, Math.min(horizonWeeks - 1, Math.floor(weekFraction)));
}

/**
 * Compute absolute item positions. Items snap to the week column of their target
 * date; when several items in a lane share a column they split the week into
 * side-by-side slots so nothing overlaps and arrows still flow left→right.
 */
export function computeLayout(
  board: ResolvedBoard,
  hiddenLaneIds: Set<string>,
  weekWidth: number
): BoardLayout {
  const visibleLanes = board.lanes.filter((l) => !hiddenLaneIds.has(l.id));
  const placements: ItemPlacement[] = [];
  const byId = new Map<string, ItemPlacement>();

  visibleLanes.forEach((lane, laneIndex) => {
    const dated = lane.items.filter((m) => m.weekFraction != null);

    const columnGroups = new Map<number, ResolvedItem[]>();
    for (const m of dated) {
      const col = clampColumn(m.weekFraction as number, board.horizonWeeks);
      const arr = columnGroups.get(col) ?? [];
      arr.push(m);
      columnGroups.set(col, arr);
    }

    const laneCenterY = laneIndex * LANE_HEIGHT + LANE_HEIGHT / 2;

    for (const [col, group] of columnGroups) {
      const slotWidth = weekWidth / group.length;
      group.forEach((m, j) => {
        const cx = col * weekWidth + j * slotWidth + slotWidth / 2;
        const width = Math.max(56, slotWidth - SLOT_GAP);
        const placement: ItemPlacement = {
          item: m,
          laneId: lane.id,
          laneIndex,
          column: col,
          cx,
          cy: laneCenterY,
          left: cx - width / 2,
          top: laneCenterY - CARD_HEIGHT / 2,
          width,
        };
        placements.push(placement);
        byId.set(m.id, placement);
      });
    }
  });

  return {
    weekWidth,
    trackWidth: board.horizonWeeks * weekWidth,
    lanesHeight: visibleLanes.length * LANE_HEIGHT,
    visibleLanes,
    placements,
    byId,
  };
}
