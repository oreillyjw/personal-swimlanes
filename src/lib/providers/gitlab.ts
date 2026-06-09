import type { IssueLive, MilestoneLive, MilestoneRef, VcsProvider } from "./types";

/**
 * GitLab REST adapter. Verified against the GitLab REST API v4 docs:
 *  - Milestones:  GET /projects/:id/milestones/:milestone_id
 *      fields: title, description, due_date, state ("active"|"closed"), web_url
 *  - Issues:      GET /projects/:id/milestones/:milestone_id/issues
 *      fields: title, state ("opened"|"closed"), web_url
 * GitLab milestone objects do NOT carry issue counts, so progress is computed
 * from the milestone's issue list.
 * Auth: Personal Access Token (scope read_api) via the PRIVATE-TOKEN header.
 */

// ---- Raw API shapes (subset we consume) ----
export interface GitlabMilestoneRaw {
  id: number;
  iid?: number;
  title: string;
  description?: string | null;
  due_date: string | null; // "yyyy-mm-dd"
  state: string; // "active" | "closed"
  web_url: string;
}

export interface GitlabIssueRaw {
  title: string;
  state: string; // "opened" | "closed"
  web_url: string;
}

// ---- Pure mappers (shared with MockProvider + unit tests) ----
export function mapGitlabState(state: string): "active" | "closed" {
  return state === "closed" ? "closed" : "active";
}

export function mapGitlabIssues(raw: GitlabIssueRaw[]): IssueLive[] {
  return raw.map((i) => ({ title: i.title, state: i.state, url: i.web_url }));
}

export function mapGitlabMilestone(raw: GitlabMilestoneRaw, issues: GitlabIssueRaw[]): MilestoneLive {
  const issuesTotal = issues.length;
  const issuesClosed = issues.filter((i) => i.state === "closed").length;
  return {
    title: raw.title,
    dueDate: raw.due_date ?? null,
    state: mapGitlabState(raw.state),
    issuesTotal,
    issuesClosed,
    url: raw.web_url,
  };
}

export class GitlabProvider implements VcsProvider {
  readonly id = "gitlab" as const;

  constructor(
    private readonly apiBaseUrl: string,
    private readonly token: string
  ) {}

  private headers() {
    return { "PRIVATE-TOKEN": this.token, Accept: "application/json" };
  }

  private projectPath(project: string): string {
    // GitLab accepts a URL-encoded "group/project" path in place of a numeric id.
    return encodeURIComponent(project);
  }

  private async fetchMilestoneRaw(ref: MilestoneRef): Promise<GitlabMilestoneRaw> {
    const url = `${this.apiBaseUrl}/projects/${this.projectPath(ref.project)}/milestones/${ref.id}`;
    const res = await fetch(url, { headers: this.headers(), cache: "no-store" });
    if (!res.ok) throw new Error(`GitLab milestone ${ref.project}#${ref.id}: ${res.status} ${res.statusText}`);
    return (await res.json()) as GitlabMilestoneRaw;
  }

  private async fetchIssuesRaw(ref: MilestoneRef): Promise<GitlabIssueRaw[]> {
    const url = `${this.apiBaseUrl}/projects/${this.projectPath(ref.project)}/milestones/${ref.id}/issues?per_page=100`;
    const res = await fetch(url, { headers: this.headers(), cache: "no-store" });
    if (!res.ok) throw new Error(`GitLab issues ${ref.project}#${ref.id}: ${res.status} ${res.statusText}`);
    return (await res.json()) as GitlabIssueRaw[];
  }

  async getMilestone(ref: MilestoneRef): Promise<MilestoneLive> {
    const [raw, issues] = await Promise.all([this.fetchMilestoneRaw(ref), this.fetchIssuesRaw(ref)]);
    return mapGitlabMilestone(raw, issues);
  }

  async listIssues(ref: MilestoneRef): Promise<IssueLive[]> {
    return mapGitlabIssues(await this.fetchIssuesRaw(ref));
  }
}
