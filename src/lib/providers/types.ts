import type { MilestoneRef, ProviderId } from "../types";

export type { MilestoneRef };

/** Normalised live milestone, identical shape across every provider. */
export interface MilestoneLive {
  title: string;
  dueDate: string | null; // ISO; drives week placement
  state: "active" | "closed"; // drives status
  issuesTotal: number;
  issuesClosed: number; // progress = closed / total
  url: string; // deep link back to the milestone
}

export interface IssueLive {
  title: string;
  state: string;
  url: string;
}

/**
 * One method-set per VCS. All implementations are loadable at once; which one a
 * lane uses is chosen by config (and overridden to MockProvider when SIMULATE).
 */
export interface VcsProvider {
  id: ProviderId;
  getMilestone(ref: MilestoneRef): Promise<MilestoneLive>;
  listIssues(ref: MilestoneRef): Promise<IssueLive[]>;
}
