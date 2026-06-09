import { promises as fs } from "node:fs";
import path from "node:path";
import type { IssueLive, MilestoneLive, MilestoneRef, VcsProvider } from "./types";
import {
  mapGitlabIssues,
  mapGitlabMilestone,
  type GitlabIssueRaw,
  type GitlabMilestoneRaw,
} from "./gitlab";
import {
  mapGithubIssues,
  mapGithubMilestone,
  type GithubIssueRaw,
  type GithubMilestoneRaw,
} from "./github";

/**
 * Fixture file shapes — deliberately mirror the real API JSON so the same
 * pure mappers (the mapGitlab / mapGithub functions) run against fixtures and
 * live data alike.
 */
export interface GitlabFixture {
  projects: Record<
    string,
    {
      milestones: Record<string, GitlabMilestoneRaw>;
      issues: Record<string, GitlabIssueRaw[]>;
    }
  >;
}

export interface GithubFixture {
  repos: Record<
    string,
    {
      milestones: Record<string, GithubMilestoneRaw>;
      issues: Record<string, GithubIssueRaw[]>;
    }
  >;
}

/**
 * MockProvider resolves any ref against committed fixtures. It dispatches on the
 * ref's ORIGINAL provider so a gitlab-sourced lane reads gitlab.sim.json and a
 * github-sourced lane reads github.sim.json — exercising both real mappers fully
 * offline. SIMULATE=true routes every lane here regardless of configured provider.
 */
export class MockProvider implements VcsProvider {
  readonly id = "mock" as const;

  constructor(
    private readonly gitlab: GitlabFixture,
    private readonly github: GithubFixture
  ) {}

  private gitlabEntry(ref: MilestoneRef) {
    const project = this.gitlab.projects[ref.project];
    const milestone = project?.milestones[ref.id];
    const issues = project?.issues[ref.id] ?? [];
    if (!milestone) throw new Error(`Mock(gitlab): no fixture for ${ref.project}#${ref.id}`);
    return { milestone, issues };
  }

  private githubEntry(ref: MilestoneRef) {
    const repo = this.github.repos[ref.project];
    const milestone = repo?.milestones[ref.id];
    const issues = repo?.issues[ref.id] ?? [];
    if (!milestone) throw new Error(`Mock(github): no fixture for ${ref.project}#${ref.id}`);
    return { milestone, issues };
  }

  async getMilestone(ref: MilestoneRef): Promise<MilestoneLive> {
    if (ref.provider === "github") {
      const { milestone } = this.githubEntry(ref);
      return mapGithubMilestone(milestone);
    }
    // gitlab (and any non-github ref) resolves against the gitlab fixture
    const { milestone, issues } = this.gitlabEntry(ref);
    return mapGitlabMilestone(milestone, issues);
  }

  async listIssues(ref: MilestoneRef): Promise<IssueLive[]> {
    if (ref.provider === "github") {
      return mapGithubIssues(this.githubEntry(ref).issues);
    }
    return mapGitlabIssues(this.gitlabEntry(ref).issues);
  }
}

const FIXTURES_DIR = path.join(process.cwd(), "fixtures");

export async function loadMockProvider(): Promise<MockProvider> {
  const [gitlabRaw, githubRaw] = await Promise.all([
    fs.readFile(path.join(FIXTURES_DIR, "gitlab.sim.json"), "utf8"),
    fs.readFile(path.join(FIXTURES_DIR, "github.sim.json"), "utf8"),
  ]);
  return new MockProvider(JSON.parse(gitlabRaw) as GitlabFixture, JSON.parse(githubRaw) as GithubFixture);
}
