// End-to-end sync: GitHub → parse → classify → upgrades → guard → diff.
// Pure with respect to the filesystem; scripts/sync.ts and /api/refresh decide where results go.

import { MIN_CORE_EIPS, REQUIRED_UPGRADES } from "../config/upgrades";
import { classifyTrack } from "../config/tracks";
import { diffSnapshots } from "./diff";
import { buildUpgrades, hardforkMetaName, parseHardforkMeta, type ParsedMeta } from "./forks";
import { BRANCH, REPO, fetchRaw, getEipTree, getHead, mapLimit, type GitHubOptions, type TreeFile } from "./github";
import { PARSER_VERSION, parseEip, type ParsedEip } from "./parse";
import { STATUSES, type ChangeEvent, type CoreEip, type IndexEntry, type Snapshot, type Status } from "./types";

export interface PipelineOptions extends GitHubOptions {
  previous?: Snapshot;
  /** Ignore the tree-SHA / blob caches and re-fetch every file. */
  force?: boolean;
  concurrency?: number;
  now?: () => Date;
}

export type PipelineResult =
  | { changed: false; snapshot: Snapshot; events: []; stats: SyncStats }
  | { changed: true; snapshot: Snapshot; events: ChangeEvent[]; stats: SyncStats };

export interface SyncStats {
  files: number;
  fetched: number;
  reused: number;
  parseErrors: { path: string; message: string }[];
}

export class SnapshotGuardError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SnapshotGuardError";
  }
}

export async function runPipeline(opts: PipelineOptions = {}): Promise<PipelineResult> {
  const log = opts.log ?? (() => {});
  const prev = opts.previous;
  const now = (opts.now ?? (() => new Date()))();
  const cacheValid = !opts.force && prev?.parserVersion === PARSER_VERSION;

  const head = await getHead(opts);
  log(`ethereum/EIPs @ ${head.commitSha.slice(0, 7)} (tree ${head.treeSha.slice(0, 7)})`);

  if (cacheValid && prev.source.treeSha === head.treeSha) {
    log("tree unchanged since last snapshot — skipping file fetches");
    return { changed: false, snapshot: prev, events: [], stats: { files: prev.index.length, fetched: 0, reused: prev.index.length, parseErrors: [] } };
  }

  const files = await getEipTree(head.treeSha, opts);
  const prevIndex = new Map((cacheValid ? prev.index : []).map((e) => [e.eip, e]));
  const prevCore = new Map((cacheValid ? prev.eips : []).map((e) => [e.eip, e]));

  // A file must be (re)fetched when its blob changed, or when it's a Hardfork Meta EIP (their bodies
  // aren't cached and every upgrade is rebuilt from them), or when it's Core but missing from the cache.
  const needsFetch = (f: TreeFile) => {
    const p = prevIndex.get(f.eip);
    if (!p || p.blob !== f.blob) return true;
    if (hardforkMetaName(f.eip, p.title)) return true;
    return isCore(p.category) && !prevCore.has(f.eip);
  };
  const toFetch = files.filter(needsFetch);
  log(`${files.length} EIP files; fetching ${toFetch.length}, reusing ${files.length - toFetch.length}`);

  const parseErrors: SyncStats["parseErrors"] = [];
  const parsed = new Map<number, ParsedEip>();
  let done = 0;
  await mapLimit(toFetch, opts.concurrency ?? 16, async (f) => {
    const src = await fetchRaw(head.commitSha, f.path, opts);
    try {
      parsed.set(f.eip, parseEip(src, f.path));
    } catch (err) {
      parseErrors.push({ path: f.path, message: (err as Error).message });
    }
    if (++done % 100 === 0) log(`  fetched ${done}/${toFetch.length}`);
  });

  const index: IndexEntry[] = [];
  const eips: CoreEip[] = [];
  const metas: ParsedMeta[] = [];
  for (const f of files) {
    const p = parsed.get(f.eip);
    if (p) {
      index.push({ eip: f.eip, blob: f.blob, title: p.title, status: p.status, type: p.type, ...(p.category ? { category: p.category } : {}) });
      if (isCore(p.category)) eips.push(toCore(p, f.blob));
      if (hardforkMetaName(p.eip, p.title)) {
        try {
          metas.push(parseHardforkMeta(p));
        } catch (err) {
          parseErrors.push({ path: f.path, message: `meta: ${(err as Error).message}` });
        }
      }
    } else if (!needsFetch(f)) {
      const cached = prevIndex.get(f.eip)!;
      index.push(cached);
      const core = prevCore.get(f.eip);
      // Re-classify cached rows so override-map edits apply without a forced refetch.
      if (core) eips.push({ ...core, ...trackOf(core.eip, core.title, core.description) });
    }
    // else: fetched but failed to parse — already recorded in parseErrors.
  }

  const snapshot: Snapshot = {
    schemaVersion: 1,
    parserVersion: PARSER_VERSION,
    generatedAt: now.toISOString(),
    source: { repo: REPO, branch: BRANCH, commitSha: head.commitSha, treeSha: head.treeSha, committedAt: head.committedAt },
    eips,
    upgrades: buildUpgrades(metas),
    index,
  };

  guardSnapshot(snapshot, parseErrors);
  const events = prev ? diffSnapshots(prev, snapshot, { at: snapshot.generatedAt, commit: head.commitSha }) : [];
  return { changed: true, snapshot, events, stats: { files: files.length, fetched: toFetch.length, reused: files.length - toFetch.length, parseErrors } };
}

function isCore(category: string | undefined): boolean {
  return category?.trim().toLowerCase() === "core";
}

function trackOf(eip: number, title: string, description?: string) {
  const c = classifyTrack(eip, title, description);
  return { track: c.track, trackSource: c.source };
}

function toCore(p: ParsedEip, blob: string): CoreEip {
  return {
    eip: p.eip,
    title: p.title,
    ...(p.description ? { description: p.description } : {}),
    authors: p.authors,
    status: (STATUSES as readonly string[]).includes(p.status) ? (p.status as Status) : "Draft",
    type: p.type,
    category: "Core",
    created: p.created,
    requires: p.requires,
    ...(p.lastCallDeadline ? { lastCallDeadline: p.lastCallDeadline } : {}),
    ...(p.withdrawalReason ? { withdrawalReason: p.withdrawalReason } : {}),
    ...(p.discussionsTo ? { discussionsTo: p.discussionsTo } : {}),
    ...(p.abstract ? { abstract: p.abstract } : {}),
    ...trackOf(p.eip, p.title, p.description),
    blob,
  };
}

/** Fail loudly rather than commit a partial snapshot. */
export function guardSnapshot(s: Pick<Snapshot, "eips" | "upgrades">, parseErrors: SyncStats["parseErrors"] = []) {
  const problems: string[] = [];
  if (s.eips.length < MIN_CORE_EIPS) problems.push(`only ${s.eips.length} Core EIPs (minimum ${MIN_CORE_EIPS})`);
  const have = new Set(s.upgrades.map((u) => u.slug));
  const missing = REQUIRED_UPGRADES.filter((slug) => !have.has(slug));
  if (missing.length) problems.push(`missing upgrades: ${missing.join(", ")}`);
  for (const u of s.upgrades) {
    if (u.kind === "meta" && u.eips.length === 0) problems.push(`upgrade ${u.slug} parsed with no EIPs`);
  }
  if (problems.length) {
    const errs = parseErrors.length ? `\nparse errors:\n  ${parseErrors.map((e) => e.message).join("\n  ")}` : "";
    throw new SnapshotGuardError(`snapshot rejected: ${problems.join("; ")}${errs}`);
  }
}
