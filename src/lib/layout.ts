import type { ResolvedBoard, ResolvedLane, ResolvedMilestone } from "./viewModel";

/** Fixed geometry. WEEK_WIDTH is variable (zoom) and passed in. */
export const LABEL_WIDTH = 232;
export const RULER_HEIGHT = 60;
export const LANE_HEIGHT = 146;
export const CARD_HEIGHT = 92;
export const SLOT_GAP = 10; // horizontal gap between cards sharing a week
export const MIN_WEEK_WIDTH = 84;
export const MAX_WEEK_WIDTH = 220;
export const DEFAULT_WEEK_WIDTH = 132;

export interface MilestonePlacement {
  milestone: ResolvedMilestone;
  laneId: string;
  laneIndex: number;
  column: number;
  /** Center X within the timeline track (excludes the label column). */
  cx: number;
  /** Center Y within the timeline track (excludes the ruler). */
  cy: number;
  left: number;
  top: number;
  width: number;
}

export interface BoardLayout {
  weekWidth: number;
  trackWidth: number;
  lanesHeight: number;
  visibleLanes: ResolvedLane[];
  placements: MilestonePlacement[];
  byId: Map<string, MilestonePlacement>;
}

/**
 * Compute absolute card positions. Cards snap to the week column of their date;
 * when several cards in a lane share a column they split the week into side-by-
 * side slots so nothing overlaps and sequence arrows still flow left→right.
 */
export function computeLayout(
  board: ResolvedBoard,
  hiddenLaneIds: Set<string>,
  weekWidth: number
): BoardLayout {
  const visibleLanes = board.lanes.filter((l) => !hiddenLaneIds.has(l.id));
  const placements: MilestonePlacement[] = [];
  const byId = new Map<string, MilestonePlacement>();

  visibleLanes.forEach((lane, laneIndex) => {
    // Only milestones with a position participate in the grid.
    const dated = lane.milestones.filter((m) => m.weekFraction != null);

    // Group by integer column to allocate slots.
    const columnGroups = new Map<number, ResolvedMilestone[]>();
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
        const placement: MilestonePlacement = {
          milestone: m,
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

export function clampColumn(weekFraction: number, horizonWeeks: number): number {
  return Math.max(0, Math.min(horizonWeeks - 1, Math.floor(weekFraction)));
}
