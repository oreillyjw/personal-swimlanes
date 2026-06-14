"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ResolvedBoard } from "@/lib/viewModel";
import KanbanBoard from "./KanbanBoard";

interface SyncResponse {
  ok: boolean;
  simulated: boolean;
  sourceCount: number;
  issueCount: number;
  errors: { source: string; message: string }[];
  lastSyncAt: string;
}

export default function BoardClient({ board, simulated }: { board: ResolvedBoard; simulated: boolean }) {
  const router = useRouter();
  const [hiddenLaneIds, setHiddenLaneIds] = useState<Set<string>>(new Set());
  const [showHidden, setShowHidden] = useState(false);
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

  async function setIssueState(key: string, patch: { hidden?: boolean; pinned?: boolean }) {
    try {
      await fetch("/api/issue-state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, ...patch }),
      });
      startTransition(() => router.refresh());
    } catch (err) {
      setSyncMsg(`Update failed: ${(err as Error).message}`);
    }
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

  const lanes = board.swimlanes;

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
            {lanes.length} swimlanes · {board.counts.shown + board.counts.hidden} issues
            {board.counts.hidden > 0 && <> · {board.counts.hidden} hidden</>}
            {board.lastSyncAt && <> · last sync {new Date(board.lastSyncAt).toLocaleString()}</>}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {syncMsg && <span className="max-w-xs truncate text-xs text-slate-500">{syncMsg}</span>}
          {board.counts.hidden > 0 && (
            <button
              onClick={() => setShowHidden((s) => !s)}
              className={`rounded-md border px-2.5 py-1.5 text-xs font-medium ${
                showHidden ? "border-slate-400 bg-slate-100 text-slate-700" : "border-slate-200 bg-white text-slate-500"
              }`}
              title="Toggle hidden issues"
            >
              {showHidden ? "Hiding off" : `Show hidden (${board.counts.hidden})`}
            </button>
          )}
          <button
            onClick={syncNow}
            disabled={syncing}
            className="rounded-md bg-slate-800 px-3 py-1.5 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
          >
            {syncing ? "Syncing…" : "Sync now"}
          </button>
        </div>
      </header>

      {/* Swimlane legend / toggles */}
      <div className="flex flex-wrap items-center gap-2">
        {lanes.map((lane) => {
          const hidden = hiddenLaneIds.has(lane.id);
          return (
            <button
              key={lane.id}
              onClick={() => toggleLane(lane.id)}
              className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition ${
                hidden ? "border-slate-200 bg-white text-slate-400" : "border-slate-300 bg-white text-slate-700"
              }`}
              title={hidden ? "Show swimlane" : "Hide swimlane"}
            >
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: lane.color, opacity: hidden ? 0.3 : 1 }}
              />
              <span className={hidden ? "line-through" : ""}>
                {lane.isCatchAll ? "Catch-all" : lane.title}
              </span>
            </button>
          );
        })}
      </div>

      {board.counts.total === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-400">
          No issues yet — click <span className="font-semibold">Sync now</span> to pull issues from your sources.
        </div>
      ) : (
        <KanbanBoard
          board={board}
          hiddenLaneIds={hiddenLaneIds}
          showHidden={showHidden}
          onSetState={setIssueState}
        />
      )}

      <footer className="flex flex-wrap items-center gap-4 text-[11px] text-slate-400">
        <span>Closed → Past · open by date → Current / Future · unmapped → Catch-all</span>
        <span className="flex items-center gap-1 text-rose-400">⚠ overdue</span>
        <span className="flex items-center gap-1 text-amber-500">★ pinned</span>
      </footer>
    </main>
  );
}
