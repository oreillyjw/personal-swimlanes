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
 * *.sim.json). Exercises: MockProvider.listProjectIssues -> synced -> the
 * planner view model (item placement, milestone progress, dependencies).
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

  it("renders the plan with live progress, placement, deps and available refs", async () => {
    const vm = buildViewModel(board, await sync(), parseDay("2026-06-14"));

    const infra = vm.lanes.find((l) => l.id === "infra")!;
    const platform = vm.lanes.find((l) => l.id === "platform")!;

    // Milestone 12 in gitlab.sim has 4 issues: 101,102 closed; 103,104 open.
    const m12 = infra.items.find((i) => i.id === "infra-m12")!;
    expect(m12.progress).toEqual({ closed: 2, total: 4 });
    expect(m12.weekFraction).toBeGreaterThan(0);
    expect(m12.url).toContain("gitlab.com"); // milestone deep link resolved
    expect(m12.assignees).toContain("dana"); // aggregated from milestone issues

    // Plan-only launch item
    const launch = infra.items.find((i) => i.id === "infra-launch")!;
    expect(launch.isLaunch).toBe(true);
    expect(launch.status).toBe("Planned");

    // GitHub milestone 1: 201 closed; 202,203 open -> 1/3
    const pm1 = platform.items.find((i) => i.id === "plat-m1")!;
    expect(pm1.progress).toEqual({ closed: 1, total: 3 });

    // The sample plan has no ordering violations.
    expect(vm.dependencies).toHaveLength(3);
    expect(vm.dependencies.every((d) => !d.slip)).toBe(true);

    // Placed refs are excluded from the Add panel; unplaced remain (incl. the
    // unmapped milestones 99 / 5 and the no-milestone issues).
    const milestoneIds = vm.available.milestones.map((m) => m.id);
    expect(milestoneIds).not.toContain("12"); // placed
    expect(milestoneIds).toContain("99"); // gitlab backlog, unplaced
    expect(vm.available.issues.map((i) => i.id)).not.toContain("103"); // placed (infra-i103)
    expect(vm.available.issues.some((i) => i.id === "208")).toBe(false); // PR filtered out
  });
});
