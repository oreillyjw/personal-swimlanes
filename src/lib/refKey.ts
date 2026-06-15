import type { Source } from "./types";

/** Key for a source / synced.json source entry: "provider:project". */
export function sourceKey(s: Pick<Source, "provider" | "project">): string {
  return `${s.provider}:${s.project}`;
}
