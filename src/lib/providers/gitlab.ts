import type { ProjectIssue, ProjectRef, VcsProvider } from "./types";

/**
 * GitLab REST adapter. Verified against the GitLab REST API v4 docs:
 *  - Issues: GET /projects/:id/issues?per_page=100&page=N
 *      fields: iid, title, state ("opened"|"closed"), due_date, web_url,
 *              milestone: { id, iid, title, due_date } | null
 * Each issue carries its own due_date (may be null) and its milestone (may be
 * null). When the issue has no due_date we fall back to the milestone's.
 * Auth: Personal Access Token (scope read_api) via the PRIVATE-TOKEN header.
 */

// ---- Raw API shapes (subset we consume) ----
export interface GitlabMilestoneRaw {
  id: number;
  iid?: number;
  title: string;
  due_date: string | null; // "yyyy-mm-dd"
}

export interface GitlabIssueRaw {
  iid: number;
  title: string;
  state: string; // "opened" | "closed"
  due_date: string | null; // "yyyy-mm-dd" | null
  web_url: string;
  milestone: GitlabMilestoneRaw | null;
}

// ---- Pure mappers (shared with MockProvider + unit tests) ----
export function mapGitlabState(state: string): "open" | "closed" {
  return state === "closed" ? "closed" : "open";
}

export function mapGitlabProjectIssues(raw: GitlabIssueRaw[]): ProjectIssue[] {
  return raw.map((i) => {
    const milestone = i.milestone
      ? { id: String(i.milestone.id), title: i.milestone.title, dueDate: i.milestone.due_date ?? null }
      : null;
    return {
      number: String(i.iid),
      title: i.title,
      state: mapGitlabState(i.state),
      // Issue due date wins; otherwise inherit the milestone's.
      dueDate: i.due_date ?? milestone?.dueDate ?? null,
      milestone,
      url: i.web_url,
    };
  });
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

  async listProjectIssues(ref: ProjectRef): Promise<ProjectIssue[]> {
    const enc = encodeURIComponent(ref.project);
    const all: GitlabIssueRaw[] = [];
    // Paginate via the x-next-page header until exhausted (cap for safety).
    let page = 1;
    for (let guard = 0; guard < 100; guard++) {
      const url = `${this.apiBaseUrl}/projects/${enc}/issues?per_page=100&page=${page}`;
      const res = await fetch(url, { headers: this.headers(), cache: "no-store" });
      if (!res.ok) throw new Error(`GitLab issues ${ref.project}: ${res.status} ${res.statusText}`);
      all.push(...((await res.json()) as GitlabIssueRaw[]));
      const next = res.headers.get("x-next-page");
      if (!next) break;
      page = Number(next);
    }
    return mapGitlabProjectIssues(all);
  }
}
