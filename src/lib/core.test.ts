import { describe, it, expect } from "vitest";
import { buildWeeks, isMonday, weekFraction, weekIndexFor, mondayOf, parseDay, toISODate } from "./weeks";
import { refKey } from "./refKey";
import { buildViewModel } from "./viewModel";
import type { Board, Synced } from "./types";

describe("week math", () => {
  it("recognises Monday start weeks", () => {
    expect(isMonday("2026-06-08")).toBe(true); // a Monday
    expect(isMonday("2026-06-09")).toBe(false);
  });

  it("builds a labelled Monday-start ruler", () => {
    const weeks = buildWeeks("2026-06-08", 3);
    expect(weeks).toHaveLength(3);
    expect(weeks[0].label).toBe("W1");
    expect(weeks[0].dateLabel).toBe("Jun 8");
    expect(weeks[1].dateLabel).toBe("Jun 15");
  });

  it("places dates in the correct week column", () => {
    expect(weekIndexFor("2026-06-08", "2026-06-08", 19)).toBe(0);
    expect(weekIndexFor("2026-06-08", "2026-06-27", 19)).toBe(2); // W3
    expect(Math.floor(weekFraction("2026-06-08", "2026-08-31"))).toBe(12);
  });

  it("snaps an arbitrary day to its Monday", () => {
    expect(toISODate(mondayOf(parseDay("2026-06-10")))).toBe("2026-06-08");
  });
});

describe("refKey", () => {
  it("is stable and provider-qualified", () => {
    expect(refKey({ provider: "github", project: "acme/platform", id: "1" })).toBe(
      "github:acme/platform:1"
    );
  });
});

describe("buildViewModel merge", () => {
  const board: Board = {
    board: { name: "T", startWeek: "2026-06-08", horizonWeeks: 19 },
    lanes: [
      {
        id: "l1",
        title: "Lane 1",
        color: "#1E5BB8",
        launchLabel: "",
        provider: "gitlab",
        milestones: [
          {
            id: "m1",
            title: "Planned",
            targetDate: "2026-06-27",
            status: "To Do",
            detail: "",
            isLaunch: false,
            sourceRef: { provider: "gitlab", project: "acme/infra", id: "12" },
          },
          {
            id: "m2",
            title: "No ref",
            targetDate: "2026-07-18",
            status: "To Do",
            detail: "",
            isLaunch: false,
            sourceRef: null,
          },
        ],
      },
    ],
    dependencies: [],
  };

  it("lets live synced values win where a sourceRef resolves", () => {
    const synced: Synced = {
      lastSyncAt: "2026-06-09T00:00:00Z",
      entries: {
        "gitlab:acme/infra:12": {
          title: "Discovery & Design",
          dueDate: "2026-07-04", // differs from hand targetDate -> should win
          state: "closed",
          issuesTotal: 5,
          issuesClosed: 5,
          url: "https://gitlab.com/x",
          issues: [{ title: "i", state: "closed", url: "u" }],
          syncedAt: "2026-06-09T00:00:00Z",
        },
      },
    };
    const vm = buildViewModel(board, synced, parseDay("2026-06-08"));
    const m1 = vm.lanes[0].milestones[0];
    expect(m1.targetDate).toBe("2026-07-04"); // live wins
    expect(m1.status).toBe("Closed"); // closed state surfaces
    expect(m1.progress).toEqual({ closed: 5, total: 5 });
    expect(m1.synced).toBe(true);
  });

  it("falls back to hand-authored values when not synced", () => {
    const vm = buildViewModel(board, { entries: {}, lastSyncAt: null });
    const m1 = vm.lanes[0].milestones[0];
    expect(m1.targetDate).toBe("2026-06-27"); // hand value
    expect(m1.progress).toBeNull();
    expect(m1.synced).toBe(false);
    const m2 = vm.lanes[0].milestones[1];
    expect(m2.hasSourceRef).toBe(false);
  });
});
