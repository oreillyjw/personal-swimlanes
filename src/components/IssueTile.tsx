"use client";

import { useState } from "react";
import type { Tile } from "@/lib/viewModel";

export interface LaneOption {
  id: string;
  title: string;
}

type Patch = { hidden?: boolean; pinned?: boolean; laneId?: string | null; title?: string | null; note?: string | null };

/**
 * One issue tile. Always shows the date. Closed issues are de-emphasised;
 * overdue open issues are flagged. The ⋯ menu drives local-only edits:
 * pin/hide, move to another lane, and override title / note.
 */
export default function IssueTile({
  tile,
  color,
  laneOptions,
  onSetState,
}: {
  tile: Tile;
  color: string;
  laneOptions: LaneOption[];
  onSetState: (key: string, patch: Patch) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [titleDraft, setTitleDraft] = useState(tile.title);
  const [noteDraft, setNoteDraft] = useState(tile.note ?? "");
  const closed = tile.state === "closed";

  function saveEdit() {
    const t = titleDraft.trim();
    const n = noteDraft.trim();
    onSetState(tile.key, {
      title: t && t !== tile.liveTitle ? t : null,
      note: n ? n : null,
    });
    setEditing(false);
    setMenuOpen(false);
  }

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
          title={tile.titleOverridden ? `VCS title: ${tile.liveTitle}` : tile.title}
        >
          {tile.pinned && <span className="mr-1 text-amber-500">★</span>}
          {tile.title}
          {tile.titleOverridden && <span className="ml-1 text-[10px] text-indigo-400" title="Local title override">✎</span>}
        </a>
        <button
          onClick={() => {
            setMenuOpen((o) => !o);
            setEditing(false);
          }}
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
        {tile.laneOverridden && (
          <span className="rounded bg-indigo-50 px-1 text-indigo-500" title="Moved to this lane locally">
            moved
          </span>
        )}
      </div>

      {tile.note && (
        <div className="mt-1 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] leading-snug text-amber-700">
          {tile.note}
        </div>
      )}

      {menuOpen && !editing && (
        <div className="absolute right-1 top-6 z-10 w-44 rounded-md border border-slate-200 bg-white py-1 text-xs shadow-lg">
          <MenuItem onClick={() => act(() => onSetState(tile.key, { pinned: !tile.pinned }))}>
            {tile.pinned ? "Unpin" : "Pin to top"}
          </MenuItem>
          <MenuItem onClick={() => act(() => onSetState(tile.key, { hidden: !tile.hidden }))}>
            {tile.hidden ? "Unhide" : "Hide"}
          </MenuItem>
          <MenuItem
            onClick={() => {
              setTitleDraft(tile.title);
              setNoteDraft(tile.note ?? "");
              setEditing(true);
            }}
          >
            Edit title &amp; note…
          </MenuItem>
          <div className="my-1 border-t border-slate-100" />
          <div className="px-3 py-0.5 text-[10px] uppercase tracking-wide text-slate-400">Move to</div>
          {laneOptions.map((l) => (
            <MenuItem key={l.id} onClick={() => act(() => onSetState(tile.key, { laneId: l.id }))}>
              {l.title}
            </MenuItem>
          ))}
          {tile.laneOverridden && (
            <MenuItem onClick={() => act(() => onSetState(tile.key, { laneId: null }))}>
              ↺ Reset to milestone lane
            </MenuItem>
          )}
        </div>
      )}

      {menuOpen && editing && (
        <div className="absolute right-1 top-6 z-10 w-56 rounded-md border border-slate-200 bg-white p-2 text-xs shadow-lg">
          <label className="mb-1 block text-[10px] uppercase tracking-wide text-slate-400">Title</label>
          <input
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value)}
            placeholder={tile.liveTitle}
            className="mb-2 w-full rounded border border-slate-200 px-1.5 py-1 text-xs"
          />
          <label className="mb-1 block text-[10px] uppercase tracking-wide text-slate-400">Note</label>
          <textarea
            value={noteDraft}
            onChange={(e) => setNoteDraft(e.target.value)}
            rows={2}
            className="mb-2 w-full resize-none rounded border border-slate-200 px-1.5 py-1 text-xs"
          />
          <div className="flex justify-end gap-1.5">
            <button
              onClick={() => {
                setEditing(false);
                setMenuOpen(false);
              }}
              className="rounded px-2 py-1 text-slate-500 hover:bg-slate-100"
            >
              Cancel
            </button>
            <button onClick={saveEdit} className="rounded bg-slate-800 px-2 py-1 font-semibold text-white hover:bg-slate-700">
              Save
            </button>
          </div>
        </div>
      )}
    </div>
  );

  function act(fn: () => void) {
    fn();
    setMenuOpen(false);
  }
}

function MenuItem({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button className="block w-full px-3 py-1 text-left hover:bg-slate-50" onClick={onClick}>
      {children}
    </button>
  );
}
