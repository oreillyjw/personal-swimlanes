import { z } from "zod";

/**
 * Provider identifiers. "mock" is only ever a resolved/runtime provider — board
 * config uses "gitlab" | "github" and SIMULATE re-routes them to the mock.
 */
export const providerIdSchema = z.enum(["gitlab", "github", "mock"]);
export type ProviderId = z.infer<typeof providerIdSchema>;

/** Board-configurable provider (no "mock" — that is runtime only). */
export const boardProviderSchema = z.enum(["gitlab", "github"]);

/** A repo/project to pull issues from. */
export const sourceSchema = z.object({
  provider: boardProviderSchema,
  /** GitLab "group/project" path; GitHub "owner/repo". */
  project: z.string().min(1),
});
export type Source = z.infer<typeof sourceSchema>;

/** A swimlane (row): one project / workstream. */
export const laneSchema = z.object({
  id: z.string().min(1),
  title: z.string(),
  color: z.string().regex(/^#([0-9a-fA-F]{6})$/, "color must be #rrggbb"),
});
export type Lane = z.infer<typeof laneSchema>;

export const itemKindSchema = z.enum(["milestone", "issue"]);
export type ItemKind = z.infer<typeof itemKindSchema>;

/** Link from a planned item to a live VCS milestone or issue. */
export const itemSourceRefSchema = z.object({
  provider: boardProviderSchema,
  project: z.string().min(1),
  type: itemKindSchema,
  /** GitLab milestone id / GitHub milestone number, or the issue number. */
  id: z.string().min(1),
});
export type ItemSourceRef = z.infer<typeof itemSourceRefSchema>;

/** A planned item placed on the timeline. */
export const itemSchema = z.object({
  id: z.string().min(1),
  laneId: z.string().min(1),
  kind: itemKindSchema,
  title: z.string(),
  /** ISO yyyy-mm-dd — the PLANNED date (drives placement). */
  targetDate: z.string(),
  isLaunch: z.boolean().optional().default(false),
  detail: z.string().optional().default(""),
  /** Local-only labels (not synced to the VCS). */
  tags: z.array(z.string()).default([]),
  /** Link for live status/progress; null = plan-only item. */
  sourceRef: itemSourceRefSchema.nullable().optional(),
});
export type Item = z.infer<typeof itemSchema>;

/** A dependency: `from` must finish before `to` (cross-lane allowed). */
export const dependencySchema = z.object({
  from: z.string().min(1), // item id
  to: z.string().min(1), // item id
});
export type Dependency = z.infer<typeof dependencySchema>;

export const boardSchema = z.object({
  board: z.object({
    name: z.string(),
    /** ISO yyyy-mm-dd; must be a Monday (validated at load). */
    startWeek: z.string(),
    horizonWeeks: z.number().int().positive(),
  }),
  sources: z.array(sourceSchema).default([]),
  lanes: z.array(laneSchema).default([]),
  items: z.array(itemSchema).default([]),
  dependencies: z.array(dependencySchema).default([]),
});
export type Board = z.infer<typeof boardSchema>;

/** One issue as cached by "Sync now" (shaped like the normalised live issue). */
export const syncedIssueSchema = z.object({
  number: z.string(),
  title: z.string(),
  state: z.enum(["open", "closed"]),
  dueDate: z.string().nullable(),
  milestone: z
    .object({
      id: z.string(),
      title: z.string(),
      dueDate: z.string().nullable(),
      url: z.string().nullable().default(null),
    })
    .nullable(),
  assignees: z.array(z.string()).default([]),
  url: z.string(),
});
export type SyncedIssue = z.infer<typeof syncedIssueSchema>;

/** Per-source cache: the full issue list pulled for one repo/project. */
export const syncedSourceSchema = z.object({
  issues: z.array(syncedIssueSchema).default([]),
  syncedAt: z.string(),
});
export type SyncedSource = z.infer<typeof syncedSourceSchema>;

export const syncedSchema = z.object({
  /** Key = "provider:project". */
  sources: z.record(z.string(), syncedSourceSchema).default({}),
  lastSyncAt: z.string().nullable().default(null),
});
export type Synced = z.infer<typeof syncedSchema>;
