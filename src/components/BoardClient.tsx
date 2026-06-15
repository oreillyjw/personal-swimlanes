"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ResolvedBoard } from "@/lib/viewModel";
import type { Board, Item } from "@/lib/types";
import { DEFAULT_WEEK_WIDTH, MAX_WEEK_WIDTH, MIN_WEEK_WIDTH } from "@/lib/layout";
import Timeline from "./Timeline";
import ItemDetail from "./ItemDetail";
import AddToPlanPanel from "./AddToPlanPanel";
import BoardEditor from "./BoardEditor";

interface SyncResponse {
  ok: boolean;
  simulated: boolean;
  sourceCount: number;
  issueCount: number;
  errors: { source: string; message: string }[];
  lastSyncAt: string;
}

export default function BoardClient({ board, rawBoard, simulated }: { board: ResolvedBoard; rawBoard: Board; simulated: boolean }) {
  const router = useRouter();
  const [weekWidth, setWeekWidth] = useState(DEFAULT_WEEK_WIDTH);
  const [hiddenLaneIds, setHiddenLaneIds] = useState<Set<string>>(new Set());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [showEditor, setShowEditor] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [, startTransition] = useTransition();

  function toggleLane(id: string) {
    setHiddenLaneIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  /** Persist a whole board; returns an error message or null. */
  async function saveBoard(next: Board): Promise<string | null> {
    try {
      const res = await fetch("/api/board", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(next) });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) return data.error ?? `Save failed (${res.status})`;
      startTransition(() => router.refresh());
      return null;
    } catch (err) {
      return (err as Error).message;
    }
  }

  async function mutate(next: Board) {
    const err = await saveBoard(next);
    if (err) setSyncMsg(`Save failed: ${err}`);
  }

  function updateItem(id: string, patch: Partial<Item>) {
    mutate({ ...rawBoard, items: rawBoard.items.map((it) => (it.id === id ? { ...it, ...patch } : it)) });
  }
  function deleteItem(id: string) {
    mutate({
      ...rawBoard,
      items: rawBoard.items.filter((it) => it.id !== id),
      dependencies: rawBoard.dependencies.filter((d) => d.from !== id && d.to !== id),
    });
    setSelectedId(null);
  }
  function addItem(item: Item) {
    mutate({ ...rawBoard, items: [...rawBoard.items, item] });
    setShowAdd(false);
  }
  function addDependency(from: string, to: string) {
    if (from === to || rawBoard.dependencies.some((d) => d.from === from && d.to === to)) return;
    mutate({ ...rawBoard, dependencies: [...rawBoard.dependencies, { from, to }] });
  }
  function removeDependency(from: string, to: string) {
    mutate({ ...rawBoard, dependencies: rawBoard.dependencies.filter((d) => !(d.from === from && d.to === to)) });
  }

  async function syncNow() {
    setSyncing(true);
    setSyncMsg(null);
    try {
      const res = await fetch("/api/sync", { method: "POST" });
      const data = (await res.json()) as SyncResponse & { error?: string };
      if (!res.ok && data.error) {
        setSyncMsg(`Sync failed: ${data.error}`);
      } else {
        const mode = data.simulated ? "simulated" : "live";
        const errPart = data.errors?.length ? `, ${data.errors.length} error(s)` : "";
        setSyncMsg(`Synced ${data.issueCount} issue(s) from ${data.sourceCount} source(s) (${mode})${errPart}.`);
        startTransition(() => router.refresh());
      }
    } catch (err) {
      setSyncMsg(`Sync failed: ${(err as Error).message}`);
    } finally {
      setSyncing(false);
    }
  }

  const allItemRefs = board.lanes.flatMap((l) => l.items.map((it) => ({ id: it.id, title: it.title, laneTitle: l.title })));
  const selected = selectedId ? board.lanes.flatMap((l) => l.items).find((it) => it.id === selectedId) ?? null : null;
  const selectedLane = selected ? board.lanes.find((l) => l.id === selected.laneId) ?? null : null;
  const selectedRaw = selectedId ? rawBoard.items.find((it) => it.id === selectedId) ?? null : null;
  const slipCount = board.dependencies.filter((d) => d.slip).length;
  const itemCount = board.lanes.reduce((n, l) => n + l.items.length, 0);

  return (
    <main className="mx-auto flex min-h-screen max-w-[1600px] flex-col gap-4 p-4 sm:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-slate-800">
            {board.name}
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${simulated ? "bg-indigo-100 text-indigo-700" : "bg-emerald-100 text-emerald-700"}`}
              title={simulated ? "Simulation mode — committed fixtures, no network" : "Live mode — real GitLab/GitHub APIs"}
            >
              {simulated ? "Simulated" : "Live"}
            </span>
          </h1>
          <p className="mt-0.5 text-xs text-slate-500">
            {board.lanes.length} projects · {itemCount} planned items
            {slipCount > 0 && <span className="text-rose-500"> · {slipCount} dependency slip(s)</span>}
            {board.lastSyncAt && <> · last sync {new Date(board.lastSyncAt).toLocaleString()}</>}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {syncMsg && <span className="max-w-xs truncate text-xs text-slate-500">{syncMsg}</span>}
          <div className="flex items-center gap-1 rounded-md border border-slate-200 bg-white px-1">
            <button onClick={() => setWeekWidth((w) => Math.max(MIN_WEEK_WIDTH, w - 16))} className="px-2 py-1 text-sm font-bold text-slate-500 hover:text-slate-800" title="Zoom out">−</button>
            <span className="w-7 text-center text-[10px] text-slate-400">{Math.round((weekWidth / DEFAULT_WEEK_WIDTH) * 100)}%</span>
            <button onClick={() => setWeekWidth((w) => Math.min(MAX_WEEK_WIDTH, w + 16))} className="px-2 py-1 text-sm font-bold text-slate-500 hover:text-slate-800" title="Zoom in">+</button>
          </div>
          <button onClick={() => setShowAdd(true)} className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">+ Add to plan</button>
          <button onClick={() => setShowEditor(true)} className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">Edit board</button>
          <button onClick={syncNow} disabled={syncing} className="rounded-md bg-slate-800 px-3 py-1.5 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50">
            {syncing ? "Syncing…" : "Sync now"}
          </button>
        </div>
      </header>

      {/* Lane legend / toggles */}
      {board.lanes.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {board.lanes.map((lane) => {
            const hidden = hiddenLaneIds.has(lane.id);
            return (
              <button
                key={lane.id}
                onClick={() => toggleLane(lane.id)}
                className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition ${hidden ? "border-slate-200 bg-white text-slate-400" : "border-slate-300 bg-white text-slate-700"}`}
                title={hidden ? "Show project" : "Hide project"}
              >
                <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: lane.color, opacity: hidden ? 0.3 : 1 }} />
                <span className={hidden ? "line-through" : ""}>{lane.title}</span>
              </button>
            );
          })}
        </div>
      )}

      {board.lanes.length === 0 ? (
        <Empty>No projects yet — click <b>Edit board</b> to add swimlanes and sources.</Empty>
      ) : itemCount === 0 ? (
        <Empty>No items planned — <b>Sync now</b>, then <b>Add to plan</b> to place milestones and issues on the timeline.</Empty>
      ) : hiddenLaneIds.size === board.lanes.length ? (
        <Empty>All projects hidden — re-enable one above.</Empty>
      ) : (
        <Timeline board={board} weekWidth={weekWidth} hiddenLaneIds={hiddenLaneIds} onSelect={(it) => setSelectedId(it.id)} />
      )}

      <footer className="flex flex-wrap items-center gap-4 text-[11px] text-slate-400">
        <span className="flex items-center gap-1"><span className="inline-block h-0.5 w-5 bg-indigo-500" /> dependency</span>
        <span className="flex items-center gap-1"><span className="inline-block h-0.5 w-5 border-t-2 border-dashed border-rose-500" /> dependency slip</span>
        <span className="flex items-center gap-1"><span className="inline-block h-3 w-0.5 bg-rose-500" /> today</span>
        <span>◆ launch · ◇ milestone · • issue · ⚠ overdue</span>
      </footer>

      {selected && selectedLane && selectedRaw && (
        <ItemDetail
          item={selected}
          rawItem={selectedRaw}
          lanes={rawBoard.lanes}
          allItems={allItemRefs}
          dependencies={board.dependencies.filter((d) => d.from === selected.id || d.to === selected.id)}
          onUpdate={updateItem}
          onDelete={deleteItem}
          onAddDependency={addDependency}
          onRemoveDependency={removeDependency}
          onClose={() => setSelectedId(null)}
        />
      )}

      {showAdd && (
        <AddToPlanPanel
          available={board.available}
          lanes={rawBoard.lanes}
          defaultLaneId={rawBoard.lanes[0]?.id ?? ""}
          onAdd={addItem}
          onClose={() => setShowAdd(false)}
        />
      )}

      {showEditor && <BoardEditor board={rawBoard} onSave={saveBoard} onClose={() => setShowEditor(false)} />}
    </main>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-400">{children}</div>;
}
