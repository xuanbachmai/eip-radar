import { describe, expect, it } from "vitest";
import { diffSnapshots, parseJsonl, toJsonl } from "../lib/diff";
import type { CoreEip, Snapshot, Upgrade } from "../lib/types";

const eip = (n: number, status: CoreEip["status"], extra: Partial<CoreEip> = {}): CoreEip => ({
  eip: n,
  title: `EIP ${n}`,
  authors: [],
  status,
  type: "Standards Track",
  category: "Core",
  created: "2025-01-01",
  requires: [],
  track: "splurge",
  trackSource: "override",
  blob: "x",
  ...extra,
});

const upgrade = (slug: string, extra: Partial<Upgrade> = {}): Upgrade => ({
  slug,
  name: slug,
  kind: "meta",
  activations: [],
  eips: [],
  ...extra,
});

type S = Pick<Snapshot, "eips" | "upgrades">;
const meta = { at: "2026-09-29T00:00:00.000Z", commit: "abc123" };

describe("diffSnapshots", () => {
  it("returns nothing for identical snapshots", () => {
    const s: S = { eips: [eip(1, "Draft")], upgrades: [upgrade("glamsterdam")] };
    expect(diffSnapshots(s, s, meta)).toEqual([]);
  });

  it("emits status_change and new_eip", () => {
    const prev: S = { eips: [eip(7732, "Review")], upgrades: [] };
    const next: S = { eips: [eip(7732, "Last Call", { track: "scourge" }), eip(9999, "Draft")], upgrades: [] };
    expect(diffSnapshots(prev, next, meta)).toEqual([
      { ...meta, type: "status_change", eip: 7732, title: "EIP 7732", track: "scourge", from: "Review", to: "Last Call" },
      { ...meta, type: "new_eip", eip: 9999, title: "EIP 9999", track: "splurge", status: "Draft" },
    ]);
  });

  it("emits fork_inclusion_change for stage moves, additions and removals", () => {
    const prev: S = {
      eips: [eip(1, "Draft"), eip(2, "Draft")],
      upgrades: [
        upgrade("hegota", {
          eips: [
            { eip: 1, stage: "Proposed", section: "core" },
            { eip: 2, stage: "Considered", section: "core" },
          ],
        }),
      ],
    };
    const next: S = {
      eips: prev.eips,
      upgrades: [
        upgrade("hegota", {
          eips: [
            { eip: 1, stage: "Scheduled", section: "core" },
            { eip: 3, stage: "Proposed", section: "core" },
          ],
        }),
      ],
    };
    const ev = diffSnapshots(prev, next, meta).filter((e) => e.type === "fork_inclusion_change");
    expect(ev.map((e) => e.type === "fork_inclusion_change" && [e.eip, e.from, e.to])).toEqual([
      [1, "Proposed", "Scheduled"],
      [2, "Considered", null],
      [3, null, "Proposed"],
    ]);
  });

  it("emits activation_scheduled when a timestamp appears or moves", () => {
    const prev: S = {
      eips: [],
      upgrades: [
        upgrade("glamsterdam", {
          activations: [
            { network: "Sepolia", key: "sepolia", timestamp: 100_000_0000 },
            { network: "Mainnet", key: "mainnet" },
          ],
        }),
      ],
    };
    const next: S = {
      eips: [],
      upgrades: [
        upgrade("glamsterdam", {
          activations: [
            { network: "Sepolia", key: "sepolia", timestamp: 100_000_0000 },
            { network: "Mainnet", key: "mainnet", timestamp: 1_800_000_000 },
          ],
        }),
      ],
    };
    expect(diffSnapshots(prev, next, meta)).toEqual([
      { ...meta, type: "activation_scheduled", upgrade: "glamsterdam", network: "Mainnet", timestamp: 1_800_000_000 },
    ]);
  });

  it("emits blob_params_set only once TODOs are filled", () => {
    const todo = { target: null, max: null, baseFeeUpdateFraction: null };
    const filled = { target: 21, max: 32, baseFeeUpdateFraction: 1 };
    const s = (b: typeof todo | typeof filled): S => ({ eips: [], upgrades: [upgrade("bpo3", { kind: "bpo", blobParams: b })] });
    expect(diffSnapshots(s(todo), s(todo), meta)).toEqual([]);
    expect(diffSnapshots(s(todo), s(filled), meta)).toEqual([{ ...meta, type: "blob_params_set", upgrade: "bpo3", params: filled }]);
  });

  it("round-trips through JSONL", () => {
    const ev = diffSnapshots({ eips: [], upgrades: [] }, { eips: [eip(5, "Draft")], upgrades: [] }, meta);
    expect(parseJsonl(toJsonl(ev))).toEqual(ev);
    expect(toJsonl([])).toBe("");
  });
});
