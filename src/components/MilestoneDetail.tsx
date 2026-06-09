"use client";

import { useEffect } from "react";
import type { ResolvedLane, ResolvedMilestone } from "@/lib/viewModel";
import { parseDay, formatMonthDay } from "@/lib/weeks";

function fullDate(iso: string | null): string {
  if (!iso) return "No target date";
  const d = parseDay(iso);
  return `${formatMonthDay(d)}, ${d.getUTCFullYear()}`;
}

export default function MilestoneDetail({
  milestone,
  lane,
  onClose,
}: {
  milestone: ResolvedMilestone;
  lane: ResolvedLane;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const m = milestone;
  const progress = m.progress;
  const pct = progress && progress.total > 0 ? Math.round((progress.closed / progress.total) * 100) : 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[85vh] w-full max-w-lg overflow-hidden rounded-xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between px-5 py-4" style={{ backgroundColor: lane.color }}>
          <div className="text-white">
            <div className="text-[11px] font-semibold uppercase tracking-wide opacity-80">{lane.title}</div>
            <h2 className="mt-0.5 text-lg font-bold leading-tight">{m.title}</h2>
          </div>
          <button
            onClick={onClose}
            className="ml-3 rounded-md bg-white/20 px-2 py-1 text-sm font-semibold text-white hover:bg-white/30"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="space-y-4 overflow-y-auto px-5 py-4" style={{ maxHeight: "calc(85vh - 80px)" }}>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <Field label="Target date" value={fullDate(m.targetDate)} />
            <Field label="Status" value={m.status} />
            <Field
              label="Live state"
              value={m.liveState ? (m.liveState === "closed" ? "Closed" : "Active") : "—"}
            />
            <Field label="Type" value={m.isLaunch ? "Launch milestone" : "Phase milestone"} />
          </div>

          {m.detail && <p className="text-sm text-slate-600">{m.detail}</p>}

          <div>
            <div className="mb-1 flex items-center justify-between text-xs font-semibold text-slate-500">
              <span>Progress</span>
              {progress ? (
                <span>
                  {progress.closed}/{progress.total} issues closed ({pct}%)
                </span>
              ) : (
                <span className="text-slate-400">Not synced</span>
              )}
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: lane.color }} />
            </div>
          </div>

          <div>
            <div className="mb-2 text-xs font-semibold text-slate-500">
              Issues {m.issues.length > 0 && `(${m.issues.length})`}
            </div>
            {m.issues.length === 0 ? (
              <p className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-400">
                {m.hasSourceRef ? "No issues loaded — run Sync now." : "This milestone has no source ref."}
              </p>
            ) : (
              <ul className="divide-y divide-slate-100 overflow-hidden rounded-md border border-slate-100">
                {m.issues.map((issue, i) => {
                  const closed = issue.state === "closed";
                  return (
                    <li key={i} className="flex items-center gap-2 px-3 py-1.5 text-sm">
                      <span
                        className={`inline-block h-2 w-2 shrink-0 rounded-full ${
                          closed ? "bg-emerald-500" : "bg-slate-300"
                        }`}
                        title={issue.state}
                      />
                      {issue.url ? (
                        <a
                          href={issue.url}
                          target="_blank"
                          rel="noreferrer"
                          className={`truncate hover:underline ${closed ? "text-slate-400 line-through" : "text-slate-700"}`}
                        >
                          {issue.title}
                        </a>
                      ) : (
                        <span className={`truncate ${closed ? "text-slate-400 line-through" : "text-slate-700"}`}>
                          {issue.title}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {m.url && (
            <a
              href={m.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 rounded-md bg-slate-800 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-700"
            >
              Open milestone in {lane.provider === "gitlab" ? "GitLab" : "GitHub"} ↗
            </a>
          )}
          {m.syncedAt && (
            <p className="text-[11px] text-slate-400">Last synced {new Date(m.syncedAt).toLocaleString()}</p>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</div>
      <div className="text-slate-800">{value}</div>
    </div>
  );
}
