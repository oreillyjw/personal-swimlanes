import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { MockProvider, type GitlabFixture, type GithubFixture } from "./providers/mock";
import { boardSchema, type Synced, type SyncedSource } from "./types";
import { sourceKey } from "./refKey";
import { buildViewModel } from "./viewModel";
import { parseDay } from "./weeks";

const root = process.cwd();
const read = (p: string) => JSON.parse(readFileSync(path.join(root, p), "utf8"));

/**
 * End-to-end against COMMITTED fictional data only (board.example.json +
 * *.sim.json) — never the gitignored local files. Exercises the full pipeline:
 * MockProvider.listProjectIssues -> synced shape -> buildViewModel.
 */
describe("end-to-end (committed sample)", () => {
  const board = boardSchema.parse(read("data/board.example.json"));
  const mock = new MockProvider(
    read("fixtures/gitlab.sim.json") as GitlabFixture,
    read("fixtures/github.sim.json") as GithubFixture
  );

  async function sync(): Promise<Synced> {
    const sources: Record<string, SyncedSource> = {};
    for (const s of board.sources) {
      sources[sourceKey(s)] = { issues: await mock.listProjectIssues(s), syncedAt: "2026-06-14T00:00:00Z" };
    }
    return { sources, lastSyncAt: "2026-06-14T00:00:00Z" };
  }

  it("places issues into the right swimlane + column and exercises catch-all/hide/pin/PR-filter", async () => {
    const vm = buildViewModel(board, await sync(), parseDay("2026-06-14"));

    const infra = vm.swimlanes.find((l) => l.id === "infra")!;
    const platform = vm.swimlanes.find((l) => l.id === "platform")!;
    const catchAll = vm.swimlanes.find((l) => l.isCatchAll)!;

    // Closed -> Past
    expect(infra.past.map((t) => t.number).sort()).toEqual(["101", "102"]);
    // Pinned #104 sorts first in Current; #103 is overdue
    expect(infra.current[0].number).toBe("104");
    expect(infra.current[0].pinned).toBe(true);
    expect(infra.current.find((t) => t.number === "103")!.overdue).toBe(true);
    // Future — #105 (07-10) and #106 (undated, inherits milestone due 07-18)
    expect(infra.future.map((t) => t.number)).toEqual(["105", "106"]);

    // Platform mapped by milestones 1 & 2
    expect(platform.past.map((t) => t.number)).toEqual(["201"]);
    expect(platform.future.map((t) => t.number).sort()).toEqual(["204", "205"]);

    // Catch-all: unmapped milestones (#107 m99, #206 "Triage") + no-milestone (#109 closed, #207)
    expect(catchAll.current.map((t) => t.number)).toContain("107");
    expect(catchAll.current.map((t) => t.number)).toContain("206");
    expect(catchAll.current.map((t) => t.number)).toContain("207");
    expect(catchAll.past.map((t) => t.number)).toEqual(["109"]);

    // #108 hidden by default; PR #208 filtered out everywhere
    const allNumbers = vm.swimlanes.flatMap((l) => [...l.past, ...l.current, ...l.future]).map((t) => t.number);
    expect(allNumbers).not.toContain("108");
    expect(allNumbers).not.toContain("208");
    expect(vm.counts.hidden).toBe(1);
  });
});
