import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { mapGitlabProjectIssues } from "./gitlab";
import { mapGithubProjectIssues, nextPageFromLink } from "./github";
import { MockProvider, type GitlabFixture, type GithubFixture } from "./mock";
import { resolveApiBaseUrl } from "./index";

const root = process.cwd();
const gitlabFixture = JSON.parse(
  readFileSync(path.join(root, "fixtures/gitlab.sim.json"), "utf8")
) as GitlabFixture;
const githubFixture = JSON.parse(
  readFileSync(path.join(root, "fixtures/github.sim.json"), "utf8")
) as GithubFixture;

describe("gitlab project-issue mapper", () => {
  const issues = mapGitlabProjectIssues(gitlabFixture.projects["acme/infra"].issues);

  it("normalises state opened->open / closed", () => {
    expect(issues.find((i) => i.number === "101")!.state).toBe("closed");
    expect(issues.find((i) => i.number === "103")!.state).toBe("open");
  });

  it("keeps the issue's own due date when present", () => {
    expect(issues.find((i) => i.number === "103")!.dueDate).toBe("2026-06-10");
  });

  it("inherits the milestone due date when the issue has none", () => {
    expect(issues.find((i) => i.number === "106")!.dueDate).toBe("2026-07-18");
  });

  it("carries the native milestone (id as string) and null when absent", () => {
    expect(issues.find((i) => i.number === "103")!.milestone).toEqual({
      id: "12",
      title: "Discovery & Design",
      dueDate: "2026-06-12",
    });
    expect(issues.find((i) => i.number === "108")!.milestone).toBeNull();
  });
});

describe("github project-issue mapper", () => {
  const issues = mapGithubProjectIssues(githubFixture.repos["acme/platform"].issues);

  it("excludes pull requests", () => {
    expect(issues.some((i) => i.number === "208")).toBe(false);
    expect(issues.some((i) => i.title.includes("PR"))).toBe(false);
  });

  it("inherits the milestone due_on as the issue date (date portion)", () => {
    expect(issues.find((i) => i.number === "202")!.dueDate).toBe("2026-06-12");
    expect(issues.find((i) => i.number === "204")!.dueDate).toBe("2026-08-07");
  });

  it("has no date when there is no milestone", () => {
    const i = issues.find((i) => i.number === "207")!;
    expect(i.dueDate).toBeNull();
    expect(i.milestone).toBeNull();
  });
});

describe("nextPageFromLink", () => {
  it("extracts the next page number from a Link header", () => {
    const link =
      '<https://api.github.com/repos/o/r/issues?page=2>; rel="next", <https://api.github.com/repos/o/r/issues?page=5>; rel="last"';
    expect(nextPageFromLink(link)).toBe(2);
  });
  it("returns null when there is no next page", () => {
    expect(nextPageFromLink('<https://api.github.com/...?page=5>; rel="last"')).toBeNull();
    expect(nextPageFromLink(null)).toBeNull();
  });
});

describe("resolveApiBaseUrl (alternative / self-hosted instances)", () => {
  const gitlab = { apiBaseUrl: "https://gitlab.com/api/v4", apiBaseUrlEnv: "GITLAB_API_URL" };

  it("uses the configured default when no override env is set", () => {
    expect(resolveApiBaseUrl(gitlab, {})).toBe("https://gitlab.com/api/v4");
  });
  it("uses the env override for a self-hosted instance", () => {
    expect(resolveApiBaseUrl(gitlab, { GITLAB_API_URL: "https://gitlab.example.com/api/v4" })).toBe(
      "https://gitlab.example.com/api/v4"
    );
  });
  it("trims trailing slashes and ignores blank overrides", () => {
    expect(resolveApiBaseUrl(gitlab, { GITLAB_API_URL: "https://gl.example.com/api/v4/" })).toBe(
      "https://gl.example.com/api/v4"
    );
    expect(resolveApiBaseUrl(gitlab, { GITLAB_API_URL: "  " })).toBe("https://gitlab.com/api/v4");
  });
});

describe("MockProvider routes by source provider", () => {
  const mock = new MockProvider(gitlabFixture, githubFixture);

  it("lists gitlab project issues from the gitlab fixture", async () => {
    const issues = await mock.listProjectIssues({ provider: "gitlab", project: "acme/infra" });
    expect(issues.length).toBeGreaterThan(0);
    expect(issues.find((i) => i.number === "101")!.title).toBe("Define cutover success criteria");
  });

  it("lists github repo issues (PRs excluded) from the github fixture", async () => {
    const issues = await mock.listProjectIssues({ provider: "github", project: "acme/platform" });
    expect(issues.every((i) => i.number !== "208")).toBe(true);
  });

  it("throws a clear error for an unknown source", async () => {
    await expect(
      mock.listProjectIssues({ provider: "gitlab", project: "acme/missing" })
    ).rejects.toThrow(/no fixture/);
  });
});
