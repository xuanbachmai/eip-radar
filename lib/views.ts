// Snapshot → chart props. Pure; called from server components so charts receive small payloads.

import type { TimelineColumn } from "@/components/viz/upgrade-timeline";
import type { MatrixRow } from "@/components/viz/track-status-matrix";
import type { StatusTrackCounts } from "@/components/viz/pipeline-flow";
import type { GraphEip, GraphFilter } from "@/components/viz/dependency-graph";
import type { AgeGroup } from "@/components/viz/age-beeswarm";
import { TRACK_LABEL } from "./colors";
import { ageToActivation, eipMap, membershipIndex, upgradeMembers, upgradeStatus } from "./derive";
import { mainnetTimestamp } from "./forks";
import { TRACKS, type CoreEip, type Snapshot, type Track, type Upgrade } from "./types";

export function timelineColumns(s: Snapshot, now = Date.now()): TimelineColumn[] {
  const eips = eipMap(s);
  return s.upgrades.map((u) => {
    const state = upgradeStatus(u, now);
    const members = upgradeMembers(u, eips).filter((m) => m.stage === "Scheduled" || (state === "planning" && m.stage === "Considered"));
    return {
      slug: u.slug,
      name: u.name,
      kind: u.kind,
      ts: mainnetTimestamp(u),
      state,
      chips: members
        .sort((a, b) => (a.stage === b.stage ? TRACKS.indexOf(a.track) - TRACKS.indexOf(b.track) || a.eip - b.eip : a.stage === "Scheduled" ? -1 : 1))
        .map((m) => ({ eip: m.eip, title: m.title, track: m.track, status: m.status, stage: m.stage })),
    };
  });
}

export function matrixRows(eips: CoreEip[]): MatrixRow[] {
  return TRACKS.map((t) => {
    const mine = eips.filter((e) => e.track === t);
    const counts: Record<string, number> = {};
    for (const e of mine) counts[e.status] = (counts[e.status] ?? 0) + 1;
    return { track: t, counts, total: mine.length };
  }).filter((r) => r.total > 0);
}

export function flowCounts(eips: CoreEip[]): StatusTrackCounts {
  const out: StatusTrackCounts = {};
  for (const e of eips) {
    const row = (out[e.status] ??= {});
    row[e.track] = (row[e.track] ?? 0) + 1;
  }
  return out;
}

export function graphData(s: Snapshot): GraphEip[] {
  const idx = membershipIndex(s.upgrades);
  return s.eips.map((e) => ({
    eip: e.eip,
    title: e.title,
    track: e.track,
    status: e.status,
    requires: e.requires,
    upgrades: (idx.get(e.eip) ?? []).map((m) => m.upgrade),
  }));
}

export function graphFilters(s: Snapshot): GraphFilter[] {
  const eips = eipMap(s);
  return [
    ...TRACKS.map((t) => ({ kind: "track" as const, value: t, label: TRACK_LABEL[t] })),
    ...s.upgrades
      .filter((u) => upgradeMembers(u, eips).length > 1)
      .map((u) => ({ kind: "upgrade" as const, value: u.slug, label: u.name })),
  ];
}

export function ageGroups(s: Snapshot, now = Date.now()): AgeGroup[] {
  const points = ageToActivation(s, now);
  const out: AgeGroup[] = [];
  for (const u of s.upgrades) {
    const ps = points.filter((p) => p.upgrade === u.slug);
    if (ps.length) out.push({ slug: u.slug, name: u.name, points: ps });
  }
  return out;
}

export function trackMix(u: Upgrade, eips: Map<number, CoreEip>): { track: Track; n: number }[] {
  const counts = new Map<Track, number>();
  for (const m of upgradeMembers(u, eips)) counts.set(m.track, (counts.get(m.track) ?? 0) + 1);
  return TRACKS.filter((t) => counts.get(t)).map((t) => ({ track: t, n: counts.get(t)! }));
}
