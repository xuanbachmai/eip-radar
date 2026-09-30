// Flattened per-EIP rows for the explorer table, the detail drawer and /eips/[n].

import { membershipIndex, requiredBy, statusHistory, type HistoryStep, type Membership } from "./derive";
import type { ChangeEvent, Snapshot, Stage, Track } from "./types";

export interface EipRow {
  eip: number;
  title: string;
  description?: string;
  status: string;
  track: Track;
  trackSource: "override" | "rule";
  created: string;
  year: number;
  authors: string[];
  requires: number[];
  requiredBy: number[];
  memberships: Membership[];
  /** Latest listing, rendered in the table. */
  upgrade?: string;
  upgradeName?: string;
  stage?: Stage;
  abstract?: string;
  discussionsTo?: string;
  lastCallDeadline?: string;
  withdrawalReason?: string;
  history: HistoryStep[];
}

export function buildRows(s: Snapshot, changes: ChangeEvent[], now = Date.now()): EipRow[] {
  const idx = membershipIndex(s.upgrades, now);
  const reqBy = requiredBy(s.eips);
  return s.eips.map((e) => {
    const ms = idx.get(e.eip) ?? [];
    const latest = ms[ms.length - 1];
    return {
      eip: e.eip,
      title: e.title,
      description: e.description,
      status: e.status,
      track: e.track,
      trackSource: e.trackSource,
      created: e.created,
      year: Number(e.created.slice(0, 4)),
      authors: e.authors.map((a) => a.name),
      requires: e.requires,
      requiredBy: (reqBy.get(e.eip) ?? []).sort((a, b) => a - b),
      memberships: ms,
      upgrade: latest?.upgrade,
      upgradeName: latest?.name,
      stage: latest?.stage,
      abstract: e.abstract,
      discussionsTo: e.discussionsTo,
      lastCallDeadline: e.lastCallDeadline,
      withdrawalReason: e.withdrawalReason,
      history: statusHistory(e, changes),
    };
  });
}
