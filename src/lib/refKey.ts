import type { MilestoneRef, Source } from "./types";

/**
 * Canonical string key for a MilestoneRef. Used to map an issue's native
 * milestone to a swimlane. Stable regardless of object key order.
 */
export function refKey(ref: MilestoneRef): string {
  return `${ref.provider}:${ref.project}:${ref.id}`;
}

/** Key for a source / synced.json source entry: "provider:project". */
export function sourceKey(s: Pick<Source, "provider" | "project">): string {
  return `${s.provider}:${s.project}`;
}

/** Per-issue key for local hide/pin state: "provider:project:number". */
export function issueKey(provider: string, project: string, number: string): string {
  return `${provider}:${project}:${number}`;
}
