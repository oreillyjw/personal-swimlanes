import type { IssueLive, MilestoneLive, MilestoneRef, VcsProvider } from "./types";

/**
 * GitHub REST adapter. Verified against the GitHub REST API (2022-11-28) docs:
 *  - Milestone: GET /repos/{owner}/{repo}/milestones/{milestone_number}
 *      fields: title, description, due_on (ISO datetime), state ("open"|"closed"),
 *              open_issues, closed_issues, html_url
 *  - Issues:    GET /repos/{owner}/{repo}/issues?milestone={number}&state=all
 *      fields: title, state ("open"|"closed"), html_url, pull_request? (marks PRs)
 * Progress comes straight from the milestone's open_issues/closed_issues.
 * Auth: fine-grained PAT via Authorization: Bearer.
 */

// ---- Raw API shapes (subset we consume) ----
export interface GithubMilestoneRaw {
  number: number;
  title: string;
  description?: string | null;
  due_on: string | null; // ISO datetime, e.g. "2026-07-03T00:00:00Z"
  state: string; // "open" | "closed"
  open_issues: number;
  closed_issues: number;
  html_url: string;
}

export interface GithubIssueRaw {
  title: string;
  state: string; // "open" | "closed"
  html_url: string;
  pull_request?: unknown; // present => this "issue" is actually a PR
}

// ---- Pure mappers (shared with MockProvider + unit tests) ----
export function mapGithubState(state: string): "active" | "closed" {
  return state === "closed" ? "closed" : "active";
}

export function mapGithubMilestone(raw: GithubMilestoneRaw): MilestoneLive {
  return {
    title: raw.title,
    dueDate: raw.due_on ? raw.due_on.slice(0, 10) : null,
    state: mapGithubState(raw.state),
    issuesTotal: raw.open_issues + raw.closed_issues,
    issuesClosed: raw.closed_issues,
    url: raw.html_url,
  };
}

export function mapGithubIssues(raw: GithubIssueRaw[]): IssueLive[] {
  // The issues endpoint also returns PRs; exclude them from the issue list.
  return raw
    .filter((i) => !i.pull_request)
    .map((i) => ({ title: i.title, state: i.state, url: i.html_url }));
}

export class GithubProvider implements VcsProvider {
  readonly id = "github" as const;

  constructor(
    private readonly apiBaseUrl: string,
    private readonly token: string
  ) {}

  private headers() {
    return {
      Authorization: `Bearer ${this.token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    };
  }

  async getMilestone(ref: MilestoneRef): Promise<MilestoneLive> {
    const url = `${this.apiBaseUrl}/repos/${ref.project}/milestones/${ref.id}`;
    const res = await fetch(url, { headers: this.headers(), cache: "no-store" });
    if (!res.ok) throw new Error(`GitHub milestone ${ref.project}#${ref.id}: ${res.status} ${res.statusText}`);
    return mapGithubMilestone((await res.json()) as GithubMilestoneRaw);
  }

  async listIssues(ref: MilestoneRef): Promise<IssueLive[]> {
    const url = `${this.apiBaseUrl}/repos/${ref.project}/issues?milestone=${ref.id}&state=all&per_page=100`;
    const res = await fetch(url, { headers: this.headers(), cache: "no-store" });
    if (!res.ok) throw new Error(`GitHub issues ${ref.project}#${ref.id}: ${res.status} ${res.statusText}`);
    return mapGithubIssues((await res.json()) as GithubIssueRaw[]);
  }
}
