import { describe, it, expect } from "vitest";
import { buildWeeks, isMonday, weekFraction, mondayOf, parseDay, toISODate, formatMonthDay } from "./weeks";
import { sourceKey } from "./refKey";
import { buildViewModel } from "./viewModel";
import { boardSchema, type Synced } from "./types";

describe("week math", () => {
  it("recognises Monday start weeks", () => {
    expect(isMonday("2026-06-08")).toBe(true);
    expect(isMonday("2026-06-09")).toBe(false);
  });
  it("builds a labelled Monday-start ruler", () => {
    const weeks = buildWeeks("2026-06-08", 3);
    expect(weeks.map((w) => w.dateLabel)).toEqual(["Jun 8", "Jun 15", "Jun 22"]);
  });
  it("computes fractional week position and snaps to Monday", () => {
    expect(weekFraction("2026-06-08", "2026-06-22")).toBe(2);
    expect(toISODate(mondayOf(parseDay("2026-06-14")))).toBe("2026-06-08");
    expect(formatMonthDay("2026-06-08")).toBe("Jun 8");
  });
});

describe("sourceKey", () => {
  it("is provider-qualified", () => {
    expect(sourceKey({ provider: "gitlab", project: "acme/infra" })).toBe("gitlab:acme/infra");
  });
});

describe("buildViewModel (planner)", () => {
  const board = boardSchema.parse({
    board: { name: "T", startWeek: "2026-06-08", horizonWeeks: 12 },
    sources: [{ provider: "gitlab", project: "acme/infra" }],
    lanes: [
      { id: "a", title: "A", color: "#1E5BB8" },
      { id: "b", title: "B", color: "#2E7D32" },
    ],
    items: [
      { id: "m1", laneId: "a", kind: "milestone", title: "M1", targetDate: "2026-06-26", sourceRef: { provider: "gitlab", project: "acme/infra", type: "milestone", id: "12" } },
      { id: "i1", laneId: "a", kind: "issue", title: "plan title", targetDate: "2026-06-10", sourceRef: { provider: "gitlab", project: "acme/infra", type: "issue", id: "103" } },
      { id: "x1", laneId: "b", kind: "milestone", title: "Plan only", targetDate: "2026-06-15" },
    ],
    dependencies: [{ from: "m1", to: "x1" }],
  });

  const synced: Synced = {
    lastSyncAt: "2026-06-14T00:00:00Z",
    sources: {
      "gitlab:acme/infra": {
        syncedAt: "2026-06-14T00:00:00Z",
        issues: [
          { number: "101", title: "c1", state: "closed", dueDate: null, milestone: { id: "12", title: "Discovery", dueDate: "2026-06-26", url: null }, assignees: [], url: "u101" },
          { number: "103", title: "Capacity model", state: "open", dueDate: "2026-06-10", milestone: { id: "12", title: "Discovery", dueDate: "2026-06-26", url: null }, assignees: ["dana", "rao"], url: "u103" },
          { number: "108", title: "loose", state: "open", dueDate: null, milestone: null, assignees: [], url: "u108" },
        ],
      },
    },
  };

  const vm = buildViewModel(board, synced, parseDay("2026-06-14"));
  const a = vm.lanes.find((l) => l.id === "a")!;
  const b = vm.lanes.find((l) => l.id === "b")!;

  it("places items into their lanes with a week position", () => {
    expect(a.items.map((i) => i.id)).toEqual(["m1", "i1"]);
    expect(b.items.map((i) => i.id)).toEqual(["x1"]);
    expect(a.items[0].weekFraction).toBe(weekFraction("2026-06-08", "2026-06-26"));
  });

  it("resolves milestone progress + live title from synced issues", () => {
    const m1 = a.items.find((i) => i.id === "m1")!;
    expect(m1.progress).toEqual({ closed: 1, total: 2 });
    expect(m1.status).toBe("In Progress");
    expect(m1.title).toBe("Discovery"); // live milestone title wins
    expect(m1.issues).toHaveLength(2);
  });

  it("resolves issue state + flags overdue", () => {
    const i1 = a.items.find((i) => i.id === "i1")!;
    expect(i1.liveState).toBe("active");
    expect(i1.title).toBe("Capacity model");
    expect(i1.overdue).toBe(true); // 2026-06-10 < today, still open
  });

  it("surfaces assignees (issue: own; milestone: unique across its issues)", () => {
    expect(a.items.find((i) => i.id === "i1")!.assignees).toEqual(["dana", "rao"]); // issue 103
    expect(a.items.find((i) => i.id === "m1")!.assignees).toEqual(["dana", "rao"]); // milestone 12 aggregate
  });

  it("treats plan-only items as Planned with no live data", () => {
    const x1 = b.items[0];
    expect(x1.status).toBe("Planned");
    expect(x1.progress).toBeNull();
    expect(x1.hasSourceRef).toBe(false);
  });

  it("flags a dependency slip when prerequisite is dated after dependent", () => {
    expect(vm.dependencies).toEqual([{ from: "m1", to: "x1", slip: true }]); // 06-26 > 06-15
  });

  it("surfaces local tags and the linked sourceRef on resolved items", () => {
    const b = boardSchema.parse({
      board: { name: "T", startWeek: "2026-06-08", horizonWeeks: 8 },
      sources: [{ provider: "gitlab", project: "acme/infra" }],
      lanes: [{ id: "a", title: "A", color: "#1E5BB8" }],
      items: [
        // plan-only item linked to issue 103, with tags
        { id: "p1", laneId: "a", kind: "issue", title: "Plan", targetDate: "2026-06-20", tags: ["risk", "q3"], sourceRef: { provider: "gitlab", project: "acme/infra", type: "issue", id: "103" } },
        // linked to a ref that isn't in the sync -> unresolved
        { id: "p2", laneId: "a", kind: "issue", title: "Ghost", targetDate: "2026-06-20", sourceRef: { provider: "gitlab", project: "acme/infra", type: "issue", id: "999" } },
      ],
      dependencies: [],
    });
    const vm = buildViewModel(b, synced, parseDay("2026-06-14"));
    const items = vm.lanes[0].items;
    const p1 = items.find((i) => i.id === "p1")!;
    expect(p1.tags).toEqual(["risk", "q3"]);
    expect(p1.sourceRef).toEqual({ provider: "gitlab", project: "acme/infra", type: "issue", id: "103" });
    expect(p1.title).toBe("Capacity model"); // live title resolved via link
    expect(p1.linkUnresolved).toBe(false);
    const p2 = items.find((i) => i.id === "p2")!;
    expect(p2.linkUnresolved).toBe(true);
  });

  it("exposes allRefs (every synced ref) for the link picker", () => {
    const ids = vm.allRefs.issues.map((i) => i.id);
    expect(ids).toContain("101");
    expect(ids).toContain("103"); // present in allRefs even though it's placed
  });

  it("offers unplaced refs in available, excluding placed ones", () => {
    // milestone 12 is placed (m1) -> not offered; issue 103 placed (i1) -> not offered
    expect(vm.available.milestones.map((m) => m.id)).not.toContain("12");
    const issueIds = vm.available.issues.map((i) => i.id);
    expect(issueIds).toContain("101");
    expect(issueIds).toContain("108");
    expect(issueIds).not.toContain("103");
  });
});
