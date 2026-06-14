# swimlanes

A **local-first swim-lane issue board**. Each project is a horizontal swimlane
(row); every **issue** is a tile sitting in one of three time columns —
**Past / Current / Future**. It is a **read-only mirror** of issues and
milestones that already live in **GitLab and GitHub** — the VCS is the source of
truth, not this app.

- **Issues as tiles, grouped by project.** Closed work parks in **Past**, in-flight
  work in **Current**, upcoming work in **Future** — with the date always shown.
- **Milestone → swimlane mapping.** You assign milestones to swimlanes locally;
  each issue inherits its native milestone's lane. Anything not assigned to a
  mapped milestone (or with no milestone at all) lands in a **Catch-all** lane.
- **Provider-agnostic.** Different swimlanes can map milestones from different
  providers; GitLab and GitHub sit on the same board. Only features common to both
  (native **Milestones** + **Issues**) are used — no paid tiers, no Epics.
- **Local-only hide/pin.** Pin important issues to the top of a column or hide
  noise — stored locally in `board.json`, never written back to the VCS.
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

Open <http://localhost:3000>. Click **Sync now** — in simulation mode this pulls
every issue for the configured sources from the committed fixtures (exercising a
GitLab and a GitHub source), sorts them into swimlanes and Past/Current/Future
columns, fully offline.

> `SIMULATE=true` is the default in `.env.example`. A fresh clone works end-to-end
> with **no tokens** and **no network**.

## The view

- **Three columns** — **Past** (closed issues), **Current** (open issues that are
  overdue or due within the current window), **Future** (open issues due later).
  The current window is `currentWindowWeeks` (default 2: this + next week).
- **Swimlanes** — one row per project, colored, plus a **Catch-all** row for
  issues whose milestone isn't mapped (or that have no milestone).
- **Issue tiles** — title, **date** (always shown), issue number, milestone label,
  and an ⚠ overdue flag. Click the title to open the issue in the VCS. The ⋯ menu
  **pins** (★, sorts to the top) or **hides** an issue locally.
- Per-swimlane show/hide toggles and a **Show hidden** toggle.

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
3. In `data/board.json`, list the repos to pull from under `sources` and assign
   real milestones to swimlanes under `swimlanes[].milestones` (`project` =
   `group/project` for GitLab or `owner/repo` for GitHub; `id` = the milestone
   id / number). See the shape below.
4. `npm run dev`, then **Sync now**. No code changes — only `SIMULATE` and the board.

All VCS calls happen **server-side**, so tokens never reach the browser.

### Self-hosted GitLab / GitHub Enterprise

The API base URLs default to `gitlab.com` and `api.github.com`. To point at a
self-hosted instance, set the override env var in `.env.local` (no config edit
needed) — note the API path suffix:

```bash
GITLAB_API_URL=https://gitlab.example.com/api/v4   # self-hosted GitLab
GITHUB_API_URL=https://github.example.com/api/v3   # GitHub Enterprise Server
```

Deep links use each issue's own `web_url` / `html_url` from the API, so they
resolve back to the right instance automatically.

## Data model

State lives in separate files so a re-sync never clobbers hand-authored config:

| File | Purpose | Committed? |
| --- | --- | --- |
| `data/board.example.json` | Fictional sample board (sources, swimlanes, milestone map) | ✅ |
| `data/board.json` | Your working board config + local hide/pin | ❌ gitignored |
| `data/synced.json` | Disposable cache written by **Sync now** (per-source issue lists) | ❌ gitignored |
| `config/providers.json` | Non-secret provider config (API base URLs) | ✅ |
| `fixtures/gitlab.sim.json`, `fixtures/github.sim.json` | Fictional simulated issue lists, shaped like the real APIs | ✅ |
| `fixtures/*.local.json` | Optional private fixture overlay for simulating your own board offline | ❌ gitignored |
| `.env.local` | Tokens + `SIMULATE` | ❌ gitignored |

`board.json` shape:

```jsonc
{
  "board": { "name": "My Roadmap", "currentWindowWeeks": 2 },
  "sources": [                       // repos to pull ALL issues from
    { "provider": "github", "project": "owner/repo" },
    { "provider": "gitlab", "project": "group/project" }
  ],
  "swimlanes": [                     // milestone refs assigned to each lane
    { "id": "ai", "title": "AI Engine", "color": "#6A1B9A",
      "milestones": [ { "provider": "github", "project": "owner/repo", "id": "6" } ] }
  ],
  "issueState": {                    // local-only hide/pin, key "provider:project:number"
    "github:owner/repo:412": { "hidden": true, "pinned": false }
  }
}
```

At render time the app pulls each issue from `synced.json`, places it in the
swimlane of its native milestone (else **Catch-all**), and into a Past/Current/
Future column. Local `issueState` applies hide/pin. Works with zero sync (empty
board) and fills in once you **Sync now**.

### Keep your real board private

Everything committed to this repo is **fictional** — the sample board and the
`*.sim.json` fixtures. Your real board lives only in gitignored files that are
never pushed:

- Put your real sources/swimlanes in `data/board.json` (gitignored).
- To **simulate** a private board offline (e.g. with real repo names, before
  wiring tokens), drop `fixtures/gitlab.local.json` and/or
  `fixtures/github.local.json` (same shape as the `*.sim.json` files — a flat
  issue list per repo). The
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
src/lib/bucket.ts    Past / Current / Future placement rule
src/lib/viewModel.ts place synced issues into swimlanes + columns -> render model
src/lib/sync.ts      "Sync now" orchestration (server-side)
src/components/       KanbanBoard, IssueTile, BoardClient
src/app/api/sync/         POST route handler (server-only token use)
src/app/api/issue-state/  POST route handler (local-only hide/pin)
```

The provider abstraction maps **only** to native Issues (each carrying its
milestone):

```ts
interface VcsProvider {
  id: "gitlab" | "github" | "mock";
  listProjectIssues(ref: ProjectRef): Promise<ProjectIssue[]>;
}
```

`MockProvider` implements the same interface from the fixtures; `SIMULATE=true`
routes every source through it regardless of configured provider. The fixtures are
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
