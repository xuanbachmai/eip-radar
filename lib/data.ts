// Server-side data access. The committed snapshot (data/snapshot.json, refreshed by the GitHub
// Action) is the floor; on top of it the live pipeline runs at most every 6 h (ISR) and only
// re-fetches files whose blob changed. Any fetch failure falls back to the committed files and the
// UI says so — a build or request never fails because GitHub is unavailable.

import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { cache } from "react";
import { unstable_cache } from "next/cache";
import { diffSnapshots, parseJsonl } from "./diff";
import { runPipeline } from "./pipeline";
import type { ChangeEvent, Snapshot } from "./types";

export const REVALIDATE_SECONDS = 21_600;
export const DATA_TAG = "snapshot";

export interface SiteData {
  snapshot: Snapshot;
  changes: ChangeEvent[];
  /** When the upstream repo was last confirmed (live check) or, offline, when the snapshot was generated. */
  checkedAt: string;
  mode: "live" | "committed";
  /** Set when a live check was attempted and failed. */
  error?: string;
}

async function loadCommitted(): Promise<{ snapshot: Snapshot; changes: ChangeEvent[] }> {
  const dir = join(process.cwd(), "data");
  const [snap, changes] = await Promise.all([
    readFile(join(dir, "snapshot.json"), "utf8"),
    readFile(join(dir, "changes.jsonl"), "utf8").catch(() => ""),
  ]);
  return { snapshot: JSON.parse(snap) as Snapshot, changes: parseJsonl(changes) };
}

const offline = () => process.env.EIP_RADAR_OFFLINE === "1";

async function loadLive(): Promise<SiteData> {
  const committed = await loadCommitted();
  try {
    const result = await runPipeline({
      previous: committed.snapshot,
      token: process.env.GITHUB_TOKEN || undefined,
      // The outer unstable_cache owns caching; individual file fetches must not fill the data cache.
      fetch: (url, init) => fetch(url, { ...init, cache: "no-store" }),
      maxWaitMs: 10_000,
    });
    const extra = result.changed
      ? diffSnapshots(committed.snapshot, result.snapshot, { at: result.snapshot.generatedAt, commit: result.snapshot.source.commitSha })
      : [];
    return { snapshot: result.snapshot, changes: [...committed.changes, ...extra], checkedAt: new Date().toISOString(), mode: "live" };
  } catch (err) {
    return { ...committed, checkedAt: committed.snapshot.generatedAt, mode: "committed", error: (err as Error).message };
  }
}

const cachedLive = unstable_cache(loadLive, ["site-data-v1"], { revalidate: REVALIDATE_SECONDS, tags: [DATA_TAG] });

export const getSiteData = cache(async (): Promise<SiteData> => {
  if (offline()) {
    const c = await loadCommitted();
    return { ...c, checkedAt: c.snapshot.generatedAt, mode: "committed" };
  }
  return cachedLive();
});
