// Aggregate figures derived from a snapshot — used by the sync summary and by the dashboard KPIs.

import { mainnetTimestamp } from "./forks";
import { STATUSES, TRACKS, type Snapshot, type Status, type Track, type Upgrade } from "./types";

export const IN_MOTION: readonly Status[] = ["Draft", "Review", "Last Call"];
export const DEAD: readonly Status[] = ["Stagnant", "Withdrawn"];

const EOF_PATTERN = /\bEOF\b|EVM Object Format/i;

export function summarise(s: Pick<Snapshot, "eips" | "upgrades">, now = Date.now()) {
  const byStatus = Object.fromEntries(STATUSES.map((st) => [st, 0])) as Record<Status, number>;
  const byTrack = Object.fromEntries(TRACKS.map((t) => [t, 0])) as Record<Track, number>;
  const trackOverrides = Object.fromEntries(TRACKS.map((t) => [t, 0])) as Record<Track, number>;
  const trackStatus = Object.fromEntries(
    TRACKS.map((t) => [t, Object.fromEntries(STATUSES.filter((x) => x !== "Living").map((st) => [st, 0]))]),
  ) as Record<Track, Record<Status, number>>;

  for (const e of s.eips) {
    byStatus[e.status]++;
    byTrack[e.track]++;
    if (e.trackSource === "override") trackOverrides[e.track]++;
    trackStatus[e.track][e.status] = (trackStatus[e.track][e.status] ?? 0) + 1;
  }
  if (!byStatus.Living) delete (byStatus as Partial<Record<Status, number>>).Living;

  const eofEips = s.eips.filter((e) => EOF_PATTERN.test(`${e.title} ${e.description ?? ""}`));
  return {
    total: s.eips.length,
    byStatus,
    byTrack,
    trackOverrides,
    trackStatus,
    inMotion: s.eips.filter((e) => IN_MOTION.includes(e.status)).length,
    dead: s.eips.filter((e) => DEAD.includes(e.status)).length,
    nextUpgrade: nextUpgrade(s.upgrades, now),
    eof: {
      stagnant: eofEips.filter((e) => e.status === "Stagnant").length,
      active: eofEips.filter((e) => IN_MOTION.includes(e.status)).map((e) => e.eip),
    },
    fallbackSplurge: s.eips.filter((e) => e.trackSource === "rule" && e.track === "splurge").map((e) => e.eip),
  };
}

/** The earliest named (non-BPO) upgrade that has not activated on mainnet yet. */
export function nextUpgrade(upgrades: Upgrade[], now = Date.now()): Upgrade | undefined {
  return upgrades.find((u) => {
    if (u.kind !== "meta") return false;
    const ts = mainnetTimestamp(u);
    return ts === undefined || ts * 1000 > now;
  });
}

export type UpgradeStatus = "shipped" | "scheduled" | "planning";

export function upgradeStatus(u: Upgrade, now = Date.now()): UpgradeStatus {
  const ts = mainnetTimestamp(u);
  if (ts !== undefined) return ts * 1000 <= now ? "shipped" : "scheduled";
  return "planning";
}
