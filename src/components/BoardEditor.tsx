"use client";

import { useState } from "react";
import type { Board } from "@/lib/types";

export default function BoardEditor({
  board,
  onSave,
  onClose,
}: {
  board: Board;
  onSave: (next: Board) => Promise<string | null>; // returns error message or null
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<Board>(() => structuredClone(board));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function patchLane(id: string, patch: Partial<Board["lanes"][number]>) {
    setDraft((d) => ({ ...d, lanes: d.lanes.map((l) => (l.id === id ? { ...l, ...patch } : l)) }));
  }
  function addLane() {
    const id = `lane-${Date.now()}`;
    setDraft((d) => ({ ...d, lanes: [...d.lanes, { id, title: "New project", color: "#64748b" }] }));
  }
  function removeLane(id: string) {
    setDraft((d) => ({
      ...d,
      lanes: d.lanes.filter((l) => l.id !== id),
      // Drop items in that lane and any dependencies referencing them.
      items: d.items.filter((it) => it.laneId !== id),
    }));
  }
  function addSource() {
    setDraft((d) => ({ ...d, sources: [...d.sources, { provider: "github", project: "" }] }));
  }
  function patchSource(i: number, patch: Partial<Board["sources"][number]>) {
    setDraft((d) => ({ ...d, sources: d.sources.map((s, idx) => (idx === i ? { ...s, ...patch } : s)) }));
  }
  function removeSource(i: number) {
    setDraft((d) => ({ ...d, sources: d.sources.filter((_, idx) => idx !== i) }));
  }

  async function save() {
    setSaving(true);
    setError(null);
    const err = await onSave(draft);
    setSaving(false);
    if (err) setError(err);
    else onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 sm:p-8" onClick={onClose}>
      <div className="w-full max-w-2xl rounded-lg border border-slate-200 bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <h2 className="text-sm font-bold text-slate-800">Edit board</h2>
          <button onClick={onClose} className="rounded px-2 py-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700">✕</button>
        </div>

        <div className="max-h-[70vh] space-y-6 overflow-y-auto p-4 text-sm">
          <section className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-[10px] uppercase tracking-wide text-slate-400">Board name</span>
              <input value={draft.board.name} onChange={(e) => setDraft((d) => ({ ...d, board: { ...d.board, name: e.target.value } }))} className="rounded border border-slate-200 px-2 py-1" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[10px] uppercase tracking-wide text-slate-400">Start week (a Monday)</span>
              <input type="date" value={draft.board.startWeek} onChange={(e) => setDraft((d) => ({ ...d, board: { ...d.board, startWeek: e.target.value } }))} className="rounded border border-slate-200 px-2 py-1" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[10px] uppercase tracking-wide text-slate-400">Horizon (weeks)</span>
              <input type="number" min={1} value={draft.board.horizonWeeks} onChange={(e) => setDraft((d) => ({ ...d, board: { ...d.board, horizonWeeks: Math.max(1, Number(e.target.value) || 1) } }))} className="w-24 rounded border border-slate-200 px-2 py-1" />
            </label>
          </section>

          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Swimlanes (projects)</h3>
            <div className="space-y-2">
              {draft.lanes.map((l) => (
                <div key={l.id} className="flex items-center gap-2">
                  <input type="color" value={l.color} onChange={(e) => patchLane(l.id, { color: e.target.value })} className="h-8 w-8 cursor-pointer rounded border border-slate-200" />
                  <input value={l.title} onChange={(e) => patchLane(l.id, { title: e.target.value })} className="flex-1 rounded border border-slate-200 px-2 py-1" />
                  <button onClick={() => removeLane(l.id)} className="rounded px-2 py-1 text-xs text-rose-400 hover:bg-rose-50">Delete</button>
                </div>
              ))}
            </div>
            <button onClick={addLane} className="mt-2 rounded border border-dashed border-slate-300 px-2 py-1 text-xs text-slate-500 hover:bg-slate-50">+ Add swimlane</button>
          </section>

          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Sources</h3>
            <div className="space-y-2">
              {draft.sources.map((s, i) => (
                <div key={i} className="flex items-center gap-2">
                  <select value={s.provider} onChange={(e) => patchSource(i, { provider: e.target.value as "gitlab" | "github" })} className="rounded border border-slate-200 px-1.5 py-1 text-xs">
                    <option value="github">github</option>
                    <option value="gitlab">gitlab</option>
                  </select>
                  <input value={s.project} onChange={(e) => patchSource(i, { project: e.target.value })} placeholder="owner/repo or group/project" className="flex-1 rounded border border-slate-200 px-2 py-1 text-xs" />
                  <button onClick={() => removeSource(i)} className="rounded px-2 py-1 text-xs text-rose-400 hover:bg-rose-50">Delete</button>
                </div>
              ))}
            </div>
            <button onClick={addSource} className="mt-2 rounded border border-dashed border-slate-300 px-2 py-1 text-xs text-slate-500 hover:bg-slate-50">+ Add source</button>
            <p className="mt-1 text-[10px] text-slate-400">After adding a source, Sync now to pull its issues.</p>
          </section>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-slate-200 px-4 py-3">
          {error ? <span className="truncate text-xs text-rose-500">{error}</span> : <span />}
          <div className="flex gap-2">
            <button onClick={onClose} className="rounded-md border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
            <button onClick={save} disabled={saving} className="rounded-md bg-slate-800 px-3 py-1.5 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50">
              {saving ? "Saving…" : "Save changes"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
