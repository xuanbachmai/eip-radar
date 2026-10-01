import { describe, expect, it } from "vitest";
import { describeGroup, groupEvents } from "../lib/events";
import { PAGES, search } from "../lib/search";
import type { ChangeEvent } from "../lib/types";

const at = "2026-09-24T16:44:05.000Z";
const move = (eip: number, from: "Proposed" | "Considered", to: "Considered" | "Declined", commit = "c1"): ChangeEvent => ({
  at,
  commit,
  type: "fork_inclusion_change",
  eip,
  title: `EIP ${eip}`,
  track: "splurge",
  upgrade: "hegota",
  from,
  to,
});

describe("groupEvents", () => {
  it("collapses one commit's identical transitions into a group", () => {
    const events = [move(1, "Proposed", "Considered"), move(2, "Proposed", "Considered"), move(3, "Proposed", "Declined")];
    const groups = groupEvents(events);
    expect(groups.map((g) => g.events.length)).toEqual([2, 1]);
    expect(describeGroup(groups[0]!, () => "Hegotá")).toBe("Hegotá: 2 EIPs Proposed → Considered");
  });

  it("keeps different commits apart and sorts newest first", () => {
    const old: ChangeEvent = { ...move(1, "Proposed", "Considered", "c0"), at: "2026-09-01T00:00:00Z" };
    const groups = groupEvents([old, move(2, "Proposed", "Considered", "c1")]);
    expect(groups.map((g) => g.commit)).toEqual(["c1", "c0"]);
  });
});

describe("palette search", () => {
  const index = {
    eips: [
      [7805, "Fork-choice enforced Inclusion Lists (FOCIL)", "Draft", "scourge"],
      [780, "Something else", "Stagnant", "splurge"],
      [7732, "Enshrined Proposer-Builder Separation", "Review", "scourge"],
    ] as [number, string, string, string][],
    upgrades: [["glamsterdam", "Glamsterdam"]] as [string, string][],
    tracks: [["scourge", "Scourge"]] as [string, string][],
  };

  it("lists pages for an empty query", () => {
    expect(search(index, "")).toEqual(PAGES);
  });
  it("ranks an exact number first, accepting an EIP- prefix", () => {
    expect(search(index, "EIP-7805")[0]).toMatchObject({ href: "/eips/7805" });
    expect(search(index, "780")[0]).toMatchObject({ href: "/eips/780" });
  });
  it("matches every word of a title query", () => {
    expect(search(index, "proposer separation").map((h) => h.href)).toEqual(["/eips/7732"]);
    expect(search(index, "focil")[0]).toMatchObject({ label: "EIP-7805" });
  });
  it("finds upgrades and tracks by name", () => {
    expect(search(index, "glams")[0]).toMatchObject({ kind: "Upgrade", href: "/upgrades/glamsterdam" });
    expect(search(index, "scourge")[0]).toMatchObject({ kind: "Track" });
  });
});
