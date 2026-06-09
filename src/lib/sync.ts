import type { Store } from "./store";
import type { Board, Synced, SyncedEntry } from "./types";
import { refKey } from "./refKey";
import { getProviderResolver, isSimulated, type BoardProviderId } from "./providers";

export interface SyncResult {
  ok: boolean;
  simulated: boolean;
  syncedCount: number;
  errors: { ref: string; message: string }[];
  lastSyncAt: string;
}

/**
 * "Sync now": walk every milestone that has a sourceRef, fetch its live
 * milestone + issues through the resolved provider, and write the values into
 * synced.json (atomic). Hand-authored board.json is never touched.
 */
export async function runSync(store: Store): Promise<SyncResult> {
  const board: Board = await store.getBoard();
  const resolve = await getProviderResolver();
  const now = new Date().toISOString();

  const entries: Record<string, SyncedEntry> = {};
  const errors: { ref: string; message: string }[] = [];

  // Collect unique refs (a ref could in theory appear in more than one lane).
  const jobs: { laneProvider: BoardProviderId; ref: NonNullable<Board["lanes"][number]["milestones"][number]["sourceRef"]> }[] = [];
  for (const lane of board.lanes) {
    for (const m of lane.milestones) {
      if (m.sourceRef) jobs.push({ laneProvider: lane.provider, ref: m.sourceRef });
    }
  }

  await Promise.all(
    jobs.map(async ({ laneProvider, ref }) => {
      const key = refKey(ref);
      try {
        const provider = resolve(laneProvider);
        const [milestone, issues] = await Promise.all([
          provider.getMilestone(ref),
          provider.listIssues(ref),
        ]);
        entries[key] = {
          title: milestone.title,
          dueDate: milestone.dueDate,
          state: milestone.state,
          issuesTotal: milestone.issuesTotal,
          issuesClosed: milestone.issuesClosed,
          url: milestone.url,
          issues,
          syncedAt: now,
        };
      } catch (err) {
        errors.push({ ref: key, message: (err as Error).message });
      }
    })
  );

  const synced: Synced = { entries, lastSyncAt: now };
  await store.writeSynced(synced);

  return {
    ok: errors.length === 0,
    simulated: isSimulated(),
    syncedCount: Object.keys(entries).length,
    errors,
    lastSyncAt: now,
  };
}
