// pnpm sync [--force] [--strict]
// Pipeline entry point for local use, CI (.github/workflows/snapshot.yml) and the Vercel cron.
//   --force   ignore caches and re-fetch every file
//   --strict  exit non-zero on fetch errors even when a committed snapshot exists (CI)

import { existsSync, readFileSync, writeFileSync, appendFileSync } from "node:fs";
import { resolve } from "node:path";
import { toJsonl } from "../lib/diff";
import { mainnetTimestamp } from "../lib/forks";
import { SnapshotGuardError, runPipeline } from "../lib/pipeline";
import { TRACKS, type Snapshot } from "../lib/types";
import { summarise } from "../lib/summary";

const SNAPSHOT = resolve("data/snapshot.json");
const CHANGES = resolve("data/changes.jsonl");
const args = new Set(process.argv.slice(2));

async function main() {
  const previous = existsSync(SNAPSHOT) ? (JSON.parse(readFileSync(SNAPSHOT, "utf8")) as Snapshot) : undefined;
  const token = process.env.GITHUB_TOKEN || undefined;
  if (!token) console.log("GITHUB_TOKEN not set — using unauthenticated API (60 req/h; a sync needs 2)");

  let result;
  try {
    result = await runPipeline({ previous, token, force: args.has("--force"), log: (m) => console.log(m) });
  } catch (err) {
    if (err instanceof SnapshotGuardError) {
      console.error(`\n✖ ${err.message}`);
      process.exit(1);
    }
    if (previous && !args.has("--strict")) {
      console.warn(`\n⚠ sync failed (${(err as Error).message}); keeping committed snapshot from ${previous.generatedAt}`);
      return;
    }
    throw err;
  }

  const { snapshot, events, stats } = result;
  if (result.changed) {
    writeFileSync(SNAPSHOT, JSON.stringify(snapshot, null, 2) + "\n");
    if (events.length) appendFileSync(CHANGES, toJsonl(events));
    else if (!existsSync(CHANGES)) writeFileSync(CHANGES, "");
    console.log(`\nwrote ${SNAPSHOT} (${events.length} change events${previous ? "" : "; first snapshot is the baseline"})`);
  }
  for (const e of stats.parseErrors) console.warn(`⚠ ${e.message}`);
  printSummary(snapshot);
}

function printSummary(s: Snapshot) {
  const sum = summarise(s);
  console.log(`\n=== EIP Radar snapshot — ethereum/EIPs @ ${s.source.commitSha.slice(0, 7)} (${s.generatedAt}) ===\n`);

  console.log(`Core EIPs: ${sum.total}   dead (Stagnant+Withdrawn): ${sum.dead} (${pct(sum.dead, sum.total)})   in motion: ${sum.inMotion}`);
  console.table(sum.byStatus);

  console.log("Track × status");
  console.table(
    Object.fromEntries(TRACKS.map((t) => [t, { ...sum.trackStatus[t], total: sum.byTrack[t], overrides: sum.trackOverrides[t] }])),
  );

  console.log("Upgrades (stage counts are Core EIPs only; `other` = listed but not Core)");
  const coreSet = new Set(s.eips.map((e) => e.eip));
  console.table(
    s.upgrades.map((u) => {
      const core = u.eips.filter((e) => coreSet.has(e.eip));
      const stages = (st: string) => core.filter((e) => e.stage === st).length || "";
      const ts = mainnetTimestamp(u);
      return {
        upgrade: u.name,
        kind: u.kind,
        meta: u.metaEip ?? "",
        mainnet: ts ? new Date(ts * 1000).toISOString().slice(0, 10) : "—",
        scheduled: stages("Scheduled"),
        considered: stages("Considered"),
        proposed: stages("Proposed"),
        declined: stages("Declined"),
        other: u.eips.length - core.length || "",
        blobs: u.blobParams ? `${u.blobParams.target ?? "TODO"}/${u.blobParams.max ?? "TODO"}` : "",
        mascot: u.mascot ?? "",
      };
    }),
  );

  const next = sum.nextUpgrade;
  if (next) {
    const testnets = next.activations
      .filter((a) => a.timestamp)
      .map((a) => `${a.network} ${new Date(a.timestamp! * 1000).toISOString().slice(0, 16).replace("T", " ")} UTC`);
    console.log(`Next upgrade: ${next.name} — mainnet ${mainnetTimestamp(next) ? "set" : "not set"}; ${testnets.join(", ") || "no dates"}`);
  }
  console.log(`EOF family: ${sum.eof.stagnant} Stagnant, active: ${sum.eof.active.join(", ") || "none"}`);
  if (sum.fallbackSplurge.length) {
    console.log(`\n${sum.fallbackSplurge.length} Core EIP(s) not in the override map fell through to splurge — run \`pnpm triage\`.`);
  }
}

const pct = (a: number, b: number) => `${Math.round((a / b) * 100)}%`;

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
