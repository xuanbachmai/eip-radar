// Colour lookups as CSS custom properties, so charts follow the active theme without re-rendering.

import type { Track } from "./types";

export const trackColor = (t: Track) => `var(--track-${t})`;

const STATUS_VAR: Record<string, string> = {
  Final: "var(--status-final)",
  "Last Call": "var(--status-last-call)",
  Review: "var(--status-review)",
  Draft: "var(--status-draft)",
  Stagnant: "var(--status-stagnant)",
  Withdrawn: "var(--status-withdrawn)",
};

export const statusColor = (s: string) => STATUS_VAR[s] ?? "var(--faint)";

export const TRACK_LABEL: Record<Track, string> = {
  merge: "Merge",
  surge: "Surge",
  scourge: "Scourge",
  verge: "Verge",
  purge: "Purge",
  splurge: "Splurge",
  legacy: "Legacy PoW",
};

/** Small glyph per track so colour is never the only encoding (used in chips and legends). */
export const TRACK_GLYPH: Record<Track, string> = {
  merge: "M",
  surge: "S",
  scourge: "C",
  verge: "V",
  purge: "P",
  splurge: "X",
  legacy: "L",
};
