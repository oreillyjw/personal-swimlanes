import type { MilestoneRef } from "./types";

/**
 * Canonical string key for a MilestoneRef. Used as the key into
 * synced.json's `entries` map. Stable regardless of object key order.
 */
export function refKey(ref: MilestoneRef): string {
  return `${ref.provider}:${ref.project}:${ref.id}`;
}
