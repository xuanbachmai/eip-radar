import { describe, expect, it } from "vitest";
import { FALLBACK_TRACK, TRACK_OVERRIDES, classifyTrack } from "../config/tracks";
import { TRACKS } from "../lib/types";

describe("classifyTrack", () => {
  it("override wins over a matching rule", () => {
    // EIP-4844's title mentions blobs (→ surge by rule) and the override agrees; use a synthetic
    // override that disagrees to prove precedence.
    expect(classifyTrack(4844, "Shard Blob Transactions", "", { 4844: "verge" })).toEqual({ track: "verge", source: "override" });
  });

  it("uses the seeded override map by default", () => {
    expect(classifyTrack(7732, "Enshrined Proposer-Builder Separation")).toEqual({ track: "scourge", source: "override" });
    expect(classifyTrack(2384, "Muir Glacier Difficulty Bomb Delay")).toEqual({ track: "legacy", source: "override" });
  });

  it.each([
    ["Delay difficulty bomb again", "legacy"],
    ["Encrypted mempool for proposer-builder separation", "scourge"],
    ["Increase blob throughput", "surge"],
    ["Raise validator churn limit", "merge"],
    ["Binary state tree conversion", "verge"],
    ["Remove SELFDESTRUCT entirely", "purge"],
  ])("rule: %s → %s", (title, track) => {
    expect(classifyTrack(99_999, title, "", {})).toMatchObject({ track, source: "rule" });
  });

  it("unknown EIPs fall back to splurge and are flagged for triage", () => {
    expect(classifyTrack(99_999, "PAY opcode", "", {})).toEqual({ track: FALLBACK_TRACK, source: "rule", rule: -1 });
  });

  it("override map is complete and only uses known tracks", () => {
    expect(Object.keys(TRACK_OVERRIDES)).toHaveLength(436);
    for (const t of Object.values(TRACK_OVERRIDES)) expect(TRACKS).toContain(t);
  });
});
