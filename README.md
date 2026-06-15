# swimlanes

A **local-first roadmap planner**. Plan work across several projects on one
**timeline**: each project is a swimlane, milestones and key issues are placed on
a Monday-start week grid, and **dependency arrows** show what blocks what. Live
status (issue progress, open/closed) is pulled read-only from **GitLab and
GitHub**; the **plan itself** (target dates, what's on the timeline, dependencies)
lives locally — because the VCS can't hold a planned date for an unassigned issue
or a cross-repo dependency.

- **One timeline across 4+ projects** to sequence work and spot collisions.
- **Plan at milestone *and* issue level.** Place a milestone or an individual
  issue (assigned or not) on a target date; link dependencies between any two.
- **Dependency arrows with slip detection.** If a prerequisite is dated *after*
  the thing that depends on it, the arrow turns red.
- **Live status, local plan.** Sync pulls issues/milestones for progress and
  open/closed state; your dates and dependencies stay in `data/board.json`.
- **Runs 100% locally.** Plain JSON on disk, no backend, no database. The only
  outbound calls are read-only API reads during a sync — and in the default
  **simulation mode** there are none at all.

## Quick start (simulated, no tokens)

```bash
cp .env.example .env.local
cp data/board.example.json data/board.json
npm install
npm run dev
```

Open <http://localhost:3000>, click **Sync now** (pulls the committed fixtures —
no network), then explore: milestones on the timeline, a cross-lane dependency,
and the **Add to plan** / **Edit board** controls.

> `SIMULATE=true` is the default. A fresh clone runs end-to-end with **no tokens**
> and **no network**.

## The view

- **Week ruler** (`W1 / Jun 8`, …) with a configurable start week + horizon, week
  gridlines, and a red **Today** marker.
- **Swimlanes** — one row per project, colored.
- **Items** placed on their target date: `◆` launch, `◇` milestone, `•` issue.
  Milestone cards show **closed/total progress** from synced issues; overdue
  open items get a `⚠`. Cards also show **assignees** (`@user`, from the VCS),
  local tags, and a **↗ deep link** that opens the issue/milestone in
  GitLab/GitHub.
- **Dependency arrows** — indigo normally, **red dashed when the plan slips**
  (prerequisite dated after its dependent). Within-lane and cross-lane.
- Zoom, per-project show/hide toggles, click an item for detail + editing.

## Planning (all local, never written to the VCS)

- **Add to plan** — lists milestones & issues discovered from the last sync that
  aren't placed yet; add one to a lane (date defaults to its VCS due date).
- **Click an item** to edit its **target date**, **lane**, **title**, mark it a
  **launch**, or **remove** it; add/remove **dependencies** (this item *needs* or
  *blocks* another); edit local **tags**; and **link** it to the GitLab/GitHub
  issue or milestone it corresponds to (a plan-only item gains live status + a
  deep link, or **unlink** to make it plan-only again).
- **Edit board** — board name, start week + horizon, and add/rename/recolor/
  delete swimlanes and sources.

All edits persist to `data/board.json` via `PUT /api/board` (atomic, zod-validated).

## Going live (real GitLab / GitHub)

1. Read-only tokens: **GitLab** PAT scope `read_api`; **GitHub** fine-grained PAT
   with read access to Issues + Metadata.
2. Put them in `.env.local` (never committed):
   ```bash
   SIMULATE=false
   GITLAB_TOKEN=glpat-…
   GITHUB_TOKEN=github_pat_…
   ```
3. List your repos under `sources` (Edit board), **Sync now**, then **Add to
   plan** the milestones/issues you want to track.

All VCS calls happen **server-side**, so tokens never reach the browser.

### Self-hosted GitLab / GitHub Enterprise

Override the API base URL in `.env.local` (no config edit) — note the path suffix:

```bash
GITLAB_API_URL=https://gitlab.example.com/api/v4   # self-hosted GitLab
GITHUB_API_URL=https://github.example.com/api/v3   # GitHub Enterprise Server
```

Deep links use each issue's own `web_url` / `html_url`, so they resolve to the
right instance automatically.

## Data model

| File | Purpose | Committed? |
| --- | --- | --- |
| `data/board.example.json` | Fictional sample plan (sources, lanes, items, deps) | ✅ |
| `data/board.json` | Your working plan | ❌ gitignored |
| `data/synced.json` | Disposable cache written by **Sync now** (per-source issue lists) | ❌ gitignored |
| `config/providers.json` | Non-secret provider config (API base URLs) | ✅ |
| `fixtures/*.sim.json` | Fictional simulated issue lists, shaped like the real APIs | ✅ |
| `fixtures/*.local.json` | Optional private fixture overlay for offline simulation | ❌ gitignored |
| `.env.local` | Tokens + `SIMULATE` | ❌ gitignored |

`board.json` shape:

```jsonc
{
  "board": { "name": "Roadmap", "startWeek": "2026-06-08", "horizonWeeks": 20 }, // Monday start
  "sources": [ { "provider": "github", "project": "owner/repo" } ],
  "lanes":   [ { "id": "ai", "title": "AI Engine", "color": "#6A1B9A" } ],
  "items": [
    { "id": "ai-m6", "laneId": "ai", "kind": "milestone", "title": "Engine v2",
      "targetDate": "2026-08-31", "isLaunch": true, "tags": ["q3", "risk"],
      "sourceRef": { "provider":"github", "project":"owner/repo", "type":"milestone", "id":"6" } }
  ],
  "dependencies": [ { "from": "ai-m6", "to": "billing-m2" } ]   // from must finish before to
}
```

- **`targetDate`** is your planned date (issues usually have none in the VCS —
  you set it here). For milestones it defaults to the VCS due date when you add it.
- **`sourceRef`** links an item to a live milestone/issue for status + progress;
  items can also be plan-only (no ref).

### Keep your real plan private

Everything committed is **fictional** (sample plan + `*.sim.json`). Your real plan
lives only in gitignored `data/board.json`; to simulate a private board offline,
drop `fixtures/{gitlab,github}.local.json` (same flat-issue-list shape as the
`*.sim.json` files) and the `MockProvider` overlays them.

## Architecture

```
src/lib/providers/   VcsProvider interface + gitlab / github / mock adapters
src/lib/store.ts     Store interface + JsonFileStore (atomic temp-file + rename writes)
src/lib/weeks.ts     Monday-start week grid math
src/lib/viewModel.ts merge board (plan) + synced (live) -> timeline render model
src/lib/layout.ts    week/column geometry for items + arrows
src/lib/sync.ts      "Sync now" orchestration (server-side)
src/components/       Timeline, ItemCard, ItemDetail, AddToPlanPanel, BoardEditor, BoardClient
src/app/api/sync/    POST sync (server-only token use)
src/app/api/board/   GET/PUT the local plan
```

The provider abstraction maps **only** to native Issues (each carrying its
milestone):

```ts
interface VcsProvider {
  id: "gitlab" | "github" | "mock";
  listProjectIssues(ref: ProjectRef): Promise<ProjectIssue[]>;
}
```

`MockProvider` implements the same interface from fixtures; `SIMULATE=true` routes
every source through it. Fixtures mirror the real API responses, so the same pure
mappers run against fixtures and live data — and the adapters are unit-tested
against them.

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

## License

MIT — see [LICENSE](LICENSE).
