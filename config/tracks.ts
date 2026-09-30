import type { Track } from "../lib/types";
import { TRACK_OVERRIDES } from "./track-overrides";

export { TRACK_OVERRIDES };

export const TRACK_META: Record<Track, { label: string; summary: string }> = {
  merge: { label: "Merge", summary: "Consensus and staking: PoS, finality, slots, validators, deposits and exits" },
  surge: { label: "Surge", summary: "Scaling through rollups: blobs, data availability sampling, calldata pricing" },
  scourge: {
    label: "Scourge",
    summary: "MEV and censorship resistance: PBS, inclusion lists, encrypted mempools, issuance",
  },
  verge: { label: "Verge", summary: "Cheap verification: stateless clients, state trees, access lists, SSZ, proofs" },
  purge: { label: "Purge", summary: "Simplify and shrink: SELFDESTRUCT, refunds, history and state growth" },
  splurge: {
    label: "Splurge",
    summary: "Everything else: EVM, precompiles, account abstraction, gas, cryptography",
  },
  legacy: { label: "Legacy PoW", summary: "Difficulty bomb, block rewards, Ethash (historical only)" },
};

/**
 * Ordered rules over `title + description`; first match wins. Order matters: scourge is tested
 * before merge so "proposer-builder" lands on scourge rather than on the generic "proposer".
 */
export const TRACK_RULES: ReadonlyArray<{ track: Track; pattern: RegExp }> = [
  { track: "legacy", pattern: /difficulty bomb|ice age|ethash|block reward|proof[- ]of[- ]work|\bPoW\b|\bmining\b/i },
  {
    track: "scourge",
    pattern: /proposer[- ]builder|\bPBS\b|inclusion list|\bFOCIL\b|mempool|encrypt|\bMEV\b|censorship|issuance/i,
  },
  { track: "surge", pattern: /\bblobs?\b|data availability|\bDAS\b|peerdas|calldata|rollup|\bBPO\b/i },
  {
    track: "merge",
    pattern:
      /validator|staking|\bstake\b|deposit|withdrawal|attestation|finality|\bslots?\b|\bepochs?\b|beacon|proposer|churn|slashing|committee|consensus layer/i,
  },
  {
    track: "verge",
    pattern: /stateless|verkle|binary (?:state )?tree|state tree|merkle|patricia|witness|access list|\bSSZ\b|proofs?\b|\bzk/i,
  },
  {
    track: "purge",
    pattern: /SELFDESTRUCT|refund|history expiry|state expiry|\bprune|\bremove|deprecat|bloom filter/i,
  },
];

export const FALLBACK_TRACK: Track = "splurge";

export interface Classification {
  track: Track;
  source: "override" | "rule";
  /** Index into TRACK_RULES, or -1 for the fallback. Absent for overrides. */
  rule?: number;
}

export function classifyTrack(
  eip: number,
  title: string,
  description = "",
  overrides: Readonly<Record<number, Track>> = TRACK_OVERRIDES,
): Classification {
  const override = overrides[eip];
  if (override) return { track: override, source: "override" };
  const text = `${title} ${description}`;
  const rule = TRACK_RULES.findIndex((r) => r.pattern.test(text));
  if (rule === -1) return { track: FALLBACK_TRACK, source: "rule", rule: -1 };
  return { track: TRACK_RULES[rule]!.track, source: "rule", rule };
}
