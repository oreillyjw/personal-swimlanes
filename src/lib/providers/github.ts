import type { ProjectIssue, ProjectRef, VcsProvider } from "./types";

/**
 * GitHub REST adapter. Verified against the GitHub REST API (2022-11-28) docs:
 *  - Issues: GET /repos/{owner}/{repo}/issues?state=all&per_page=100&page=N
 *      fields: number, title, state ("open"|"closed"), html_url,
 *              pull_request? (marks PRs), milestone: { number, title, due_on } | null
 * GitHub issues have no due date of their own, so an issue's date is inherited
 * from its milestone's due_on. Pagination follows the Link rel="next" header.
 * Auth: fine-grained PAT via Authorization: Bearer.
 */

// ---- Raw API shapes (subset we consume) ----
export interface GithubMilestoneRaw {
  number: number;
  title: string;
  due_on: string | null; // ISO datetime, e.g. "2026-07-03T00:00:00Z"
  html_url?: string;
}

export interface GithubUserRaw {
  login: string;
}

export interface GithubIssueRaw {
  number: number;
  title: string;
  state: string; // "open" | "closed"
  html_url: string;
  pull_request?: unknown; // present => this "issue" is actually a PR
  milestone: GithubMilestoneRaw | null;
  assignees?: GithubUserRaw[];
  assignee?: GithubUserRaw | null; // legacy single field
}

// ---- Pure mappers (shared with MockProvider + unit tests) ----
export function mapGithubState(state: string): "open" | "closed" {
  return state === "closed" ? "closed" : "open";
}

export function mapGithubProjectIssues(raw: GithubIssueRaw[]): ProjectIssue[] {
  // The issues endpoint also returns PRs; exclude them.
  return raw
    .filter((i) => !i.pull_request)
    .map((i) => {
      const milestone = i.milestone
        ? {
            id: String(i.milestone.number),
            title: i.milestone.title,
            dueDate: i.milestone.due_on ? i.milestone.due_on.slice(0, 10) : null,
            url: i.milestone.html_url ?? null,
          }
        : null;
      const assignees = i.assignees?.length
        ? i.assignees.map((a) => a.login)
        : i.assignee
          ? [i.assignee.login]
          : [];
      return {
        number: String(i.number),
        title: i.title,
        state: mapGithubState(i.state),
        // GitHub issues have no due date; inherit the milestone's.
        dueDate: milestone?.dueDate ?? null,
        milestone,
        assignees,
        url: i.html_url,
      };
    });
}

/** Parse the next page number from a GitHub Link header, or null. */
export function nextPageFromLink(link: string | null): number | null {
  if (!link) return null;
  const match = link.split(",").find((p) => p.includes('rel="next"'));
  if (!match) return null;
  const url = match.match(/<([^>]+)>/)?.[1];
  if (!url) return null;
  const page = new URL(url).searchParams.get("page");
  return page ? Number(page) : null;
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

  async listProjectIssues(ref: ProjectRef): Promise<ProjectIssue[]> {
    const all: GithubIssueRaw[] = [];
    let page: number | null = 1;
    for (let guard = 0; guard < 100 && page; guard++) {
      const url = `${this.apiBaseUrl}/repos/${ref.project}/issues?state=all&per_page=100&page=${page}`;
      const res = await fetch(url, { headers: this.headers(), cache: "no-store" });
      if (!res.ok) throw new Error(`GitHub issues ${ref.project}: ${res.status} ${res.statusText}`);
      all.push(...((await res.json()) as GithubIssueRaw[]));
      page = nextPageFromLink(res.headers.get("link"));
    }
    return mapGithubProjectIssues(all);
  }
}
