"use client";

import { useState } from "react";
import type { Tile } from "@/lib/viewModel";

/**
 * One issue tile. Always shows the date. Closed issues are de-emphasised;
 * overdue open issues are flagged. The ⋯ menu toggles local-only hide/pin.
 */
export default function IssueTile({
  tile,
  color,
  onSetState,
}: {
  tile: Tile;
  color: string;
  onSetState: (key: string, patch: { hidden?: boolean; pinned?: boolean }) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const closed = tile.state === "closed";

  return (
    <div
      className={`group relative rounded-md border bg-white px-2.5 py-1.5 text-xs shadow-sm transition ${
        tile.hidden ? "opacity-50" : ""
      } ${tile.overdue ? "border-rose-300" : "border-slate-200"}`}
      style={{ borderLeft: `3px solid ${color}` }}
    >
      <div className="flex items-start justify-between gap-1">
        <a
          href={tile.url}
          target="_blank"
          rel="noreferrer"
          className={`font-medium leading-snug hover:underline ${
            closed ? "text-slate-400 line-through" : "text-slate-800"
          }`}
          title={tile.title}
        >
          {tile.pinned && <span className="mr-1 text-amber-500">★</span>}
          {tile.title}
        </a>
        <button
          onClick={() => setMenuOpen((o) => !o)}
          className="shrink-0 rounded px-1 text-slate-300 hover:bg-slate-100 hover:text-slate-600"
          title="Actions"
          aria-label="Issue actions"
        >
          ⋯
        </button>
      </div>

      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-slate-400">
        <span className="font-mono">#{tile.number}</span>
        <span
          className={`font-medium tabular-nums ${
            tile.overdue ? "text-rose-500" : closed ? "text-slate-400" : "text-slate-500"
          }`}
        >
          {tile.overdue && "⚠ "}
          {tile.dateLabel}
        </span>
        {tile.milestoneTitle && (
          <span className="truncate rounded bg-slate-100 px-1 text-slate-500" title={tile.milestoneTitle}>
            {tile.milestoneTitle}
          </span>
        )}
      </div>

      {menuOpen && (
        <div className="absolute right-1 top-6 z-10 w-28 rounded-md border border-slate-200 bg-white py-1 text-xs shadow-lg">
          <button
            className="block w-full px-3 py-1 text-left hover:bg-slate-50"
            onClick={() => {
              onSetState(tile.key, { pinned: !tile.pinned });
              setMenuOpen(false);
            }}
          >
            {tile.pinned ? "Unpin" : "Pin"}
          </button>
          <button
            className="block w-full px-3 py-1 text-left hover:bg-slate-50"
            onClick={() => {
              onSetState(tile.key, { hidden: !tile.hidden });
              setMenuOpen(false);
            }}
          >
            {tile.hidden ? "Unhide" : "Hide"}
          </button>
        </div>
      )}
    </div>
  );
}
