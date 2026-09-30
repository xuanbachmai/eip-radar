// pnpm triage — list Core EIPs whose track came from the regex rules rather than the override map,
// so the map in config/track-overrides.ts can be extended. Fallbacks to splurge are listed first.

import { readFileSync } from "node:fs";
import { TRACK_OVERRIDES, TRACK_RULES, classifyTrack } from "../config/tracks";
import type { Snapshot } from "../lib/types";

const s = JSON.parse(readFileSync("data/snapshot.json", "utf8")) as Snapshot;
const unmapped = s.eips.filter((e) => !TRACK_OVERRIDES[e.eip]);
const stale = Object.keys(TRACK_OVERRIDES)
  .map(Number)
  .filter((n) => !s.eips.some((e) => e.eip === n));

const rows = unmapped
  .map((e) => {
    const c = classifyTrack(e.eip, e.title, e.description);
    const rule = c.rule === undefined || c.rule < 0 ? "fallback" : TRACK_RULES[c.rule]!.pattern.source.slice(0, 40);
    return { eip: e.eip, status: e.status, track: c.track, rule, title: e.title.slice(0, 60) };
  })
  .sort((a, b) => Number(b.rule === "fallback") - Number(a.rule === "fallback") || a.eip - b.eip);

console.log(`${s.eips.length} Core EIPs; ${s.eips.length - unmapped.length} in the override map; ${unmapped.length} rule-classified.\n`);
if (rows.length) {
  console.table(rows);
  console.log("Paste reviewed entries into config/track-overrides.ts:\n");
  for (const r of rows) console.log(`  ${r.eip}: "${r.track}",   // ${r.title}`);
} else {
  console.log("Nothing to triage.");
}
if (stale.length) console.log(`\nOverride entries for EIPs no longer Core: ${stale.join(", ")}`);
