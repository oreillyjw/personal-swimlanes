import type { Store } from "./store";
import type { Board, Synced, SyncedSource } from "./types";
import { sourceKey } from "./refKey";
import { getProviderResolver, isSimulated } from "./providers";

export interface SyncResult {
  ok: boolean;
  simulated: boolean;
  sourceCount: number;
  issueCount: number;
  errors: { source: string; message: string }[];
  lastSyncAt: string;
}

/**
 * "Sync now": walk every configured source, list ALL its issues through the
 * resolved provider, and write them into synced.json (atomic). Hand-authored
 * board.json is never touched. Server-side only, so tokens never reach the
 * browser.
 */
export async function runSync(store: Store): Promise<SyncResult> {
  const board: Board = await store.getBoard();
  const resolve = await getProviderResolver();
  const now = new Date().toISOString();

  const sources: Record<string, SyncedSource> = {};
  const errors: { source: string; message: string }[] = [];

  await Promise.all(
    board.sources.map(async (source) => {
      const key = sourceKey(source);
      try {
        const provider = resolve(source.provider);
        const issues = await provider.listProjectIssues(source);
        sources[key] = { issues, syncedAt: now };
      } catch (err) {
        errors.push({ source: key, message: (err as Error).message });
      }
    })
  );

  const synced: Synced = { sources, lastSyncAt: now };
  await store.writeSynced(synced);

  const issueCount = Object.values(sources).reduce((n, s) => n + s.issues.length, 0);

  return {
    ok: errors.length === 0,
    simulated: isSimulated(),
    sourceCount: Object.keys(sources).length,
    issueCount,
    errors,
    lastSyncAt: now,
  };
}
