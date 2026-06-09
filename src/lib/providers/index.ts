import { promises as fs } from "node:fs";
import path from "node:path";
import { z } from "zod";
import type { VcsProvider } from "./types";
import { GitlabProvider } from "./gitlab";
import { GithubProvider } from "./github";
import { loadMockProvider } from "./mock";

export type { VcsProvider, MilestoneLive, IssueLive, MilestoneRef } from "./types";

const providersConfigSchema = z.object({
  providers: z.record(
    z.string(),
    z.object({
      id: z.string(),
      apiBaseUrl: z.string().url(),
      tokenEnv: z.string(),
    })
  ),
});

export type BoardProviderId = "gitlab" | "github";

export function isSimulated(): boolean {
  // SIMULATE defaults to ON: only the explicit string "false" turns it off.
  return process.env.SIMULATE !== "false";
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

    const instance: VcsProvider =
      provider === "gitlab"
        ? new GitlabProvider(pc.apiBaseUrl, token)
        : new GithubProvider(pc.apiBaseUrl, token);
    cache.set(provider, instance);
    return instance;
  };
}
