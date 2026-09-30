// Pure derivations over a snapshot + change log. No I/O; safe for server and client.

import { mainnetTimestamp } from "./forks";
import { DEAD, IN_MOTION, upgradeStatus, type UpgradeStatus } from "./summary";
import type { ChangeEvent, CoreEip, Snapshot, Stage, Status, Track, Upgrade } from "./types";

export { DEAD, IN_MOTION, upgradeStatus, type UpgradeStatus };

/** Statuses in pipeline order, as drawn on every status axis. */
export const STATUS_ORDER: readonly Status[] = ["Final", "Last Call", "Review", "Draft", "Stagnant", "Withdrawn"];

export function eipMap(s: Pick<Snapshot, "eips">): Map<number, CoreEip> {
  return new Map(s.eips.map((e) => [e.eip, e]));
}

export interface UpgradeMember extends CoreEip {
  stage: Stage;
}

/** Core EIPs attached to an upgrade (non-Core "other" listings are dropped). */
export function upgradeMembers(u: Upgrade, eips: Map<number, CoreEip>): UpgradeMember[] {
  const out: UpgradeMember[] = [];
  for (const m of u.eips) {
    const e = eips.get(m.eip);
    if (e) out.push({ ...e, stage: m.stage });
  }
  return out;
}

export interface Membership {
  upgrade: string;
  name: string;
  stage: Stage;
  status: UpgradeStatus;
}

/** Every upgrade an EIP is listed in, in upgrade order. The last entry is the one to render. */
export function memberships(eip: number, upgrades: Upgrade[], now = Date.now()): Membership[] {
  const out: Membership[] = [];
  for (const u of upgrades) {
    const m = u.eips.find((x) => x.eip === eip);
    if (m) out.push({ upgrade: u.slug, name: u.name, stage: m.stage, status: upgradeStatus(u, now) });
  }
  return out;
}

export function membershipIndex(upgrades: Upgrade[], now = Date.now()): Map<number, Membership[]> {
  const idx = new Map<number, Membership[]>();
  for (const u of upgrades) {
    const status = upgradeStatus(u, now);
    for (const m of u.eips) {
      const list = idx.get(m.eip) ?? [];
      list.push({ upgrade: u.slug, name: u.name, stage: m.stage, status });
      idx.set(m.eip, list);
    }
  }
  return idx;
}

export function requiredBy(eips: CoreEip[]): Map<number, number[]> {
  const out = new Map<number, number[]>();
  for (const e of eips) {
    for (const r of e.requires) out.set(r, [...(out.get(r) ?? []), e.eip]);
  }
  return out;
}

export interface HistoryStep {
  status: string;
  since: string; // ISO date
  source: "created" | "observed";
}

/**
 * Status history: `created` is taken as the Draft start; every observed status_change after that
 * is appended. Before the change log began we only know the current status, so the strip shows
 * "Draft → … → <current>" with the gap marked as unobserved.
 */
export function statusHistory(e: CoreEip, events: ChangeEvent[]): HistoryStep[] {
  const steps: HistoryStep[] = [{ status: "Draft", since: e.created, source: "created" }];
  for (const ev of events) {
    if (ev.type === "status_change" && ev.eip === e.eip) steps.push({ status: ev.to, since: ev.at, source: "observed" });
  }
  const last = steps[steps.length - 1]!;
  if (last.status !== e.status) steps.push({ status: e.status, since: "", source: "observed" });
  return steps;
}

export function countBy<T, K extends string>(items: T[], key: (t: T) => K): Record<K, number> {
  const out = {} as Record<K, number>;
  for (const i of items) out[key(i)] = (out[key(i)] ?? 0) + 1;
  return out;
}

export function yearOf(date: string): number {
  return Number(date.slice(0, 4));
}

export interface YearTrackCount {
  year: number;
  counts: Record<Track, number>;
  total: number;
}

export function creationByYear(eips: CoreEip[], tracks: readonly Track[], survivorsOnly = false): YearTrackCount[] {
  const pool = survivorsOnly ? eips.filter((e) => !DEAD.includes(e.status)) : eips;
  const years = pool.map((e) => yearOf(e.created)).filter(Number.isFinite);
  if (!years.length) return [];
  const [lo, hi] = [Math.min(...years), Math.max(...years)];
  const rows: YearTrackCount[] = [];
  for (let y = lo; y <= hi; y++) {
    const counts = Object.fromEntries(tracks.map((t) => [t, 0])) as Record<Track, number>;
    rows.push({ year: y, counts, total: 0 });
  }
  for (const e of pool) {
    const row = rows[yearOf(e.created) - lo];
    if (!row) continue;
    row.counts[e.track]++;
    row.total++;
  }
  return rows;
}

export interface AuthorRow {
  name: string;
  handle?: string;
  total: number;
  byTrack: Partial<Record<Track, number>>;
  eips: number[];
}

/** Authors ranked by EIPs currently in motion (Draft / Review / Last Call). */
export function authorActivity(eips: CoreEip[], limit = 20): AuthorRow[] {
  const byKey = new Map<string, AuthorRow>();
  for (const e of eips) {
    if (!IN_MOTION.includes(e.status)) continue;
    for (const a of e.authors) {
      const key = (a.handle ?? a.name).toLowerCase();
      const row = byKey.get(key) ?? { name: a.name, handle: a.handle, total: 0, byTrack: {}, eips: [] };
      row.total++;
      row.byTrack[e.track] = (row.byTrack[e.track] ?? 0) + 1;
      row.eips.push(e.eip);
      byKey.set(key, row);
    }
  }
  return [...byKey.values()].sort((a, b) => b.total - a.total || a.name.localeCompare(b.name)).slice(0, limit);
}

export interface AgePoint {
  eip: number;
  title: string;
  track: Track;
  upgrade: string;
  upgradeName: string;
  years: number;
}

/** Final EIPs: years from `created` to the mainnet activation of the upgrade that shipped them. */
export function ageToActivation(s: Pick<Snapshot, "eips" | "upgrades">, now = Date.now()): AgePoint[] {
  const eips = eipMap(s);
  const out: AgePoint[] = [];
  for (const u of s.upgrades) {
    const ts = mainnetTimestamp(u);
    if (ts === undefined || ts * 1000 > now) continue;
    for (const m of u.eips) {
      const e = eips.get(m.eip);
      if (!e || e.status !== "Final" || m.stage !== "Scheduled") continue;
      const created = Date.parse(`${e.created}T00:00:00Z`);
      if (!Number.isFinite(created)) continue;
      out.push({ eip: e.eip, title: e.title, track: e.track, upgrade: u.slug, upgradeName: u.name, years: (ts * 1000 - created) / 3.15576e10 });
    }
  }
  return out;
}

export function median(xs: number[]): number {
  if (!xs.length) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}

export interface BlobStep {
  slug: string;
  name: string;
  timestamp?: number;
  target: number | null;
  max: number | null;
}

/** Blob target/max per activation, carrying forward through forks that didn't change them. */
export function blobSchedule(upgrades: Upgrade[]): BlobStep[] {
  return upgrades
    .filter((u) => u.blobParams)
    .map((u) => ({ slug: u.slug, name: u.name, timestamp: mainnetTimestamp(u), target: u.blobParams!.target, max: u.blobParams!.max }));
}

export function lastVisitCount(events: { at: string }[], since: number | null): number {
  if (since === null) return 0;
  return events.filter((e) => Date.parse(e.at) > since).length;
}
