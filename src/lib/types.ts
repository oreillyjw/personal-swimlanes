import { z } from "zod";

/**
 * Provider identifiers. "mock" is only ever a resolved/runtime provider — board
 * config uses "gitlab" | "github" and SIMULATE re-routes them to the mock.
 */
export const providerIdSchema = z.enum(["gitlab", "github", "mock"]);
export type ProviderId = z.infer<typeof providerIdSchema>;

/** A pointer at one VCS (or simulated) milestone. */
export const milestoneRefSchema = z.object({
  provider: providerIdSchema,
  /** GitLab: "group/project" path or numeric id. GitHub: "owner/repo". */
  project: z.string().min(1),
  /** Provider milestone id (GitLab milestone id, GitHub milestone number). */
  id: z.string().min(1),
});
export type MilestoneRef = z.infer<typeof milestoneRefSchema>;

/** Hand-authored milestone in board.json. */
export const milestoneSchema = z.object({
  id: z.string().min(1),
  title: z.string(),
  /** ISO yyyy-mm-dd; drives week placement when no live dueDate is synced. */
  targetDate: z.string().nullable().optional(),
  status: z.string().default("To Do"),
  detail: z.string().optional().default(""),
  isLaunch: z.boolean().optional().default(false),
  /** null/absent = hand-planned only (never synced). */
  sourceRef: milestoneRefSchema.nullable().optional(),
});
export type Milestone = z.infer<typeof milestoneSchema>;

export const laneSchema = z.object({
  id: z.string().min(1),
  title: z.string(),
  color: z.string().regex(/^#([0-9a-fA-F]{6})$/, "color must be #rrggbb"),
  launchLabel: z.string().optional().default(""),
  provider: z.enum(["gitlab", "github"]),
  milestones: z.array(milestoneSchema),
});
export type Lane = z.infer<typeof laneSchema>;

export const dependencySchema = z.object({
  /** Milestone id the arrow starts from (must finish first). */
  from: z.string().min(1),
  /** Milestone id the arrow points to (depends on `from`). */
  to: z.string().min(1),
});
export type Dependency = z.infer<typeof dependencySchema>;

export const boardSchema = z.object({
  board: z.object({
    name: z.string(),
    /** ISO yyyy-mm-dd; must be a Monday (validated at load). */
    startWeek: z.string(),
    horizonWeeks: z.number().int().positive(),
  }),
  lanes: z.array(laneSchema),
  dependencies: z.array(dependencySchema).default([]),
});
export type Board = z.infer<typeof boardSchema>;

/** Live values written by "Sync now", keyed by stringified sourceRef. */
export const syncedEntrySchema = z.object({
  title: z.string(),
  dueDate: z.string().nullable(),
  state: z.enum(["active", "closed"]),
  issuesTotal: z.number().int().nonnegative(),
  issuesClosed: z.number().int().nonnegative(),
  url: z.string(),
  /** Issue list captured for the hover detail. */
  issues: z
    .array(
      z.object({
        title: z.string(),
        state: z.string(),
        url: z.string(),
      })
    )
    .default([]),
  /** ISO timestamp of when this entry was synced. */
  syncedAt: z.string(),
});
export type SyncedEntry = z.infer<typeof syncedEntrySchema>;

export const syncedSchema = z.object({
  entries: z.record(z.string(), syncedEntrySchema).default({}),
  lastSyncAt: z.string().nullable().default(null),
});
export type Synced = z.infer<typeof syncedSchema>;
