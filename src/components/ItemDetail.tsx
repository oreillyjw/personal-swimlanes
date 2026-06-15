"use client";

import { useEffect, useMemo, useState } from "react";
import type { Item, ItemSourceRef, Lane } from "@/lib/types";
import type { AvailableRef, ResolvedItem, ResolvedDependency } from "@/lib/viewModel";

export interface ItemRef {
  id: string;
  title: string;
  laneTitle: string;
}

export default function ItemDetail({
  item,
  rawItem,
  lanes,
  allItems,
  allRefs,
  dependencies,
  onUpdate,
  onDelete,
  onAddDependency,
  onRemoveDependency,
  onClose,
}: {
  item: ResolvedItem;
  rawItem: Item;
  lanes: Lane[];
  allItems: ItemRef[];
  allRefs: { milestones: AvailableRef[]; issues: AvailableRef[] };
  dependencies: ResolvedDependency[];
  onUpdate: (id: string, patch: Partial<Item>) => void;
  onDelete: (id: string) => void;
  onAddDependency: (from: string, to: string) => void;
  onRemoveDependency: (from: string, to: string) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const [title, setTitle] = useState(rawItem.title);
  const [date, setDate] = useState(rawItem.targetDate);
  const [laneId, setLaneId] = useState(rawItem.laneId);
  const [isLaunch, setIsLaunch] = useState(Boolean(rawItem.isLaunch));
  const [depTarget, setDepTarget] = useState("");
  const [depDir, setDepDir] = useState<"after" | "before">("after");
  const [tagDraft, setTagDraft] = useState("");
  const [linking, setLinking] = useState(false);
  const [linkFilter, setLinkFilter] = useState("");

  const lane = lanes.find((l) => l.id === item.laneId);
  const progress = item.progress;
  const pct = progress && progress.total > 0 ? Math.round((progress.closed / progress.total) * 100) : 0;
  const dirty = title !== rawItem.title || date !== rawItem.targetDate || laneId !== rawItem.laneId || isLaunch !== Boolean(rawItem.isLaunch);

  const incoming = dependencies.filter((d) => d.to === item.id); // prerequisites
  const outgoing = dependencies.filter((d) => d.from === item.id); // dependents
  const nameOf = (id: string) => allItems.find((a) => a.id === id)?.title ?? id;
  const others = allItems.filter((a) => a.id !== item.id);

  function addDep() {
    if (!depTarget) return;
    if (depDir === "after") onAddDependency(depTarget, item.id); // target must finish before this
    else onAddDependency(item.id, depTarget); // this must finish before target
    setDepTarget("");
  }

  // --- Tags (local-only) ---
  const tags = rawItem.tags ?? [];
  function addTag() {
    const t = tagDraft.trim();
    if (!t || tags.includes(t)) {
      setTagDraft("");
      return;
    }
    onUpdate(item.id, { tags: [...tags, t] });
    setTagDraft("");
  }
  function removeTag(t: string) {
    onUpdate(item.id, { tags: tags.filter((x) => x !== t) });
  }

  // --- Link to a VCS issue / milestone ---
  const candidates = useMemo(() => {
    const all = [...allRefs.issues, ...allRefs.milestones];
    const q = linkFilter.trim().toLowerCase();
    const filtered = q ? all.filter((r) => r.title.toLowerCase().includes(q) || r.project.toLowerCase().includes(q) || r.id.includes(q)) : all;
    return filtered.slice(0, 50);
  }, [allRefs, linkFilter]);

  function linkTo(ref: AvailableRef) {
    const sourceRef: ItemSourceRef = { provider: ref.provider, project: ref.project, type: ref.type, id: ref.id };
    onUpdate(item.id, { sourceRef });
    setLinking(false);
    setLinkFilter("");
  }
  function unlink() {
    onUpdate(item.id, { sourceRef: null });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={onClose}>
      <div className="max-h-[88vh] w-full max-w-lg overflow-hidden rounded-xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between px-5 py-4" style={{ backgroundColor: lane?.color ?? "#334155" }}>
          <div className="text-white">
            <div className="text-[11px] font-semibold uppercase tracking-wide opacity-80">
              {lane?.title} · {item.kind}
            </div>
            <h2 className="mt-0.5 text-lg font-bold leading-tight">{item.title}</h2>
          </div>
          <button onClick={onClose} className="ml-3 rounded-md bg-white/20 px-2 py-1 text-sm font-semibold text-white hover:bg-white/30" aria-label="Close">
            ✕
          </button>
        </div>

        <div className="space-y-4 overflow-y-auto px-5 py-4" style={{ maxHeight: "calc(88vh - 80px)" }}>
          {/* Live status */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded bg-slate-100 px-2 py-1 font-semibold text-slate-600">{item.status}</span>
            {item.overdue && <span className="rounded bg-rose-100 px-2 py-1 font-semibold text-rose-700">⚠ overdue</span>}
            {progress && (
              <span className="rounded bg-slate-100 px-2 py-1 text-slate-600">
                {progress.closed}/{progress.total} issues ({pct}%)
              </span>
            )}
            {item.url && (
              <a href={item.url} target="_blank" rel="noreferrer" className="rounded bg-slate-800 px-2 py-1 font-semibold text-white hover:bg-slate-700">
                Open in VCS ↗
              </a>
            )}
          </div>

          {/* Assignees (from the VCS) */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Assignees</span>
            {item.assignees.length === 0 ? (
              <span className="text-slate-400">{item.hasSourceRef ? "none" : "—"}</span>
            ) : (
              item.assignees.map((a) => (
                <span key={a} className="rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-600">@{a}</span>
              ))
            )}
          </div>

          {/* Link to a VCS issue / milestone */}
          <section className="space-y-2 rounded-lg border border-slate-200 p-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Linked VCS item</span>
              {item.sourceRef ? (
                <button onClick={unlink} className="text-xs text-rose-500 hover:underline">Unlink</button>
              ) : (
                <button onClick={() => setLinking((v) => !v)} className="text-xs text-slate-600 hover:underline">
                  {linking ? "Cancel" : "Link…"}
                </button>
              )}
            </div>
            {item.sourceRef ? (
              <div className="text-xs text-slate-600">
                {item.url ? (
                  <a href={item.url} target="_blank" rel="noreferrer" className="font-medium text-indigo-600 hover:underline">
                    {item.sourceRef.provider}:{item.sourceRef.project} · {item.sourceRef.type} #{item.sourceRef.id} ↗
                  </a>
                ) : (
                  <span>
                    <span className="font-mono">{item.sourceRef.provider}:{item.sourceRef.project}</span> · {item.sourceRef.type} #{item.sourceRef.id}
                  </span>
                )}
                {item.linkUnresolved && <span className="ml-1 text-rose-500">⚠ not found in last sync</span>}
                <button onClick={() => setLinking((v) => !v)} className="ml-2 text-slate-500 hover:underline">change</button>
              </div>
            ) : (
              !linking && <p className="text-xs text-slate-400">Not linked — this is a plan-only item.</p>
            )}
            {linking && (
              <div className="space-y-1">
                <input
                  value={linkFilter}
                  onChange={(e) => setLinkFilter(e.target.value)}
                  placeholder="Filter issues / milestones…"
                  className="w-full rounded border border-slate-200 px-2 py-1 text-xs"
                />
                <ul className="max-h-44 divide-y divide-slate-100 overflow-y-auto rounded border border-slate-100">
                  {candidates.length === 0 ? (
                    <li className="px-2 py-2 text-xs text-slate-400">No matches — run Sync now first.</li>
                  ) : (
                    candidates.map((ref) => (
                      <li key={ref.key}>
                        <button onClick={() => linkTo(ref)} className="flex w-full items-center gap-1.5 px-2 py-1.5 text-left text-xs hover:bg-slate-50">
                          <span className="rounded bg-slate-100 px-1 text-[9px] uppercase text-slate-500">{ref.type}</span>
                          <span className="flex-1 truncate" title={`${ref.project} · ${ref.title}`}>
                            <span className="text-slate-400">{ref.project}</span> #{ref.id} {ref.title}
                          </span>
                        </button>
                      </li>
                    ))
                  )}
                </ul>
              </div>
            )}
          </section>

          {/* Tags (local-only) */}
          <section className="space-y-2 rounded-lg border border-slate-200 p-3">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Tags <span className="font-normal normal-case text-slate-400">(local)</span></div>
            <div className="flex flex-wrap items-center gap-1.5">
              {tags.map((t) => (
                <span key={t} className="flex items-center gap-1 rounded bg-indigo-50 px-1.5 py-0.5 text-xs text-indigo-700">
                  {t}
                  <button onClick={() => removeTag(t)} className="text-indigo-400 hover:text-rose-500" aria-label={`Remove ${t}`}>✕</button>
                </span>
              ))}
              {tags.length === 0 && <span className="text-xs text-slate-400">No tags yet.</span>}
            </div>
            <input
              value={tagDraft}
              onChange={(e) => setTagDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === ",") {
                  e.preventDefault();
                  addTag();
                }
              }}
              placeholder="Add a tag and press Enter"
              className="w-full rounded border border-slate-200 px-2 py-1 text-xs"
            />
          </section>

          {/* Edit fields */}
          <section className="space-y-2 rounded-lg border border-slate-200 p-3">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Plan</div>
            <label className="block">
              <span className="text-[10px] uppercase tracking-wide text-slate-400">Title</span>
              <input value={title} onChange={(e) => setTitle(e.target.value)} className="mt-0.5 w-full rounded border border-slate-200 px-2 py-1 text-sm" />
            </label>
            <div className="flex gap-2">
              <label className="flex-1">
                <span className="text-[10px] uppercase tracking-wide text-slate-400">Target date</span>
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-0.5 w-full rounded border border-slate-200 px-2 py-1 text-sm" />
              </label>
              <label className="flex-1">
                <span className="text-[10px] uppercase tracking-wide text-slate-400">Lane</span>
                <select value={laneId} onChange={(e) => setLaneId(e.target.value)} className="mt-0.5 w-full rounded border border-slate-200 px-2 py-1 text-sm">
                  {lanes.map((l) => (
                    <option key={l.id} value={l.id}>{l.title}</option>
                  ))}
                </select>
              </label>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={isLaunch} onChange={(e) => setIsLaunch(e.target.checked)} />
              Launch milestone
            </label>
            <div className="flex justify-between pt-1">
              <button onClick={() => onDelete(item.id)} className="rounded px-2 py-1 text-xs text-rose-500 hover:bg-rose-50">
                Remove from plan
              </button>
              <button
                onClick={() => onUpdate(item.id, { title, targetDate: date, laneId, isLaunch })}
                disabled={!dirty}
                className="rounded-md bg-slate-800 px-3 py-1 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-40"
              >
                Save
              </button>
            </div>
          </section>

          {/* Dependencies */}
          <section className="space-y-2 rounded-lg border border-slate-200 p-3">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Dependencies</div>
            {incoming.length === 0 && outgoing.length === 0 && <p className="text-xs text-slate-400">None yet.</p>}
            {incoming.map((d) => (
              <DepRow key={`in-${d.from}`} label="needs" name={nameOf(d.from)} slip={d.slip} onRemove={() => onRemoveDependency(d.from, d.to)} />
            ))}
            {outgoing.map((d) => (
              <DepRow key={`out-${d.to}`} label="blocks" name={nameOf(d.to)} slip={d.slip} onRemove={() => onRemoveDependency(d.from, d.to)} />
            ))}
            <div className="flex items-center gap-1.5 pt-1">
              <span className="text-xs text-slate-500">This item</span>
              <select value={depDir} onChange={(e) => setDepDir(e.target.value as "after" | "before")} className="rounded border border-slate-200 px-1 py-1 text-xs">
                <option value="after">needs (waits for)</option>
                <option value="before">blocks</option>
              </select>
              <select value={depTarget} onChange={(e) => setDepTarget(e.target.value)} className="flex-1 rounded border border-slate-200 px-1 py-1 text-xs">
                <option value="">select item…</option>
                {others.map((a) => (
                  <option key={a.id} value={a.id}>{a.laneTitle} · {a.title}</option>
                ))}
              </select>
              <button onClick={addDep} disabled={!depTarget} className="rounded bg-slate-800 px-2 py-1 text-xs font-semibold text-white hover:bg-slate-700 disabled:opacity-40">
                Add
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function DepRow({ label, name, slip, onRemove }: { label: string; name: string; slip: boolean; onRemove: () => void }) {
  return (
    <div className="flex items-center justify-between gap-2 text-xs">
      <span className={slip ? "text-rose-600" : "text-slate-600"}>
        <span className="text-slate-400">{label}</span> {name} {slip && "⚠"}
      </span>
      <button onClick={onRemove} className="rounded px-1.5 py-0.5 text-slate-400 hover:bg-slate-100 hover:text-rose-500" title="Remove dependency">
        ✕
      </button>
    </div>
  );
}
