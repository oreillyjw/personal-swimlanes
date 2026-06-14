import { promises as fs } from "node:fs";
import path from "node:path";
import { z } from "zod";
import type { VcsProvider } from "./types";
import { GitlabProvider } from "./gitlab";
import { GithubProvider } from "./github";
import { loadMockProvider } from "./mock";

export type { VcsProvider, ProjectIssue, ProjectRef, IssueMilestone } from "./types";

const providerConfigSchema = z.object({
  id: z.string(),
  /** Default API base URL (e.g. https://gitlab.com/api/v4). */
  apiBaseUrl: z.string().url(),
  /**
   * Optional env var that overrides apiBaseUrl at runtime — point at a
   * self-hosted GitLab or GitHub Enterprise instance without editing config.
   */
  apiBaseUrlEnv: z.string().optional(),
  tokenEnv: z.string(),
});
type ProviderConfig = z.infer<typeof providerConfigSchema>;

const providersConfigSchema = z.object({
  providers: z.record(z.string(), providerConfigSchema),
});

export type BoardProviderId = "gitlab" | "github";

export function isSimulated(): boolean {
  // SIMULATE defaults to ON: only the explicit string "false" turns it off.
  return process.env.SIMULATE !== "false";
}

/**
 * Resolve a provider's effective API base URL: the apiBaseUrlEnv override if set
 * and non-empty, otherwise the configured default. Trailing slashes are trimmed
 * so URL joins are predictable.
 */
export function resolveApiBaseUrl(
  pc: Pick<ProviderConfig, "apiBaseUrl" | "apiBaseUrlEnv">,
  env: Record<string, string | undefined> = process.env
): string {
  const override = pc.apiBaseUrlEnv ? env[pc.apiBaseUrlEnv]?.trim() : undefined;
  const url = override && override.length > 0 ? override : pc.apiBaseUrl;
  return url.replace(/\/+$/, "");
}

/**
 * Returns a resolver that maps a lane's configured provider id to a concrete
 * VcsProvider. In simulation mode every lane resolves to the single MockProvider
 * (it still dispatches to the correct fixture by the ref's provider).
 */
export async function getProviderResolver(): Promise<(provider: BoardProviderId) => VcsProvider> {
  if (isSimulated()) {
    const mock = await loadMockProvider();
    return () => mock;
  }

  const raw = await fs.readFile(path.join(process.cwd(), "config", "providers.json"), "utf8");
  const cfg = providersConfigSchema.parse(JSON.parse(raw));

  const cache = new Map<BoardProviderId, VcsProvider>();

  return (provider: BoardProviderId): VcsProvider => {
    const existing = cache.get(provider);
    if (existing) return existing;

    const pc = cfg.providers[provider];
    if (!pc) throw new Error(`No config entry for provider "${provider}" in config/providers.json`);
    const token = process.env[pc.tokenEnv];
    if (!token) {
      throw new Error(
        `Missing token: env ${pc.tokenEnv} is not set (required for live "${provider}" sync). ` +
          `Set it in .env.local, or run with SIMULATE=true.`
      );
    }

    const apiBaseUrl = resolveApiBaseUrl(pc);
    const instance: VcsProvider =
      provider === "gitlab"
        ? new GitlabProvider(apiBaseUrl, token)
        : new GithubProvider(apiBaseUrl, token);
    cache.set(provider, instance);
    return instance;
  };
}
