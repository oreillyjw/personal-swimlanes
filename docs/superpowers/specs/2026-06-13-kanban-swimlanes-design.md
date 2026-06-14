# Kanban swimlanes with issue tiles — design

**Date:** 2026-06-13
**Status:** Approved (pending spec review)

## Summary

Today the app renders a Gantt-style timeline: each project is a lane and its
**milestones** are cards on a Monday-start weekly grid. This redesign turns the
board into a **kanban of issue tiles**. Each swimlane (row) is a project grouping;
each **issue** is a tile; tiles sit in one of three time columns — **Past /
Current / Future**. Issues are pulled read-only from GitLab and GitHub; the only
local state is structural (which milestones map to which swimlane) plus per-issue
**hide/pin**. Issues not assigned to a mapped milestone/swimlane fall into a
**Catch-all** swimlane.

The VCS remains the source of truth. The app never writes to GitLab/GitHub.

## Goals

- Render every issue from configured repos as a tile inside a swimlane.
- Three columns per swimlane: Past (closed), Current, Future — date always shown.
- Local milestone→swimlane mapping; unmapped/no-milestone issues → Catch-all.
- Local-only per-issue **hide** and **pin** (no writes to VCS).
- Keep simulation mode (`SIMULATE=true`), the `Store`/atomic-write layer, the
  provider abstraction with shared mappers, and the Sync-now route.

## Non-goals (explicitly dropped)

- Cross-lane **dependency arrows** — removed (a timeline concept).
- **Launch markers** — removed.
- Per-issue local overrides for **date / title / swimlane** — out of scope. Dates
  come from VCS; swimlane comes from the milestone map.
- Editing issues, creating issues, or any write back to the VCS.

## Data model

### `data/board.json` (gitignored — the working board)

```jsonc
{
  "board": {
    "name": "My Roadmap",
    // Current column = open issues that are overdue OR due within this many
    // weeks from the start of the current week. Default 2 (this + next week).
    "currentWindowWeeks": 2
  },

  // Repos to pull ALL issues from (drives Catch-all completeness).
  "sources": [
    { "provider": "github", "project": "owner/repo" },
    { "provider": "gitlab", "project": "group/project" }
  ],

  // Each swimlane lists the milestone refs assigned to it.
  "swimlanes": [
    {
      "id": "ai",
      "title": "AI Engine",
      "color": "#6A1B9A",
      "milestones": [
        { "provider": "github", "project": "owner/repo", "id": "6" }
      ]
    }
  ],

  // Local-only per-issue state. Key = "provider:project:number".
  "issueState": {
    "github:owner/repo:412": { "hidden": true, "pinned": false }
  }
}
```

Notes:
- `sources` is explicit (not derived from swimlane milestone refs) so a repo can
  be scanned for Catch-all issues even if none of its milestones are mapped.
- A milestone ref reuses the existing `{ provider, project, id }` shape. The
  `id` matches the issue's native milestone id (GitLab milestone `id`, GitHub
  milestone `number`).
- `data/board.example.json` ships a **fictional** sample in this shape (committed).

### `data/synced.json` (gitignored — disposable cache)

Per-source issue lists written by Sync now:

```jsonc
{
  "sources": {
    "github:owner/repo": {
      "issues": [
        {
          "number": "412",
          "title": "Fix streaming flush",
          "state": "open",                 // "open" | "closed"
          "dueDate": "2026-06-20",         // ISO or null
          "milestone": { "id": "6", "title": "v2", "dueDate": "2026-06-30" } | null,
          "url": "https://github.com/owner/repo/issues/412"
        }
      ],
      "syncedAt": "2026-06-13T12:00:00.000Z"
    }
  },
  "lastSyncAt": "2026-06-13T12:00:00.000Z"
}
```

## Provider layer

Add one method to `VcsProvider`:

```ts
listProjectIssues(ref: { provider; project }): Promise<ProjectIssue[]>;

interface ProjectIssue {
  number: string;
  title: string;
  state: "open" | "closed";
  dueDate: string | null;                          // ISO yyyy-mm-dd
  milestone: { id: string; title: string; dueDate: string | null } | null;
  url: string;
}
```

- **GitLab:** `GET /projects/:enc/issues?per_page=100` (paginate via `x-next-page`
  or Link header). Map `state` `opened→open`. `dueDate = issue.due_date ??
  milestone.due_date ?? null`. `milestone` from `issue.milestone`.
- **GitHub:** `GET /repos/:owner/:repo/issues?state=all&per_page=100` (paginate
  via Link header). Filter out PRs (`pull_request` present). GitHub issues have no
  due date → `dueDate = milestone.due_on(date) ?? null`. `milestone` from
  `issue.milestone` (`number` → `id`).
- Pure mappers (`mapGitlabProjectIssues` / `mapGithubProjectIssues`) shared by the
  live adapters and `MockProvider`, unit-tested against fixtures.
- The old `getMilestone` / per-milestone `listIssues` are removed (no consumer).

## Bucketing rule

Given `today`, compute `currentWindowStart = mondayOf(today)` and
`currentWindowEnd = currentWindowStart + currentWindowWeeks * 7 days`.

For each issue:
1. `state === "closed"` → **Past**.
2. else (open):
   - `dueDate == null` → **Current**.
   - `dueDate < currentWindowStart` → **Current**, flagged `overdue`.
   - `dueDate <= currentWindowEnd` → **Current**.
   - else → **Future**.

## Swimlane assignment

Build a map `milestoneRefKey → swimlaneId` from `board.swimlanes`. For each issue:
- If it has a milestone and `refKey(milestone) ` is mapped → that swimlane.
- Else → the synthetic **Catch-all** swimlane (always rendered last).

`hidden` issues are excluded unless "show hidden" is on. `pinned` issues sort to
the top of their cell; others sort by `dueDate` (nulls last), then title.

## View model & UI

- `buildViewModel(board, synced, today)` → `ResolvedBoard`:
  ```ts
  interface ResolvedBoard {
    name: string;
    swimlanes: ResolvedSwimlane[];   // catch-all appended last
    lastSyncAt: string | null;
    counts: { total; hidden };
  }
  interface ResolvedSwimlane {
    id; title; color; isCatchAll;
    past: Tile[]; current: Tile[]; future: Tile[];
  }
  interface Tile {
    key; title; date: string | null; dateLabel: string; state;
    overdue: boolean; milestoneTitle: string | null; url; pinned; hidden;
  }
  ```
- Components (replace `Timeline`, `MilestoneCard`, `MilestoneDetail`, `layout.ts`):
  - `KanbanBoard` — column headers (Past / Current / Future) + swimlane rows.
  - `Swimlane` — colored row label + three column cells.
  - `IssueTile` — title, **date always shown**, milestone sub-label, state dot,
    overdue flag; menu actions **Hide** / **Pin**.
  - `BoardClient` — toolbar: **Sync now**, per-swimlane show/hide, **Show hidden**
    toggle. Hide/Pin POST to a small local-only route that writes `issueState`
    into `board.json` via the `Store` (atomic), then `router.refresh()`.
- `weeks.ts` date helpers (`parseDay`, `mondayOf`, `formatMonthDay`) are kept and
  reused; the week-geometry parts of `layout.ts` are removed.

## Sync flow

`runSync` iterates `board.sources`, calls `listProjectIssues` per source through
the resolved provider, and writes `synced.json` atomically. Server-side only;
tokens never reach the browser. Simulation mode routes every source through
`MockProvider`.

## Persistence of hide/pin

A new server route (e.g. `POST /api/issue-state`) accepts
`{ key, hidden?, pinned? }`, reads `board.json`, merges into `issueState`, and
writes atomically through the `Store`. Local-only; never contacts the VCS. This is
the one place the app writes to disk outside of sync.

## Fixtures & tests

- Reshape `fixtures/gitlab.sim.json` / `fixtures/github.sim.json` to per-repo
  issue lists including: closed issues (→ Past), open dated issues (→
  Current/Future), an overdue open issue, a no-date open issue, and **issues with
  an unmapped or absent milestone** (→ Catch-all). All **fictional**.
- `fixtures/*.local.json` overlay still supported for private offline boards.
- Tests: GitLab/GitHub project-issue mappers (state, due-date fallback, PR
  filtering, pagination shape); bucketing rule (all branches incl. overdue/no
  date); swimlane assignment + catch-all; hide/pin sorting; `MockProvider`
  routing. Keep `resolveApiBaseUrl` tests.

## Public-repo hygiene (unchanged)

Committed artifacts stay fictional: `board.example.json`, `*.sim.json`. Real board
lives only in gitignored `data/board.json` and `fixtures/*.local.json`. Tokens
only in `.env.local`.

## README

Update to describe the swimlane/issue-tile model, the three columns, the
milestone→swimlane map, Catch-all, and hide/pin. Keep self-hosted + simulation
sections.
