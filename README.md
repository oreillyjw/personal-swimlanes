# swimlanes

A **local-first weekly swim-lane project tracker**. Each project is a horizontal
lane; milestones sit on a shared Monday-start weekly grid. It is a **read-only
mirror** of milestones and issues that already live in **GitLab and GitHub** —
the VCS is the source of truth, not this app.

- **One timeline across many projects** to schedule work and spot cross-project collisions.
- **Provider-agnostic.** Different lanes can use different providers; GitLab and
  GitHub lanes sit on the same board. Only features common to both (native
  **Milestones** + **Issues**) are used — no paid tiers, no Epics, no Projects v2.
- **Runs 100% locally.** No cloud backend, no database, no deploy platform. State
  is plain JSON files on disk. The only outbound calls are read-only requests to
  the GitLab/GitHub APIs during a live sync — and in the default **simulation
  mode** there are none at all.

## Quick start (simulated, no tokens)

```bash
cp .env.example .env.local
cp data/board.example.json data/board.json
npm install
npm run dev
```

Open <http://localhost:3000>. The board renders from local JSON immediately. Click
**Sync now** — in simulation mode this fills in due dates and closed/total issue
progress for every card from the committed fixtures, exercising both a
GitLab-sourced and a GitHub-sourced lane, fully offline.

> `SIMULATE=true` is the default in `.env.example`. A fresh clone works end-to-end
> with **no tokens** and **no network**.

## The view

- **Weekly ruler** (`W1 / Jun 8`, `W2 / Jun 15`, …) with a configurable start week
  and horizon, dotted week gridlines, and a red **Today** marker.
- **Lanes** — one per project, with a colored header and its launch/target date.
- **Milestone cards** snapped to the week of their target date, showing title,
  date, status, and a **closed/total issue progress** bar. Click a card for full
  detail, the **issue list with states**, and a **deep link** to the underlying
  VCS milestone. Cards connect left→right by sequence arrows; the lane's final
  milestone is a bold **launch** marker.
- **Cross-lane dependency arrows** (e.g. an enabler lane must finish before a
  dependent lane's milestone).
- Zoom, scroll, click-to-detail, and per-lane show/hide toggles.

## Going live (real GitLab / GitHub)

1. Create read-only tokens:
   - **GitLab** — Personal Access Token, scope `read_api`.
   - **GitHub** — fine-grained PAT with read access to Issues + Metadata.
2. Put them in `.env.local` (never committed):
   ```bash
   SIMULATE=false
   GITLAB_TOKEN=glpat-…
   GITHUB_TOKEN=github_pat_…
   ```
3. Point each lane's milestones at real milestones via their `sourceRef` in
   `data/board.json` (`project` = `group/project` for GitLab or `owner/repo` for
   GitHub; `id` = the milestone id / number).
4. `npm run dev`, then **Sync now**. No code changes — only `SIMULATE` and the refs.

All VCS calls happen **server-side**, so tokens never reach the browser.

### Self-hosted GitLab / GitHub Enterprise

The API base URLs default to `gitlab.com` and `api.github.com`. To point at a
self-hosted instance, set the override env var in `.env.local` (no config edit
needed) — note the API path suffix:

```bash
GITLAB_API_URL=https://gitlab.example.com/api/v4   # self-hosted GitLab
GITHUB_API_URL=https://github.example.com/api/v3   # GitHub Enterprise Server
```

Deep links use each milestone's own `web_url` / `html_url` from the API, so they
resolve back to the right instance automatically.

## Data model

Two kinds of state in separate files so a re-sync never clobbers hand-authored config:

| File | Purpose | Committed? |
| --- | --- | --- |
| `data/board.example.json` | Fictional sample board (lanes, milestones, deps, provider mapping) | ✅ |
| `data/board.json` | Your working board config | ❌ gitignored |
| `data/synced.json` | Disposable cache written by **Sync now** (live milestone + issue values) | ❌ gitignored |
| `config/providers.json` | Non-secret provider config (API base URLs) | ✅ |
| `fixtures/gitlab.sim.json`, `fixtures/github.sim.json` | Fictional simulated milestones + issues, shaped like the real APIs | ✅ |
| `fixtures/*.local.json` | Optional private fixture overlay for simulating your own board offline | ❌ gitignored |
| `.env.local` | Tokens + `SIMULATE` | ❌ gitignored |

At render time the app **merges** `synced.json` over `board.json`: live values win
where a `sourceRef` resolves, hand-authored values are the fallback. Works with
zero sync (pure local planning) and accurate with live progress once mapped.

### Keep your real board private

Everything committed to this repo is **fictional** — the sample board and the
`*.sim.json` fixtures. Your real board lives only in gitignored files that are
never pushed:

- Put your real lanes/milestones in `data/board.json` (gitignored).
- To **simulate** a private board offline (e.g. with real repo names, before
  wiring tokens), drop `fixtures/gitlab.local.json` and/or
  `fixtures/github.local.json` (same shape as the `*.sim.json` files). The
  `MockProvider` overlays them on top of the committed fictional fixtures —
  entries in the overlay win — so **Sync now** fills in your board with no
  network and nothing leaves your machine. Going live (`SIMULATE=false`) needs
  no fixtures at all.

Files are validated with `zod` on load and fail loudly. All disk access is behind
a small `Store` interface (`JsonFileStore`) — swap storage later by adding one
class, with no UI or provider changes.

## Architecture

```
src/lib/providers/   VcsProvider interface + gitlab / github / mock adapters
src/lib/store.ts     Store interface + JsonFileStore (atomic temp-file + rename writes)
src/lib/viewModel.ts merge board.json + synced.json -> render model
src/lib/layout.ts    week/column geometry for cards + arrows
src/lib/sync.ts      "Sync now" orchestration (server-side)
src/components/       Timeline, MilestoneCard, MilestoneDetail, BoardClient
src/app/api/sync/     POST route handler (server-only token use)
```

The provider abstraction maps **only** to native Milestones and Issues:

```ts
interface VcsProvider {
  id: "gitlab" | "github" | "mock";
  getMilestone(ref: MilestoneRef): Promise<MilestoneLive>;
  listIssues(ref: MilestoneRef): Promise<{ title: string; state: string; url: string }[]>;
}
```

`MockProvider` implements the same interface from the fixtures; `SIMULATE=true`
routes every lane through it regardless of configured provider. The fixtures are
shaped like the real API responses, so the same pure mappers run against fixtures
and live data — and the real adapters are unit-tested against them.

## Scripts

```bash
npm run dev        # local dev server
npm run build      # production build
npm run start      # serve the production build
npm run typecheck  # tsc --noEmit
npm test           # vitest
```

## Docker (optional)

```bash
docker build -t swimlanes .
docker run -p 3000:3000 \
  -v "$(pwd)/data:/app/data" \
  -v "$(pwd)/fixtures:/app/fixtures" \
  -e SIMULATE=true \
  swimlanes
```

Plain `npm install && npm run dev` on localhost works with zero extra services —
Docker is just a convenience.

## License

MIT — see [LICENSE](LICENSE).
