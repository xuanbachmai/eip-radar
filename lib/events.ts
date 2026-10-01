// Human-readable text for change events (feed, RSS).

import { fmtDateTimeUtc } from "./format";
import type { ChangeEvent } from "./types";

export function describeEvent(e: ChangeEvent, upgradeName: (slug: string) => string): { subject: string; eip?: number; text: string } {
  switch (e.type) {
    case "status_change":
      return { eip: e.eip, subject: e.title, text: `${e.from} → ${e.to}` };
    case "new_eip":
      return { eip: e.eip, subject: e.title, text: `new Core EIP, ${e.status}` };
    case "fork_inclusion_change": {
      const u = upgradeName(e.upgrade);
      const text = e.from === null ? `${e.to} for ${u}` : e.to === null ? `removed from ${u} (was ${e.from})` : `${u}: ${e.from} → ${e.to}`;
      return { eip: e.eip, subject: e.title ?? "", text };
    }
    case "activation_scheduled":
      return {
        subject: upgradeName(e.upgrade),
        text: `${e.network} activation ${e.previous ? "moved to" : "set for"} ${fmtDateTimeUtc(e.timestamp)}`,
      };
    case "blob_params_set":
      return { subject: upgradeName(e.upgrade), text: `blob target/max set to ${e.params.target}/${e.params.max}` };
  }
}

export interface EventGroup {
  key: string;
  at: string;
  commit: string;
  events: ChangeEvent[];
}

/**
 * Collapse events that share a commit and the same transition (e.g. eleven EIPs moved
 * Proposed → Considered for Hegotá in one meta-EIP edit) into one group. Newest first.
 */
export function groupEvents(events: ChangeEvent[]): EventGroup[] {
  const sig = (e: ChangeEvent) => {
    switch (e.type) {
      case "status_change":
        return `${e.type}|${e.from}|${e.to}`;
      case "fork_inclusion_change":
        return `${e.type}|${e.upgrade}|${e.from}|${e.to}`;
      case "new_eip":
        return `${e.type}|${e.status}`;
      default:
        return `${e.type}|${e.upgrade}|${"network" in e ? e.network : ""}`;
    }
  };
  const groups = new Map<string, EventGroup>();
  for (const e of [...events].sort((a, b) => b.at.localeCompare(a.at))) {
    const key = `${e.commit}|${sig(e)}`;
    const g = groups.get(key);
    if (g) g.events.push(e);
    else groups.set(key, { key, at: e.at, commit: e.commit, events: [e] });
  }
  return [...groups.values()];
}

/** Headline for a group of two or more events with the same transition. */
export function describeGroup(g: EventGroup, upgradeName: (slug: string) => string): string {
  const e = g.events[0]!;
  const n = g.events.length;
  switch (e.type) {
    case "fork_inclusion_change": {
      const u = upgradeName(e.upgrade);
      if (e.from === null) return `${n} EIPs ${e.to} for ${u}`;
      if (e.to === null) return `${n} EIPs removed from ${u} (were ${e.from})`;
      return `${u}: ${n} EIPs ${e.from} → ${e.to}`;
    }
    case "status_change":
      return `${n} EIPs ${e.from} → ${e.to}`;
    case "new_eip":
      return `${n} new Core EIPs`;
    default:
      return describeEvent(e, upgradeName).text;
  }
}
