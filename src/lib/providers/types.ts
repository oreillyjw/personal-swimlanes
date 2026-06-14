import type { ProviderId } from "../types";

/** A repo/project to list issues from. */
export interface ProjectRef {
  provider: "gitlab" | "github";
  /** GitLab "group/project" path; GitHub "owner/repo". */
  project: string;
}

/** The milestone an issue natively belongs to (used for swimlane mapping). */
export interface IssueMilestone {
  /** GitLab milestone id; GitHub milestone number (as string). */
  id: string;
  title: string;
  dueDate: string | null; // ISO yyyy-mm-dd
}

/** Normalised issue, identical shape across every provider. */
export interface ProjectIssue {
  /** Display number: GitLab iid / GitHub number (as string). */
  number: string;
  title: string;
  state: "open" | "closed";
  /** ISO yyyy-mm-dd; drives Past/Current/Future placement. */
  dueDate: string | null;
  milestone: IssueMilestone | null;
  url: string;
}

/**
 * One method-set per VCS. All implementations are loadable at once; which one a
 * source uses is chosen by config (and overridden to MockProvider when SIMULATE).
 */
export interface VcsProvider {
  id: ProviderId;
  /** List ALL issues for a project/repo (excludes PRs). */
  listProjectIssues(ref: ProjectRef): Promise<ProjectIssue[]>;
}
