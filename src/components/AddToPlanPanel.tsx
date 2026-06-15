"use client";

import { useMemo, useState } from "react";
import type { Item, Lane } from "@/lib/types";
import type { AvailableRef } from "@/lib/viewModel";
import { toISODate } from "@/lib/weeks";

export default function AddToPlanPanel({
  available,
  lanes,
  defaultLaneId,
  onAdd,
  onClose,
}: {
  available: { milestones: AvailableRef[]; issues: AvailableRef[] };
  lanes: Lane[];
  defaultLaneId: string;
  onAdd: (item: Item) => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<"milestone" | "issue">("milestone");
  const [filter, setFilter] = useState("");
  const [laneId, setLaneId] = useState(defaultLaneId);
  const today = toISODate(new Date());

  const list = tab === "milestone" ? available.milestones : available.issues;
  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return q ? list.filter((r) => r.title.toLowerCase().includes(q) || r.project.toLowerCase().includes(q)) : list;
  }, [list, filter]);

  function add(ref: AvailableRef) {
    onAdd({
      id: `item-${ref.type}-${ref.provider}-${ref.project}-${ref.id}`.replace(/[^a-zA-Z0-9_-]/g, "_"),
      laneId,
      kind: ref.type,
      title: ref.title,
      targetDate: ref.dueDate ?? today,
      isLaunch: false,
      detail: "",
      tags: [],
      sourceRef: { provider: ref.provider, project: ref.project, type: ref.type, id: ref.id },
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 sm:p-8" onClick={onClose}>
      <div className="w-full max-w-2xl rounded-lg border border-slate-200 bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <h2 className="text-sm font-bold text-slate-800">Add to plan</h2>
          <button onClick={onClose} className="rounded px-2 py-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700">✕</button>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-2">
          <div className="flex rounded-md border border-slate-200 text-xs">
            <button onClick={() => setTab("milestone")} className={`px-3 py-1 ${tab === "milestone" ? "bg-slate-800 text-white" : "text-slate-600"}`}>
              Milestones ({available.milestones.length})
            </button>
            <button onClick={() => setTab("issue")} className={`px-3 py-1 ${tab === "issue" ? "bg-slate-800 text-white" : "text-slate-600"}`}>
              Issues ({available.issues.length})
            </button>
          </div>
          <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter…" className="flex-1 rounded border border-slate-200 px-2 py-1 text-xs" />
          <label className="flex items-center gap-1 text-xs text-slate-500">
            into
            <select value={laneId} onChange={(e) => setLaneId(e.target.value)} className="rounded border border-slate-200 px-1.5 py-1 text-xs">
              {lanes.map((l) => (
                <option key={l.id} value={l.id}>{l.title}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-2">
          {lanes.length === 0 ? (
            <p className="p-6 text-center text-sm text-slate-400">Add a swimlane first (Edit board).</p>
          ) : filtered.length === 0 ? (
            <p className="p-6 text-center text-sm text-slate-400">Nothing here — run Sync now, or everything is already placed.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {filtered.map((ref) => (
                <li key={ref.key} className="flex items-center gap-2 px-2 py-1.5 text-sm">
                  <span className="flex-1 truncate" title={`${ref.project} · ${ref.title}`}>
                    <span className="text-slate-400">{ref.project}</span> · {ref.title}
                  </span>
                  {ref.dueDate && <span className="text-[10px] text-slate-400">{ref.dueDate}</span>}
                  <button onClick={() => add(ref)} className="rounded bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-200">
                    + Add
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
