import { describe, it, expect } from "vitest";
import { mondayOf, parseDay, toISODate, formatMonthDay } from "./weeks";
import { refKey, sourceKey, issueKey } from "./refKey";
import { bucketFor, currentWindow, isOverdue } from "./bucket";
import { buildViewModel } from "./viewModel";
import type { Board, Synced } from "./types";

describe("date helpers", () => {
  it("snaps an arbitrary day to its Monday (UTC)", () => {
    expect(toISODate(mondayOf(parseDay("2026-06-10")))).toBe("2026-06-08");
    expect(toISODate(mondayOf(parseDay("2026-06-14")))).toBe("2026-06-08"); // Sunday -> prior Monday
  });
  it("formats a month/day label", () => {
    expect(formatMonthDay("2026-06-08")).toBe("Jun 8");
  });
});

describe("keys", () => {
  it("are stable and provider-qualified", () => {
    expect(refKey({ provider: "github", project: "acme/platform", id: "1" })).toBe("github:acme/platform:1");
    expect(sourceKey({ provider: "gitlab", project: "acme/infra" })).toBe("gitlab:acme/infra");
    expect(issueKey("github", "acme/platform", "42")).toBe("github:acme/platform:42");
  });
});

describe("bucketing (currentWindowWeeks = 2, today 2026-06-14)", () => {
  const w = currentWindow(parseDay("2026-06-14"), 2); // window [2026-06-08, 2026-06-22)

  it("computes the window from the Monday of the current week", () => {
    expect(w.startISO).toBe("2026-06-08");
    expect(w.endISO).toBe("2026-06-22");
    expect(w.todayISO).toBe("2026-06-14");
  });

  it("places closed issues in Past regardless of date", () => {
    expect(bucketFor({ state: "closed", dueDate: "2026-12-01" }, w)).toBe("past");
    expect(bucketFor({ state: "closed", dueDate: null }, w)).toBe("past");
  });

  it("places open issues by date; undated -> Current", () => {
    expect(bucketFor({ state: "open", dueDate: "2026-06-18" }, w)).toBe("current"); // in window
    expect(bucketFor({ state: "open", dueDate: "2026-06-10" }, w)).toBe("current"); // overdue, still Current
    expect(bucketFor({ state: "open", dueDate: "2026-06-22" }, w)).toBe("future"); // on/after window end
    expect(bucketFor({ state: "open", dueDate: null }, w)).toBe("current");
  });

  it("flags open dated issues before today as overdue", () => {
    expect(isOverdue({ state: "open", dueDate: "2026-06-10" }, w)).toBe(true);
    expect(isOverdue({ state: "open", dueDate: "2026-06-14" }, w)).toBe(false); // today is not overdue
    expect(isOverdue({ state: "closed", dueDate: "2026-06-10" }, w)).toBe(false);
    expect(isOverdue({ state: "open", dueDate: null }, w)).toBe(false);
  });
});

describe("buildViewModel", () => {
  const board: Board = {
    board: { name: "T", currentWindowWeeks: 2 },
    sources: [{ provider: "gitlab", project: "acme/infra" }],
    swimlanes: [
      {
        id: "infra",
        title: "Infra",
        color: "#1E5BB8",
        milestones: [{ provider: "gitlab", project: "acme/infra", id: "12" }],
      },
    ],
    issueState: {
      "gitlab:acme/infra:104": { hidden: false, pinned: true },
      "gitlab:acme/infra:108": { hidden: true, pinned: false },
    },
  };

  const synced: Synced = {
    lastSyncAt: "2026-06-14T00:00:00Z",
    sources: {
      "gitlab:acme/infra": {
        syncedAt: "2026-06-14T00:00:00Z",
        issues: [
          { number: "101", title: "Closed one", state: "closed", dueDate: "2026-05-20", milestone: { id: "12", title: "Discovery", dueDate: "2026-06-12" }, url: "u101" },
          { number: "103", title: "Overdue open", state: "open", dueDate: "2026-06-10", milestone: { id: "12", title: "Discovery", dueDate: "2026-06-12" }, url: "u103" },
          { number: "104", title: "Pinned current", state: "open", dueDate: "2026-06-18", milestone: { id: "12", title: "Discovery", dueDate: "2026-06-12" }, url: "u104" },
          { number: "108", title: "Hidden catch-all", state: "open", dueDate: null, milestone: null, url: "u108" },
          { number: "200", title: "Unmapped milestone", state: "open", dueDate: "2026-06-19", milestone: { id: "99", title: "Backlog", dueDate: null }, url: "u200" },
        ],
      },
    },
  };

  it("maps issues to swimlanes by milestone, with unmapped/no-milestone -> Catch-all", () => {
    const vm = buildViewModel(board, synced, parseDay("2026-06-14"));
    const infra = vm.swimlanes.find((l) => l.id === "infra")!;
    const catchAll = vm.swimlanes.find((l) => l.isCatchAll)!;
    expect(infra.past.map((t) => t.number)).toEqual(["101"]);
    // #103 overdue + #104 pinned are both Current; pinned sorts first.
    expect(infra.current.map((t) => t.number)).toEqual(["104", "103"]);
    // #200 (unmapped milestone) is in catch-all; #108 hidden excluded by default.
    expect(catchAll.current.map((t) => t.number)).toEqual(["200"]);
  });

  it("flags overdue and pinned tiles", () => {
    const vm = buildViewModel(board, synced, parseDay("2026-06-14"));
    const infra = vm.swimlanes.find((l) => l.id === "infra")!;
    expect(infra.current.find((t) => t.number === "103")!.overdue).toBe(true);
    expect(infra.current.find((t) => t.number === "104")!.pinned).toBe(true);
  });

  it("hides hidden issues unless showHidden, and counts them", () => {
    const def = buildViewModel(board, synced, parseDay("2026-06-14"));
    expect(def.counts.hidden).toBe(1);
    expect(def.swimlanes.find((l) => l.isCatchAll)!.current.some((t) => t.number === "108")).toBe(false);

    const shown = buildViewModel(board, synced, parseDay("2026-06-14"), { showHidden: true });
    expect(shown.swimlanes.find((l) => l.isCatchAll)!.current.some((t) => t.number === "108")).toBe(true);
  });

  it("applies local lane / title / note overrides and reports discovered milestones", () => {
    const b: Board = {
      board: { name: "T", currentWindowWeeks: 2 },
      sources: [{ provider: "gitlab", project: "acme/infra" }],
      swimlanes: [
        { id: "infra", title: "Infra", color: "#1E5BB8", milestones: [{ provider: "gitlab", project: "acme/infra", id: "12" }] },
        { id: "ops", title: "Ops", color: "#2E7D32", milestones: [] },
      ],
      issueState: {
        "gitlab:acme/infra:103": { hidden: false, pinned: false, laneId: "ops" }, // move out of milestone lane
        "gitlab:acme/infra:104": { hidden: false, pinned: false, title: "RENAMED", note: "ping design" },
        "gitlab:acme/infra:200": { hidden: false, pinned: false, laneId: "__catch_all__" }, // force catch-all
      },
    };
    const s: Synced = {
      lastSyncAt: null,
      sources: {
        "gitlab:acme/infra": {
          syncedAt: "x",
          issues: [
            { number: "103", title: "Moved", state: "open", dueDate: "2026-06-18", milestone: { id: "12", title: "Discovery", dueDate: null }, url: "u" },
            { number: "104", title: "Original", state: "open", dueDate: "2026-06-18", milestone: { id: "12", title: "Discovery", dueDate: null }, url: "u" },
            { number: "200", title: "Pinme", state: "open", dueDate: "2026-06-18", milestone: { id: "12", title: "Discovery", dueDate: null }, url: "u" },
          ],
        },
      },
    };
    const vm = buildViewModel(b, s, parseDay("2026-06-14"));
    const infra = vm.swimlanes.find((l) => l.id === "infra")!;
    const ops = vm.swimlanes.find((l) => l.id === "ops")!;
    const catchAll = vm.swimlanes.find((l) => l.isCatchAll)!;

    // #103 moved to ops; flagged laneOverridden
    expect(ops.current.map((t) => t.number)).toEqual(["103"]);
    expect(ops.current[0].laneOverridden).toBe(true);
    // #200 forced to catch-all even though its milestone (12) maps to infra
    expect(catchAll.current.map((t) => t.number)).toEqual(["200"]);
    // #104 title/note override
    const t104 = infra.current.find((t) => t.number === "104")!;
    expect(t104.title).toBe("RENAMED");
    expect(t104.liveTitle).toBe("Original");
    expect(t104.titleOverridden).toBe(true);
    expect(t104.note).toBe("ping design");
    // discovered milestone surfaced with its current mapping
    expect(vm.discoveredMilestones).toEqual([
      { key: "gitlab:acme/infra:12", provider: "gitlab", project: "acme/infra", id: "12", title: "Discovery", laneId: "infra" },
    ]);
  });

  it("does not render the catch-all swimlane when it is empty", () => {
    const empty: Synced = {
      lastSyncAt: null,
      sources: {
        "gitlab:acme/infra": {
          syncedAt: "x",
          issues: [
            { number: "1", title: "A", state: "open", dueDate: "2026-06-18", milestone: { id: "12", title: "D", dueDate: null }, url: "u" },
          ],
        },
      },
    };
    const vm = buildViewModel(board, empty, parseDay("2026-06-14"));
    expect(vm.swimlanes.some((l) => l.isCatchAll)).toBe(false);
  });
});
