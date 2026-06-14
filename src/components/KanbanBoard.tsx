"use client";

import type { ResolvedBoard, ResolvedSwimlane, Tile } from "@/lib/viewModel";
import IssueTile, { type LaneOption } from "./IssueTile";

type Patch = { hidden?: boolean; pinned?: boolean; laneId?: string | null; title?: string | null; note?: string | null };

const COLUMNS: { key: "past" | "current" | "future"; label: string }[] = [
  { key: "past", label: "◀ Past" },
  { key: "current", label: "Current" },
  { key: "future", label: "Future ▶" },
];

function Column({
  tiles,
  color,
  laneOptions,
  onSetState,
}: {
  tiles: Tile[];
  color: string;
  laneOptions: LaneOption[];
  onSetState: (key: string, patch: Patch) => void;
}) {
  return (
    <div className="flex min-h-[64px] flex-col gap-1.5 border-l border-slate-100 bg-slate-50/40 p-2">
      {tiles.length === 0 ? (
        <span className="select-none px-1 text-[10px] text-slate-300">—</span>
      ) : (
        tiles.map((t) => (
          <IssueTile key={t.key} tile={t} color={color} laneOptions={laneOptions} onSetState={onSetState} />
        ))
      )}
    </div>
  );
}

function SwimlaneRow({
  lane,
  showHidden,
  laneOptions,
  onSetState,
}: {
  lane: ResolvedSwimlane;
  showHidden: boolean;
  laneOptions: LaneOption[];
  onSetState: (key: string, patch: Patch) => void;
}) {
  const visible = (tiles: Tile[]) => (showHidden ? tiles : tiles.filter((t) => !t.hidden));
  const count = visible(lane.past).length + visible(lane.current).length + visible(lane.future).length;
  return (
    <div className="grid grid-cols-[180px_repeat(3,1fr)] border-t border-slate-200">
      <div
        className="flex flex-col justify-center gap-0.5 p-3"
        style={{ borderLeft: `4px solid ${lane.color}`, background: `${lane.color}0d` }}
      >
        <span className={`text-sm font-semibold ${lane.isCatchAll ? "text-slate-500" : "text-slate-800"}`}>
          {lane.isCatchAll ? "⊕ Catch-all" : lane.title}
        </span>
        <span className="text-[10px] text-slate-400">{count} issues</span>
      </div>
      {COLUMNS.map((c) => (
        <Column
          key={c.key}
          tiles={visible(lane[c.key])}
          color={lane.color}
          laneOptions={laneOptions}
          onSetState={onSetState}
        />
      ))}
    </div>
  );
}

export default function KanbanBoard({
  board,
  hiddenLaneIds,
  showHidden,
  laneOptions,
  onSetState,
}: {
  board: ResolvedBoard;
  hiddenLaneIds: Set<string>;
  showHidden: boolean;
  laneOptions: LaneOption[];
  onSetState: (key: string, patch: Patch) => void;
}) {
  const lanes = board.swimlanes.filter((l) => !hiddenLaneIds.has(l.id));

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <div className="min-w-[760px]">
        {/* Column headers */}
        <div className="sticky top-0 z-[1] grid grid-cols-[180px_repeat(3,1fr)] bg-white">
          <div className="p-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Project</div>
          {COLUMNS.map((c) => (
            <div
              key={c.key}
              className="border-l border-slate-100 p-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400"
            >
              {c.label}
            </div>
          ))}
        </div>

        {lanes.length === 0 ? (
          <div className="border-t border-slate-200 p-10 text-center text-sm text-slate-400">
            No swimlanes to show.
          </div>
        ) : (
          lanes.map((lane) => (
            <SwimlaneRow
              key={lane.id}
              lane={lane}
              showHidden={showHidden}
              laneOptions={laneOptions}
              onSetState={onSetState}
            />
          ))
        )}
      </div>
    </div>
  );
}
