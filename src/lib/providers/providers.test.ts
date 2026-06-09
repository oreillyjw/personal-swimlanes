import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { mapGitlabMilestone, mapGitlabIssues, type GitlabMilestoneRaw, type GitlabIssueRaw } from "./gitlab";
import { mapGithubMilestone, mapGithubIssues, type GithubMilestoneRaw, type GithubIssueRaw } from "./github";
import { MockProvider, type GitlabFixture, type GithubFixture } from "./mock";

const root = process.cwd();
const gitlabFixture = JSON.parse(
  readFileSync(path.join(root, "fixtures/gitlab.sim.json"), "utf8")
) as GitlabFixture;
const githubFixture = JSON.parse(
  readFileSync(path.join(root, "fixtures/github.sim.json"), "utf8")
) as GithubFixture;

describe("gitlab mappers", () => {
  it("maps a milestone + issues to MilestoneLive, computing counts from issues", () => {
    const raw = gitlabFixture.projects["acme/infra"].milestones["12"] as GitlabMilestoneRaw;
    const issues = gitlabFixture.projects["acme/infra"].issues["12"] as GitlabIssueRaw[];
    const live = mapGitlabMilestone(raw, issues);
    expect(live.title).toBe("Discovery & Design");
    expect(live.dueDate).toBe("2026-06-27");
    expect(live.state).toBe("active");
    expect(live.issuesTotal).toBe(5);
    expect(live.issuesClosed).toBe(3);
    expect(live.url).toContain("gitlab.com");
  });

  it("normalises GitLab issue state (opened/closed)", () => {
    const issues = gitlabFixture.projects["acme/infra"].issues["12"] as GitlabIssueRaw[];
    const mapped = mapGitlabIssues(issues);
    expect(mapped).toHaveLength(5);
    expect(mapped.filter((i) => i.state === "closed")).toHaveLength(3);
  });
});

describe("github mappers", () => {
  it("maps a milestone using API-provided issue counts", () => {
    const raw = githubFixture.repos["acme/cicd"].milestones["10"] as GithubMilestoneRaw;
    const live = mapGithubMilestone(raw);
    expect(live.title).toBe("Runners & Pipeline Setup");
    expect(live.dueDate).toBe("2026-06-20"); // date portion of due_on
    expect(live.state).toBe("active"); // "open" -> "active"
    expect(live.issuesTotal).toBe(raw.open_issues + raw.closed_issues);
    expect(live.issuesClosed).toBe(raw.closed_issues);
    expect(live.url).toContain("github.com");
  });

  it("excludes pull requests from the issue list", () => {
    const withPr: GithubIssueRaw[] = [
      { title: "real issue", state: "open", html_url: "u1" },
      { title: "a PR", state: "open", html_url: "u2", pull_request: { url: "x" } },
    ];
    expect(mapGithubIssues(withPr)).toHaveLength(1);
    expect(mapGithubIssues(withPr)[0].title).toBe("real issue");
  });
});

describe("MockProvider routes by ref.provider", () => {
  const mock = new MockProvider(gitlabFixture, githubFixture);

  it("resolves a gitlab ref against the gitlab fixture", async () => {
    const live = await mock.getMilestone({ provider: "gitlab", project: "acme/data-pipeline", id: "30" });
    expect(live.title).toBe("Inventory & Gap Analysis");
    expect(live.issuesTotal).toBe(4);
    expect(live.issuesClosed).toBe(2);
  });

  it("resolves a github ref against the github fixture", async () => {
    const live = await mock.getMilestone({ provider: "github", project: "acme/platform", id: "1" });
    expect(live.title).toBe("Requirements & Data Mapping");
    expect(live.issuesClosed).toBe(2);
    const issues = await mock.listIssues({ provider: "github", project: "acme/platform", id: "1" });
    expect(issues.length).toBeGreaterThan(0);
  });

  it("throws a clear error for an unknown ref", async () => {
    await expect(
      mock.getMilestone({ provider: "gitlab", project: "acme/infra", id: "999" })
    ).rejects.toThrow(/no fixture/);
  });
});
