import { z } from "zod";

/**
 * Provider identifiers. "mock" is only ever a resolved/runtime provider — board
 * config uses "gitlab" | "github" and SIMULATE re-routes them to the mock.
 */
export const providerIdSchema = z.enum(["gitlab", "github", "mock"]);
export type ProviderId = z.infer<typeof providerIdSchema>;

/** Board-configurable provider (no "mock" — that is runtime only). */
export const boardProviderSchema = z.enum(["gitlab", "github"]);

/** A pointer at one VCS milestone (used to map a milestone to a swimlane). */
export const milestoneRefSchema = z.object({
  provider: providerIdSchema,
  /** GitLab: "group/project" path or numeric id. GitHub: "owner/repo". */
  project: z.string().min(1),
  /** Provider milestone id (GitLab milestone id, GitHub milestone number). */
  id: z.string().min(1),
});
export type MilestoneRef = z.infer<typeof milestoneRefSchema>;

/** A repo/project to pull ALL issues from (drives Catch-all completeness). */
export const sourceSchema = z.object({
  provider: boardProviderSchema,
  /** GitLab "group/project" path; GitHub "owner/repo". */
  project: z.string().min(1),
});
export type Source = z.infer<typeof sourceSchema>;

/** A swimlane (row): a local grouping of milestones. */
export const swimlaneSchema = z.object({
  id: z.string().min(1),
  title: z.string(),
  color: z.string().regex(/^#([0-9a-fA-F]{6})$/, "color must be #rrggbb"),
  /** Milestone refs assigned to this swimlane; an issue inherits its lane. */
  milestones: z.array(milestoneRefSchema).default([]),
});
export type Swimlane = z.infer<typeof swimlaneSchema>;

/** Local-only per-issue state. Never written back to the VCS. */
export const issueOverrideSchema = z.object({
  hidden: z.boolean().optional().default(false),
  pinned: z.boolean().optional().default(false),
});
export type IssueOverride = z.infer<typeof issueOverrideSchema>;

export const boardSchema = z.object({
  board: z.object({
    name: z.string(),
    /**
     * Current column = open issues due before, or within, this many weeks from
     * the start of the current week. Default 2 (this + next week).
     */
    currentWindowWeeks: z.number().int().positive().default(2),
  }),
  sources: z.array(sourceSchema).default([]),
  swimlanes: z.array(swimlaneSchema).default([]),
  /** Key = "provider:project:number". */
  issueState: z.record(z.string(), issueOverrideSchema).default({}),
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
    })
    .nullable(),
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
