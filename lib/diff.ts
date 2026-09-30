// Snapshot diff → change events appended to data/changes.jsonl.

import type { BlobParams, ChangeEvent, Snapshot, Stage, Upgrade } from "./types";

type DiffInput = Pick<Snapshot, "eips" | "upgrades">;

export function diffSnapshots(prev: DiffInput, next: DiffInput, meta: { at: string; commit: string }): ChangeEvent[] {
  const events: ChangeEvent[] = [];
  const base = { at: meta.at, commit: meta.commit };
  const prevEips = new Map(prev.eips.map((e) => [e.eip, e]));
  const nextEips = new Map(next.eips.map((e) => [e.eip, e]));

  for (const e of next.eips) {
    const p = prevEips.get(e.eip);
    if (!p) {
      events.push({ ...base, type: "new_eip", eip: e.eip, title: e.title, track: e.track, status: e.status });
    } else if (p.status !== e.status) {
      events.push({ ...base, type: "status_change", eip: e.eip, title: e.title, track: e.track, from: p.status, to: e.status });
    }
  }

  const prevUpgrades = new Map(prev.upgrades.map((u) => [u.slug, u]));
  for (const u of next.upgrades) {
    const p = prevUpgrades.get(u.slug);

    // Inclusion stage moves (including additions and removals).
    const before = stageMap(p);
    const after = stageMap(u);
    for (const eip of new Set([...before.keys(), ...after.keys()])) {
      const from = before.get(eip) ?? null;
      const to = after.get(eip) ?? null;
      if (from === to) continue;
      const info = nextEips.get(eip) ?? prevEips.get(eip);
      events.push({
        ...base,
        type: "fork_inclusion_change",
        eip,
        ...(info ? { title: info.title, track: info.track } : {}),
        upgrade: u.slug,
        from,
        to,
      });
    }

    // Activation timestamps gained or moved.
    for (const a of u.activations) {
      if (a.timestamp === undefined) continue;
      const old = p?.activations.find((x) => x.key === a.key)?.timestamp;
      if (old === a.timestamp) continue;
      events.push({
        ...base,
        type: "activation_scheduled",
        upgrade: u.slug,
        network: a.network,
        timestamp: a.timestamp,
        ...(old !== undefined ? { previous: old } : {}),
      });
    }

    // Blob parameters filled in (a TODO became a number, or a value changed).
    if (u.blobParams && isComplete(u.blobParams) && !sameParams(p?.blobParams, u.blobParams)) {
      events.push({ ...base, type: "blob_params_set", upgrade: u.slug, params: u.blobParams });
    }
  }

  return events;
}

function stageMap(u: Upgrade | undefined): Map<number, Stage> {
  return new Map((u?.eips ?? []).map((e) => [e.eip, e.stage]));
}

function isComplete(b: BlobParams): boolean {
  return b.target !== null && b.max !== null;
}

function sameParams(a: BlobParams | undefined, b: BlobParams): boolean {
  return !!a && a.target === b.target && a.max === b.max && a.baseFeeUpdateFraction === b.baseFeeUpdateFraction;
}

export function toJsonl(events: ChangeEvent[]): string {
  return events.map((e) => JSON.stringify(e)).join("\n") + (events.length ? "\n" : "");
}

export function parseJsonl(text: string): ChangeEvent[] {
  return text
    .split("\n")
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l) as ChangeEvent);
}
