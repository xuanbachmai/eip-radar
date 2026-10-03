# EIP Radar

A public dashboard that tracks every **Core** Ethereum Improvement Proposal. It updates itself from
[`ethereum/EIPs`](https://github.com/ethereum/EIPs) and uses charts rather than prose to show the
state of the roadmap:

1. What ships in the next network upgrade, and when?
2. What is moving through the pipeline right now, and what changed this week?
3. How does the pipeline map onto the roadmap tracks (Merge, Surge, Scourge, Verge, Purge, Splurge)?
4. What died, and what replaced it?

No prices, tokens, or governance opinions.

## Features

- **Dashboard:** the next upgrade with countdown, readiness and track mix. Also a grouped change feed, status by track, Last Call deadlines (with overdue ones flagged), the upgrade timeline and the pipeline flow.
- **Inclusion board:** a kanban of EIP-7723 stages for upgrades still being negotiated, such as Hegotá.
- **Explorer:** search, filters in the URL, sorting, CSV export, copy link, a detail drawer and a "watched only" filter.
- **Watchlist:** star any EIP to follow it on the dashboard. Stored in your browser only; no account.
- **Quick search:** press `⌘K` / `Ctrl+K` or `/` to jump to any EIP, upgrade or track.
- **Share cards:** Open Graph images for the site, each EIP and each upgrade.
- **Feeds:** `/feed.xml` (RSS), `/api/changes` (JSON), `/api/index` (compact index).

## Quick start

```bash
pnpm i
pnpm sync      # refresh data/snapshot.json from ethereum/EIPs (optional: a snapshot is committed)
pnpm dev
```

| Script | What it does |
|---|---|
| `pnpm sync [--force] [--strict]` | Runs the pipeline and writes `data/snapshot.json`. New change events are appended to `data/changes.jsonl`. |
| `pnpm backfill [--days 90]` | Rebuilds change events from commit history. Needs `GITHUB_TOKEN`. |
| `pnpm obsidian [dir]` | Generates an Obsidian vault (default `obsidian/EIP Radar`) with one linked note per EIP, upgrade, track, lineage and author. It includes graph colours by track and an upgrade-timeline canvas. |
| `pnpm triage` | Lists Core EIPs whose track came from the regex rules rather than the reviewed map. |
| `pnpm test` / `pnpm e2e` | Vitest unit tests / Playwright smoke tests (`pnpm build` first). |
| `pnpm lint` / `pnpm typecheck` / `pnpm build` | Checks and the production build. |

## Method

**Source.** The pipeline lists the `ethereum/EIPs` tree at the head of `master` and records the
commit. It fetches only files whose blob SHA changed since the last snapshot, from
`raw.githubusercontent.com` pinned to that commit. Hardfork Meta EIPs are always refetched. If the
tree SHA hasn't changed, it fetches nothing. A sync makes two REST API calls, so it works without a
token.

**Parsing.** Front matter is parsed line by line rather than as YAML, because titles contain
colons. The pipeline keeps `category: Core` and extracts the abstract (first 400 characters) and the
discussion URL. Author emails are dropped; names and GitHub handles are kept.

**Upgrades.** Homestead → Shapella membership is static (`config/upgrades.ts`). Every
`Hardfork Meta - <Name>` EIP from 7569 onward is discovered and parsed automatically, so a new fork
needs no code change. The parser reads:

- the included EIPs
- the EIP-7723 stages (Scheduled / Considered / Proposed / Declined)
- activation tables (epoch, timestamp, fork ID)
- the mascot
- BPO blob parameters, including the historical Cancun/Prague schedule

**Tracks.** Each Core EIP gets one track. `config/track-overrides.ts` is a hand-reviewed map of
every Core EIP known at launch. New EIPs fall through the ordered rules in `config/tracks.ts`, and
anything landing on the Splurge fallback appears in `pnpm triage`.

**Guard.** A sync fails loudly, without writing, if it finds fewer than 350 Core EIPs or if any
known upgrade is missing.

## Keeping it current

- **GitHub Action** (`.github/workflows/snapshot.yml`, every 6 h): runs `pnpm sync --strict` and
  the tests, then commits `data/` if it changed. The repo therefore holds a diffable history, and
  the site can always build from disk.
- **Site**: pages use ISR with a 6 h revalidate. On revalidation the server runs the same pipeline
  on top of the committed snapshot. If GitHub is unreachable, it serves the committed snapshot and
  the freshness line says so.
- **Check now**: `POST /api/refresh?force=1`, throttled to one real check every 2 minutes.
- **Vercel Cron**: `vercel.json` calls `/api/refresh?force=1` once a day (the Hobby plan only allows daily crons). The 6 h cadence comes from the GitHub Action, because each data commit triggers a redeploy. If you set `CRON_SECRET`, cron calls are accepted without the throttle.
- **Feeds**: `/feed.xml` (RSS) and `/api/changes` (JSON, filterable by `eip`, `type`, `limit`).

## Caveats

- The pipeline flow chart infers each EIP's path from its current status. The repo records where an
  EIP is, not the route it took. Stagnant and Withdrawn EIPs are drawn as leaving from Draft.
- Status history begins with the change log. The initial 90 days were reconstructed from commit
  history (`source: "backfill"`); earlier transitions show as "date not observed".
- Lead times are measured from the `created` date.
- Track assignment is editorial. Many EIPs could plausibly sit in two tracks.

## Layout

```
app/                 routes: /, /upgrades, /tracks, /eips, /about, /api/*, /feed.xml
components/viz/      charts (timeline, pipeline flow, matrix, stream, blobs, lineages, deps, authors, beeswarm)
components/ui/       primitives (pills, stats, freshness line, theme toggle, EIP summary)
lib/                 github.ts · parse.ts · forks.ts · diff.ts · pipeline.ts · data.ts · derive.ts
config/              tracks.ts · track-overrides.ts · upgrades.ts · lineages.ts
data/                snapshot.json + changes.jsonl (generated, committed)
scripts/             sync.ts · backfill.ts · triage.ts
```

## Licence

Code: MIT. EIP content: CC0, via ethereum/EIPs.
