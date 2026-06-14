import { promises as fs } from "node:fs";
import path from "node:path";
import type { ProjectIssue, ProjectRef, VcsProvider } from "./types";
import { mapGitlabProjectIssues, type GitlabIssueRaw } from "./gitlab";
import { mapGithubProjectIssues, type GithubIssueRaw } from "./github";

/**
 * Fixture file shapes — deliberately mirror the real API list responses so the
 * same pure mappers (the mapGitlab / mapGithub functions) run against fixtures
 * and live data alike. Each project/repo holds the FULL flat issue list,
 * including issues whose milestone is unmapped or absent (→ Catch-all).
 */
export interface GitlabFixture {
  projects: Record<string, { issues: GitlabIssueRaw[] }>;
}

export interface GithubFixture {
  repos: Record<string, { issues: GithubIssueRaw[] }>;
}

/**
 * MockProvider resolves any source against committed fixtures. It dispatches on
 * the ref's provider so a gitlab source reads gitlab.sim.json and a github
 * source reads github.sim.json — exercising both real mappers fully offline.
 * SIMULATE=true routes every source here regardless of configured provider.
 */
export class MockProvider implements VcsProvider {
  readonly id = "mock" as const;

  constructor(
    private readonly gitlab: GitlabFixture,
    private readonly github: GithubFixture
  ) {}

  async listProjectIssues(ref: ProjectRef): Promise<ProjectIssue[]> {
    if (ref.provider === "github") {
      const repo = this.github.repos[ref.project];
      if (!repo) throw new Error(`Mock(github): no fixture for ${ref.project}`);
      return mapGithubProjectIssues(repo.issues);
    }
    const project = this.gitlab.projects[ref.project];
    if (!project) throw new Error(`Mock(gitlab): no fixture for ${ref.project}`);
    return mapGitlabProjectIssues(project.issues);
  }
}

const FIXTURES_DIR = path.join(process.cwd(), "fixtures");

async function readJsonIfExists<T>(file: string): Promise<T | null> {
  try {
    return JSON.parse(await fs.readFile(file, "utf8")) as T;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
}

/**
 * Load committed fictional fixtures, then overlay an optional gitignored
 * `*.local.json` of the same shape if present (project/repo entries in the
 * overlay win). This lets a private board (e.g. real repo names) be simulated
 * offline without ever committing it — the public repo only ships the fictional
 * fixtures.
 */
export async function loadMockProvider(): Promise<MockProvider> {
  const [gitlabBase, githubBase, gitlabLocal, githubLocal] = await Promise.all([
    fs.readFile(path.join(FIXTURES_DIR, "gitlab.sim.json"), "utf8").then((s) => JSON.parse(s) as GitlabFixture),
    fs.readFile(path.join(FIXTURES_DIR, "github.sim.json"), "utf8").then((s) => JSON.parse(s) as GithubFixture),
    readJsonIfExists<GitlabFixture>(path.join(FIXTURES_DIR, "gitlab.local.json")),
    readJsonIfExists<GithubFixture>(path.join(FIXTURES_DIR, "github.local.json")),
  ]);

  const gitlab: GitlabFixture = gitlabLocal
    ? { projects: { ...gitlabBase.projects, ...gitlabLocal.projects } }
    : gitlabBase;
  const github: GithubFixture = githubLocal
    ? { repos: { ...githubBase.repos, ...githubLocal.repos } }
    : githubBase;

  return new MockProvider(gitlab, github);
}
