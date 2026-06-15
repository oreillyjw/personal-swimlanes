"use client";

import { useMemo } from "react";
import type { ResolvedBoard, ResolvedLane, ResolvedItem } from "@/lib/viewModel";
import { computeLayout, CARD_HEIGHT, LABEL_WIDTH, LANE_HEIGHT, RULER_HEIGHT, type ItemPlacement } from "@/lib/layout";
import { readableText, tint } from "@/lib/color";
import ItemCard from "./ItemCard";

interface DepArrow {
  path: string;
  slip: boolean;
  fromTitle: string;
  toTitle: string;
}

export default function Timeline({
  board,
  weekWidth,
  hiddenLaneIds,
  onSelect,
}: {
  board: ResolvedBoard;
  weekWidth: number;
  hiddenLaneIds: Set<string>;
  onSelect: (item: ResolvedItem, lane: ResolvedLane) => void;
}) {
  const layout = useMemo(() => computeLayout(board, hiddenLaneIds, weekWidth), [board, hiddenLaneIds, weekWidth]);
  const { trackWidth, lanesHeight, visibleLanes, byId } = layout;

  // Dependency arrows (cross-lane and within-lane). Slip = ordering violated.
  const depArrows = useMemo<DepArrow[]>(() => {
    const arrows: DepArrow[] = [];
    for (const dep of board.dependencies) {
      const from = byId.get(dep.from);
      const to = byId.get(dep.to);
      if (!from || !to) continue;
      let path: string;
      if (from.laneIndex === to.laneIndex) {
        // same lane: shallow arc above the row
        const lift = CARD_HEIGHT / 2 + 18;
        const y = from.cy - CARD_HEIGHT / 2;
        const midX = (from.cx + to.cx) / 2;
        path = `M ${from.cx} ${y} C ${midX} ${y - lift}, ${midX} ${y - lift}, ${to.cx} ${to.cy - CARD_HEIGHT / 2}`;
      } else {
        const down = to.cy > from.cy;
        const startY = from.cy + (down ? CARD_HEIGHT / 2 : -CARD_HEIGHT / 2);
        const endY = to.cy + (down ? -CARD_HEIGHT / 2 : CARD_HEIGHT / 2);
        const midY = (startY + endY) / 2;
        path = `M ${from.cx} ${startY} C ${from.cx} ${midY}, ${to.cx} ${midY}, ${to.cx} ${endY}`;
      }
      arrows.push({ path, slip: dep.slip, fromTitle: from.item.title, toTitle: to.item.title });
    }
    return arrows;
  }, [board.dependencies, byId]);

  const showToday = board.todayFraction >= 0 && board.todayFraction <= board.horizonWeeks;
  const todayX = board.todayFraction * weekWidth;

  return (
    <div className="timeline-scroll overflow-auto rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="relative" style={{ width: LABEL_WIDTH + trackWidth }}>
        {/* ===== Ruler ===== */}
        <div className="sticky top-0 z-30 flex" style={{ height: RULER_HEIGHT }}>
          <div
            className="sticky left-0 z-10 flex items-center border-b border-r border-slate-200 bg-slate-50 px-4 text-xs font-semibold uppercase tracking-wide text-slate-500"
            style={{ width: LABEL_WIDTH }}
          >
            Projects
          </div>
          <div className="relative bg-slate-50" style={{ width: trackWidth, height: RULER_HEIGHT }}>
            {board.weeks.map((w) => (
              <div
                key={w.index}
                className="absolute top-0 flex h-full flex-col justify-center border-b border-l border-slate-200 px-1.5"
                style={{ left: w.index * weekWidth, width: weekWidth }}
              >
                <div className="text-[11px] font-bold text-slate-700">{w.label}</div>
                <div className="text-[10px] text-slate-400">{w.dateLabel}</div>
              </div>
            ))}
            {showToday && (
              <div className="absolute top-1 z-20 -translate-x-1/2 rounded bg-rose-500 px-1.5 py-0.5 text-[9px] font-bold text-white shadow" style={{ left: todayX }}>
                TODAY
              </div>
            )}
          </div>
        </div>

        {/* ===== Body ===== */}
        <div className="flex">
          <div className="sticky left-0 z-20" style={{ width: LABEL_WIDTH }}>
            {visibleLanes.map((lane) => {
              const text = readableText(lane.color);
              return (
                <div
                  key={lane.id}
                  className="flex flex-col justify-center border-b border-r border-slate-200 px-4"
                  style={{ height: LANE_HEIGHT, backgroundColor: lane.color, color: text }}
                >
                  <div className="text-[13px] font-bold uppercase leading-tight tracking-wide">{lane.title}</div>
                  <div className="mt-1 text-[10px] uppercase tracking-wide opacity-75">{lane.items.length} items</div>
                </div>
              );
            })}
          </div>

          <div className="relative" style={{ width: trackWidth, height: lanesHeight }}>
            {visibleLanes.map((lane, i) => (
              <div
                key={lane.id}
                className="absolute left-0 border-b border-slate-100"
                style={{ top: i * LANE_HEIGHT, height: LANE_HEIGHT, width: trackWidth, backgroundColor: tint(lane.color, 0.035) }}
              />
            ))}

            <svg className="pointer-events-none absolute inset-0" width={trackWidth} height={lanesHeight}>
              {board.weeks.map((w) => (
                <line key={w.index} x1={w.index * weekWidth} y1={0} x2={w.index * weekWidth} y2={lanesHeight} stroke="#cbd5e1" strokeWidth={1} strokeDasharray="2 4" />
              ))}
              {showToday && <line x1={todayX} y1={0} x2={todayX} y2={lanesHeight} stroke="#f43f5e" strokeWidth={2} />}
            </svg>

            <svg className="pointer-events-none absolute inset-0 z-10" width={trackWidth} height={lanesHeight}>
              <defs>
                <marker id="arrow-dep" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="#6366f1" />
                </marker>
                <marker id="arrow-slip" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="#f43f5e" />
                </marker>
              </defs>
              {depArrows.map((a, i) => (
                <path
                  key={i}
                  d={a.path}
                  fill="none"
                  stroke={a.slip ? "#f43f5e" : "#6366f1"}
                  strokeWidth={1.75}
                  strokeDasharray={a.slip ? "5 4" : undefined}
                  markerEnd={a.slip ? "url(#arrow-slip)" : "url(#arrow-dep)"}
                >
                  <title>{a.fromTitle} → {a.toTitle}{a.slip ? " (slip: prerequisite finishes after dependent)" : ""}</title>
                </path>
              ))}
            </svg>

            <div className="absolute inset-0 z-20">
              {layout.placements.map((p) => (
                <ItemCard key={p.item.id} placement={p} color={visibleLanes[p.laneIndex].color} onClick={() => onSelect(p.item, visibleLanes[p.laneIndex])} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
