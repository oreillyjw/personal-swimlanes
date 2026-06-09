"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ResolvedBoard, ResolvedLane, ResolvedMilestone } from "@/lib/viewModel";
import { DEFAULT_WEEK_WIDTH, MAX_WEEK_WIDTH, MIN_WEEK_WIDTH } from "@/lib/layout";
import Timeline from "./Timeline";
import MilestoneDetail from "./MilestoneDetail";

interface SyncResponse {
  ok: boolean;
  simulated: boolean;
  syncedCount: number;
  errors: { ref: string; message: string }[];
  lastSyncAt: string;
}

export default function BoardClient({ board, simulated }: { board: ResolvedBoard; simulated: boolean }) {
  const router = useRouter();
  const [weekWidth, setWeekWidth] = useState(DEFAULT_WEEK_WIDTH);
  const [hiddenLaneIds, setHiddenLaneIds] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<{ m: ResolvedMilestone; lane: ResolvedLane } | null>(null);
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
        setSyncMsg(`Synced ${data.syncedCount} milestone(s) (${mode})${errPart}.`);
        startTransition(() => router.refresh());
      }
    } catch (err) {
      setSyncMsg(`Sync failed: ${(err as Error).message}`);
    } finally {
      setSyncing(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-[1600px] flex-col gap-4 p-4 sm:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-slate-800">
            {board.name}
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                simulated ? "bg-indigo-100 text-indigo-700" : "bg-emerald-100 text-emerald-700"
              }`}
              title={
                simulated
                  ? "Simulation mode — reading committed fixtures, no network"
                  : "Live mode — reading real GitLab/GitHub APIs"
              }
            >
              {simulated ? "Simulated" : "Live"}
            </span>
          </h1>
          <p className="mt-0.5 text-xs text-slate-500">
            {board.lanes.length} lanes · {board.horizonWeeks} weeks from {board.startWeek}
            {board.lastSyncAt && <> · last sync {new Date(board.lastSyncAt).toLocaleString()}</>}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {syncMsg && <span className="max-w-xs truncate text-xs text-slate-500">{syncMsg}</span>}
          <div className="flex items-center gap-1 rounded-md border border-slate-200 bg-white px-1">
            <button
              onClick={() => setWeekWidth((w) => Math.max(MIN_WEEK_WIDTH, w - 16))}
              className="px-2 py-1 text-sm font-bold text-slate-500 hover:text-slate-800"
              title="Zoom out"
            >
              −
            </button>
            <span className="w-7 text-center text-[10px] text-slate-400">{Math.round((weekWidth / DEFAULT_WEEK_WIDTH) * 100)}%</span>
            <button
              onClick={() => setWeekWidth((w) => Math.min(MAX_WEEK_WIDTH, w + 16))}
              className="px-2 py-1 text-sm font-bold text-slate-500 hover:text-slate-800"
              title="Zoom in"
            >
              +
            </button>
          </div>
          <button
            onClick={syncNow}
            disabled={syncing}
            className="rounded-md bg-slate-800 px-3 py-1.5 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
          >
            {syncing ? "Syncing…" : "Sync now"}
          </button>
        </div>
      </header>

      {/* Lane legend / toggles */}
      <div className="flex flex-wrap items-center gap-2">
        {board.lanes.map((lane) => {
          const hidden = hiddenLaneIds.has(lane.id);
          return (
            <button
              key={lane.id}
              onClick={() => toggleLane(lane.id)}
              className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition ${
                hidden ? "border-slate-200 bg-white text-slate-400" : "border-slate-300 bg-white text-slate-700"
              }`}
              title={hidden ? "Show lane" : "Hide lane"}
            >
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: lane.color, opacity: hidden ? 0.3 : 1 }}
              />
              <span className={hidden ? "line-through" : ""}>{lane.title}</span>
            </button>
          );
        })}
      </div>

      {hiddenLaneIds.size === board.lanes.length ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-400">
          All lanes hidden — re-enable one above.
        </div>
      ) : (
        <Timeline
          board={board}
          weekWidth={weekWidth}
          hiddenLaneIds={hiddenLaneIds}
          onSelect={(m, lane) => setSelected({ m, lane })}
        />
      )}

      <footer className="flex items-center gap-4 text-[11px] text-slate-400">
        <span className="flex items-center gap-1">
          <span className="inline-block h-0.5 w-5 bg-slate-400" /> sequence
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-0.5 w-5 border-t-2 border-dashed border-rose-500" /> cross-lane dependency
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-0.5 bg-rose-500" /> today
        </span>
        <span>◆ launch milestone</span>
      </footer>

      {selected && (
        <MilestoneDetail milestone={selected.m} lane={selected.lane} onClose={() => setSelected(null)} />
      )}
    </main>
  );
}
