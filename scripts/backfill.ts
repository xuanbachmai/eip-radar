// pnpm backfill [--days 90]
// Rebuild change events from ethereum/EIPs commit history so the feed and status-history strips
// have depth from day one. Needs GITHUB_TOKEN (one API call per commit touching EIPS/).
//   - status_change / new_eip: from `status:` / `category:` lines in each commit's patch
//   - fork_inclusion_change / activation_scheduled / blob_params_set: by parsing Hardfork Meta EIPs
//     before and after each commit that touched them
// Events are tagged `source: "backfill"`, merged with data/changes.jsonl and sorted by time.

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { classifyTrack } from "../config/tracks";
import { diffSnapshots, parseJsonl, toJsonl } from "../lib/diff";
import { buildUpgrades, hardforkMetaName, parseHardforkMeta } from "../lib/forks";
import { REPO, fetchRaw, fetchWithRetry } from "../lib/github";
import { parseEip } from "../lib/parse";
import type { ChangeEvent, Snapshot, Track } from "../lib/types";

const days = Number(process.argv[process.argv.indexOf("--days") + 1]) || 90;
const token = process.env.GITHUB_TOKEN;
if (!token) {
  console.error("GITHUB_TOKEN is required for backfill (it makes one API call per commit).");
  process.exit(1);
}
const opts = { token, log: (m: string) => console.log(m) };

const snapshot = JSON.parse(readFileSync("data/snapshot.json", "utf8")) as Snapshot;
const core = new Map(snapshot.eips.map((e) => [e.eip, e]));
const metaNums = new Set(snapshot.index.filter((i) => hardforkMetaName(i.eip, i.title)).map((i) => i.eip));

async function api<T>(path: string): Promise<T> {
  const res = await fetchWithRetry(
    `https://api.github.com/repos/${REPO}/${path}`,
    { headers: { Accept: "application/vnd.github+json", Authorization: `Bearer ${token}`, "User-Agent": "eip-radar" } },
    opts,
  );
  if (!res.ok) throw new Error(`${path} → ${res.status}`);
  return (await res.json()) as T;
}

interface CommitListItem {
  sha: string;
  commit: { committer: { date: string } };
}
interface CommitDetail {
  sha: string;
  parents: { sha: string }[];
  commit: { committer: { date: string } };
  files?: { filename: string; status: string; patch?: string; previous_filename?: string }[];
}

const since = new Date(Date.now() - days * 86_400_000).toISOString();
const list: CommitListItem[] = [];
for (let page = 1; ; page++) {
  const batch = await api<CommitListItem[]>(`commits?sha=master&path=EIPS&since=${since}&per_page=100&page=${page}`);
  list.push(...batch);
  if (batch.length < 100) break;
}
list.reverse(); // oldest first
console.log(`${list.length} commits touching EIPS/ in the last ${days} days`);

const events: ChangeEvent[] = [];
const coreEipsArr = snapshot.eips;
const track = (n: number, title: string): Track => core.get(n)?.track ?? classifyTrack(n, title).track;

for (const [i, item] of list.entries()) {
  const c = await api<CommitDetail>(`commits/${item.sha}`);
  const at = new Date(c.commit.committer.date).toISOString();
  const base = { at, commit: c.sha, source: "backfill" as const };
  for (const f of c.files ?? []) {
    const m = /^EIPS\/eip-(\d+)\.md$/.exec(f.filename);
    if (!m) continue;
    const n = Number(m[1]);

    if (f.patch && core.has(n)) {
      const title = core.get(n)!.title;
      const from = /^-status:\s*(.+)$/m.exec(f.patch)?.[1]?.trim();
      const to = /^\+status:\s*(.+)$/m.exec(f.patch)?.[1]?.trim();
      const becameCore = /^\+category:\s*Core\s*$/im.test(f.patch);
      if (f.status === "added" || (becameCore && !/^-category:\s*Core\s*$/im.test(f.patch))) {
        events.push({ ...base, type: "new_eip", eip: n, title, track: track(n, title), status: to ?? "Draft" });
      } else if (from && to && from !== to) {
        events.push({ ...base, type: "status_change", eip: n, title, track: track(n, title), from, to });
      }
    }

    if (metaNums.has(n) && c.parents[0]) {
      const [before, after] = await Promise.all([
        f.status === "added" ? Promise.resolve(null) : fetchRaw(c.parents[0].sha, f.previous_filename ?? f.filename, opts).catch(() => null),
        f.status === "removed" ? Promise.resolve(null) : fetchRaw(c.sha, f.filename, opts).catch(() => null),
      ]);
      const toUpgrades = (src: string | null) => {
        if (!src) return [];
        try {
          const slug = parseHardforkMeta(parseEip(src)).slug;
          return buildUpgrades([parseHardforkMeta(parseEip(src))]).filter((u) => u.slug === slug);
        } catch {
          return [];
        }
      };
      const diff = diffSnapshots({ eips: coreEipsArr, upgrades: toUpgrades(before) }, { eips: coreEipsArr, upgrades: toUpgrades(after) }, { at, commit: c.sha });
      events.push(...diff.map((e) => ({ ...e, source: "backfill" as const })));
    }
  }
  if ((i + 1) % 25 === 0) console.log(`  ${i + 1}/${list.length}`);
}

const existing = existsSync("data/changes.jsonl") ? parseJsonl(readFileSync("data/changes.jsonl", "utf8")) : [];
const key = (e: ChangeEvent) => JSON.stringify({ ...e, at: undefined, source: undefined });
const seen = new Set(existing.map(key));
const merged = [...existing, ...events.filter((e) => !seen.has(key(e)))].sort((a, b) => a.at.localeCompare(b.at));
writeFileSync("data/changes.jsonl", toJsonl(merged));

const byType: Record<string, number> = {};
for (const e of events) byType[e.type] = (byType[e.type] ?? 0) + 1;
console.log(`backfilled ${events.length} events`, byType, `→ ${merged.length} total in data/changes.jsonl`);
