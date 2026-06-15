"use client";

import type { ItemPlacement } from "@/lib/layout";
import { CARD_HEIGHT } from "@/lib/layout";
import { readableText, tint } from "@/lib/color";

function statusClasses(status: string): string {
  const s = status.toLowerCase();
  if (s.includes("progress")) return "bg-amber-100 text-amber-800";
  if (s === "done" || s === "closed") return "bg-emerald-100 text-emerald-800";
  if (s === "planned") return "bg-slate-100 text-slate-500";
  return "bg-slate-100 text-slate-600";
}

export default function ItemCard({
  placement,
  color,
  onClick,
}: {
  placement: ItemPlacement;
  color: string;
  onClick: () => void;
}) {
  const m = placement.item;
  const compact = placement.width < 112;
  const progress = m.progress;
  const pct = progress && progress.total > 0 ? Math.round((progress.closed / progress.total) * 100) : 0;
  const overdueRing = m.overdue ? "ring-2 ring-rose-400" : "";

  // Launch marker — bold, lane-colored.
  if (m.isLaunch) {
    const text = readableText(color);
    return (
      <button
        onClick={onClick}
        title={`${m.title} — ${m.dateLabel}`}
        className={`absolute flex flex-col justify-center rounded-md px-2 text-left shadow-md ring-1 ring-black/10 transition hover:-translate-y-0.5 hover:shadow-lg ${overdueRing}`}
        style={{ left: placement.left, top: placement.top, width: placement.width, height: CARD_HEIGHT, backgroundColor: color, color: text }}
      >
        <div className="flex items-center gap-1">
          <span aria-hidden className="text-[11px]">◆</span>
          <span className="truncate text-[12px] font-bold uppercase leading-tight tracking-wide">{m.title}</span>
        </div>
        <div className="mt-0.5 text-[11px] font-semibold opacity-90">{m.dateLabel}</div>
        {progress && <div className="mt-1 text-[10px] font-medium opacity-90">{progress.closed}/{progress.total} issues</div>}
      </button>
    );
  }

  const icon = m.kind === "milestone" ? "◇" : "•";

  return (
    <button
      onClick={onClick}
      title={`${m.title} — ${m.dateLabel} — ${m.status}`}
      className={`absolute flex flex-col overflow-hidden rounded-md border border-slate-200 bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md ${overdueRing}`}
      style={{ left: placement.left, top: placement.top, width: placement.width, height: CARD_HEIGHT, borderLeft: `4px solid ${color}` }}
    >
      <div className="flex-1 overflow-hidden px-2 pt-1.5">
        <div
          className="overflow-hidden text-[12px] font-semibold leading-tight text-slate-800"
          style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}
        >
          <span className="mr-1 text-slate-400">{icon}</span>
          {m.title}
        </div>
        {!compact && (
          <div className="mt-1 flex items-center gap-1">
            <span className={`text-[10px] font-medium ${m.overdue ? "text-rose-500" : "text-slate-500"}`}>
              {m.overdue && "⚠ "}
              {m.dateLabel}
            </span>
            <span className={`rounded px-1 py-px text-[9px] font-semibold ${statusClasses(m.status)}`}>{m.status}</span>
          </div>
        )}
      </div>
      <div className="px-2 pb-1.5">
        {m.kind === "milestone" && progress ? (
          <>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
            </div>
            <div className="mt-0.5 flex justify-between text-[9px] font-medium text-slate-500">
              <span>{progress.closed}/{progress.total}</span>
              {!compact && <span>{pct}%</span>}
            </div>
          </>
        ) : (
          <div className="h-1.5 w-full rounded-full" style={{ backgroundColor: tint(color, 0.12) }} />
        )}
      </div>
    </button>
  );
}
