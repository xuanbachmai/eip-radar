// pnpm obsidian [outDir]
// Generate an Obsidian vault from data/snapshot.json so graph view shows how Core EIPs relate:
//   EIP ─requires→ EIP, EIP → upgrade (with inclusion stage), EIP → track, EIP → lineage, EIP → author.
// Default output: obsidian/EIP Radar (gitignored; regenerate after `pnpm sync`). Re-running replaces it.

import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { LINEAGES } from "../config/lineages";
import { TRACK_META } from "../config/tracks";
import { parseJsonl } from "../lib/diff";
import { membershipIndex, requiredBy, statusHistory, upgradeStatus } from "../lib/derive";
import { mainnetTimestamp } from "../lib/forks";
import { fmtDate, fmtDateTimeUtc } from "../lib/format";
import { TRACKS, type CoreEip, type Snapshot, type Track } from "../lib/types";

const out = resolve(process.argv[2] ?? "obsidian/EIP Radar");
const s = JSON.parse(readFileSync("data/snapshot.json", "utf8")) as Snapshot;
const changes = (() => {
  try {
    return parseJsonl(readFileSync("data/changes.jsonl", "utf8"));
  } catch {
    return [];
  }
})();

const TRACK_HEX: Record<Track, string> = {
  merge: "#2a78d6",
  surge: "#eb6834",
  scourge: "#1baf7a",
  verge: "#eda100",
  purge: "#e87ba4",
  splurge: "#008300",
  legacy: "#a3a39c",
};

// ---- names ------------------------------------------------------------------------------------
const safe = (name: string) => name.replace(/[\\/:*?"<>|#^[\]]/g, "").replace(/\s+/g, " ").trim();
const eipNote = (n: number) => `EIP-${n}`;
const trackNote = (t: Track) => `${TRACK_META[t].label} Track`;
const titleCase = (t: string) => t.replace(/\b[a-z]/g, (c) => c.toUpperCase());
const lineageNote = (title: string) => `${titleCase(title)} Lineage`;
/** Stop free text (abstracts, descriptions) from being read as wikilinks or embeds. */
const text = (t: string) => t.split("[[").join("[\\[").split("]]").join("]\\]");
const statusTag = (st: string) => `status/${st.toLowerCase().replace(/\s+/g, "-")}`;
const link = (note: string, label?: string) => (label ? `[[${note}|${label}]]` : `[[${note}]]`);

const core = new Map(s.eips.map((e) => [e.eip, e]));
const indexByNum = new Map(s.index.map((i) => [i.eip, i]));
const members = membershipIndex(s.upgrades);
const reqBy = requiredBy(s.eips);
const upgradeName = new Map(s.upgrades.map((u) => [u.slug, safe(u.name)]));

// Authors with 2+ Core EIPs get their own note (hubs in the graph); one-off authors stay plain text.
const authorKey = (a: { name: string; handle?: string }) => (safe(a.name) || a.handle || "").toLowerCase();
const authorCount = new Map<string, { name: string; handle?: string; eips: number[] }>();
for (const e of s.eips) {
  for (const a of e.authors) {
    const key = authorKey(a);
    const row = authorCount.get(key) ?? { name: a.name, handle: a.handle, eips: [] };
    row.handle ??= a.handle;
    if (!row.eips.includes(e.eip)) row.eips.push(e.eip);
    authorCount.set(key, row);
  }
}
const authorNote = new Map<string, string>();
for (const [key, a] of authorCount) if (a.eips.length >= 2) authorNote.set(key, safe(a.name) || safe(a.handle ?? key));

const lineageOf = new Map<number, { title: string; prev: number[]; next: number[] }[]>();
for (const l of LINEAGES) {
  l.steps.forEach((step, i) => {
    const here = Array.isArray(step) ? step : [step];
    const prev = i > 0 ? [l.steps[i - 1]!].flat() : [];
    const next = i < l.steps.length - 1 ? [l.steps[i + 1]!].flat() : [];
    for (const n of here) lineageOf.set(n, [...(lineageOf.get(n) ?? []), { title: l.title, prev, next }]);
  });
}

// ---- writers ----------------------------------------------------------------------------------
// Clear generated files but keep the folder (and any workspace state) so an open vault survives.
mkdirSync(join(out, ".obsidian"), { recursive: true });
for (const f of readdirSync(out)) if (/\.(md|canvas)$/.test(f)) rmSync(join(out, f));
let written = 0;
const write = (note: string, body: string) => {
  writeFileSync(join(out, `${note}.md`), body.trimEnd() + "\n");
  written++;
};
const yamlList = (xs: (string | number)[]) => (xs.length ? `\n${xs.map((x) => `  - ${JSON.stringify(x)}`).join("\n")}` : " []");

function eipBody(e: CoreEip): string {
  const ms = members.get(e.eip) ?? [];
  const lines: string[] = [];
  lines.push(`---`);
  lines.push(`eip: ${e.eip}`);
  lines.push(`title: ${JSON.stringify(e.title)}`);
  lines.push(`aliases:${yamlList([`EIP-${e.eip}: ${e.title}`, e.title])}`);
  lines.push(`status: ${e.status}`);
  lines.push(`track: ${e.track}`);
  lines.push(`created: ${e.created}`);
  lines.push(`upgrades:${yamlList(ms.map((m) => `${m.name} (${m.status === "shipped" ? "shipped" : m.stage})`))}`);
  lines.push(`authors:${yamlList(e.authors.map((a) => a.name))}`);
  lines.push(`tags:${yamlList(["eip", `track/${e.track}`, statusTag(e.status)])}`);
  lines.push(`---`);
  lines.push(`# EIP-${e.eip}: ${e.title}`);
  if (e.description) lines.push(``, `> ${text(e.description)}`);
  lines.push(``, `**Status:** ${e.status} · **Track:** ${link(trackNote(e.track))} · **Created:** ${fmtDate(e.created)}`);
  if (e.lastCallDeadline) lines.push(`**Last Call ends:** ${fmtDate(e.lastCallDeadline)}`);
  if (e.withdrawalReason) lines.push(`**Withdrawn because:** ${e.withdrawalReason}`);
  if (e.abstract) lines.push(``, `## Abstract`, text(e.abstract));

  lines.push(``, `## Relationships`);
  lines.push(`- **Requires:** ${e.requires.length ? e.requires.map((n) => link(eipNote(n))).join(", ") : "—"}`);
  const rb = reqBy.get(e.eip) ?? [];
  lines.push(`- **Required by:** ${rb.length ? rb.map((n) => link(eipNote(n))).join(", ") : "—"}`);
  lines.push(
    `- **Upgrades:** ${
      ms.length ? ms.map((m) => `${link(upgradeName.get(m.upgrade)!)} (${m.status === "shipped" && m.stage === "Scheduled" ? "shipped" : m.stage})`).join(", ") : "—"
    }`,
  );
  for (const l of lineageOf.get(e.eip) ?? []) {
    const fmt = (xs: number[]) => xs.map((n) => link(eipNote(n))).join(" / ");
    lines.push(`- **Lineage:** ${link(lineageNote(l.title))}${l.prev.length ? ` · after ${fmt(l.prev)}` : ""}${l.next.length ? ` · before ${fmt(l.next)}` : ""}`);
  }
  const authors = e.authors.map((a) => {
    const n = authorNote.get(authorKey(a));
    return n ? link(n) : a.name;
  });
  lines.push(`- **Authors:** ${authors.join(", ") || "—"}`);

  const hist = statusHistory(e, changes);
  if (hist.length > 1) {
    lines.push(``, `## Status history`);
    for (const h of hist) lines.push(`- ${h.status} — ${h.since ? fmtDate(h.since) : "date not observed"}`);
  }
  lines.push(``, `## Links`, `- [Specification](https://eips.ethereum.org/EIPS/eip-${e.eip})`);
  if (e.discussionsTo) lines.push(`- [Discussion](${e.discussionsTo})`);
  lines.push(`- [EIP Radar](https://eip-radar.vercel.app/eips/${e.eip})`, `- [Source](https://github.com/ethereum/EIPs/blob/master/EIPS/eip-${e.eip}.md)`);
  return lines.join("\n");
}

// Core EIPs
for (const e of s.eips) write(eipNote(e.eip), eipBody(e));

// Referenced but non-Core EIPs: small stub notes so links resolve and the graph shows them (greyed).
const referenced = new Set<number>();
for (const e of s.eips) e.requires.forEach((n) => referenced.add(n));
for (const l of LINEAGES) l.steps.flat().forEach((n) => referenced.add(n));
for (const n of referenced) {
  if (core.has(n)) continue;
  const i = indexByNum.get(n);
  write(
    eipNote(n),
    `---\neip: ${n}\ntags:\n  - eip\n  - non-core\n---\n# EIP-${n}${i?.title ? `: ${i.title}` : ""}\n\nNot a Core EIP (${[i?.type, i?.category, i?.status].filter(Boolean).join(" · ") || "not in ethereum/EIPs"}). Referenced by Core EIPs that require it.\n\n- **Required by:** ${(reqBy.get(n) ?? []).map((x) => link(eipNote(x))).join(", ") || "—"}\n- [Read it](https://eips.ethereum.org/EIPS/eip-${n})`,
  );
}

// Upgrades
s.upgrades.forEach((u, i) => {
  const name = upgradeName.get(u.slug)!;
  const state = upgradeStatus(u);
  const ts = mainnetTimestamp(u);
  const L: string[] = [
    `---`,
    `upgrade: ${u.slug}`,
    `kind: ${u.kind}`,
    `state: ${state}`,
    `mainnet: ${ts ? new Date(ts * 1000).toISOString().slice(0, 10) : "not set"}`,
    ...(u.metaEip ? [`meta_eip: ${u.metaEip}`] : []),
    `tags:${yamlList(["upgrade", `upgrade/${state}`])}`,
    `---`,
    `# ${name}${u.mascot ? ` — ${u.mascot}` : ""}`,
    ``,
    `**State:** ${state} · **Mainnet:** ${ts ? fmtDateTimeUtc(ts) : "not set"}${u.metaEip ? ` · **Meta EIP:** ${core.has(u.metaEip) ? link(eipNote(u.metaEip)) : `EIP-${u.metaEip}`}` : ""}`,
  ];
  if (u.parent) L.push(`Scheduled alongside ${link(upgradeName.get(u.parent)!)}.`);
  const prev = s.upgrades[i - 1];
  const next = s.upgrades[i + 1];
  L.push(`${prev ? `← ${link(upgradeName.get(prev.slug)!)}` : ""}${prev && next ? " · " : ""}${next ? `${link(upgradeName.get(next.slug)!)} →` : ""}`);
  if (u.blobParams) L.push(``, `**Blobs (target / max):** ${u.blobParams.target ?? "TBD"} / ${u.blobParams.max ?? "TBD"}`);
  for (const stage of ["Scheduled", "Considered", "Proposed", "Declined"] as const) {
    const list = u.eips.filter((m) => m.stage === stage && core.has(m.eip));
    if (!list.length) continue;
    L.push(``, `## ${state === "shipped" && stage === "Scheduled" ? "Included" : stage} (${list.length})`);
    for (const m of list) {
      const e = core.get(m.eip)!;
      L.push(`- ${link(eipNote(e.eip))} ${e.title} · ${e.status} · ${link(trackNote(e.track), TRACK_META[e.track].label)}`);
    }
  }
  if (u.activations.some((a) => a.timestamp || a.epoch)) {
    L.push(``, `## Activation`, `| Network | Epoch | Time (UTC) | Fork ID |`, `|---|---|---|---|`);
    for (const a of u.activations) L.push(`| ${a.network} | ${a.epoch ?? "—"} | ${a.timestamp ? fmtDateTimeUtc(a.timestamp) : "not set"} | ${a.forkId ?? "—"} |`);
  }
  L.push(``, `[[Upgrades Index]]`);
  write(name, L.join("\n"));
});

// Tracks
for (const t of TRACKS) {
  const mine = s.eips.filter((e) => e.track === t).sort((a, b) => a.eip - b.eip);
  const group = (title: string, statuses: string[]) => {
    const list = mine.filter((e) => statuses.includes(e.status));
    return list.length ? [``, `## ${title} (${list.length})`, ...list.map((e) => `- ${link(eipNote(e.eip))} ${e.title} · ${e.status}`)] : [];
  };
  write(
    trackNote(t),
    [
      `---`,
      `tags:${yamlList(["track", `track/${t}`])}`,
      `---`,
      `# ${TRACK_META[t].label} Track`,
      ``,
      `> ${TRACK_META[t].summary}`,
      ``,
      `${mine.length} Core EIPs.`,
      ...LINEAGES.filter((l) => l.track === t).map((l) => `Lineage: ${link(lineageNote(l.title))}`),
      ...group("Shipped", ["Final"]),
      ...group("In motion", ["Last Call", "Review", "Draft"]),
      ...group("Dead", ["Stagnant", "Withdrawn"]),
      ``,
      `[[Tracks Index]]`,
    ].join("\n"),
  );
}

// Lineages
for (const l of LINEAGES) {
  const steps = l.steps.map((step, i) => {
    const ns = Array.isArray(step) ? step : [step];
    return `${i + 1}. ${ns.map((n) => `${link(eipNote(n))} ${core.get(n)?.title ?? indexByNum.get(n)?.title ?? ""} (${core.get(n)?.status ?? "not Core"})`).join(" **/** ")}`;
  });
  write(
    lineageNote(l.title),
    [`---`, `tags:${yamlList(["lineage", `track/${l.track}`])}`, `---`, `# ${titleCase(l.title)} Lineage`, ``, `> ${l.summary}`, ``, `Track: ${link(trackNote(l.track))}`, ``, ...steps, ``, `[[EIP Radar Index]]`].join(
      "\n",
    ),
  );
}

// Authors
for (const [key, note] of authorNote) {
  const a = authorCount.get(key)!;
  const list = a.eips.sort((x, y) => x - y).map((n) => `- ${link(eipNote(n))} ${core.get(n)!.title} · ${core.get(n)!.status}`);
  write(note, [`---`, `tags:${yamlList(["author"])}`, `---`, `# ${a.name}`, a.handle ? `\nGitHub: [@${a.handle}](https://github.com/${a.handle})` : "", ``, `${a.eips.length} Core EIPs:`, ...list, ``, `[[Authors Index]]`].join("\n"));
}

// Indexes
write("Upgrades Index", [`# Upgrades Index`, ``, ...[...s.upgrades].reverse().map((u) => `- ${link(upgradeName.get(u.slug)!)} · ${upgradeStatus(u)}`)].join("\n"));
write("Tracks Index", [`# Tracks Index`, ``, ...TRACKS.map((t) => `- ${link(trackNote(t))} · ${s.eips.filter((e) => e.track === t).length} EIPs`)].join("\n"));
write(
  "Authors Index",
  [`# Authors Index`, ``, ...[...authorNote].sort((a, b) => authorCount.get(b[0])!.eips.length - authorCount.get(a[0])!.eips.length).map(([k, n]) => `- ${link(n)} · ${authorCount.get(k)!.eips.length}`)].join("\n"),
);
write(
  "EIP Radar Index",
  [
    `# EIP Radar Index`,
    ``,
    `Generated from ethereum/EIPs @ \`${s.source.commitSha.slice(0, 7)}\` on ${fmtDateTimeUtc(s.generatedAt)}. ${s.eips.length} Core EIPs.`,
    ``,
    `Open **graph view** (Ctrl/Cmd+G). Colours: track of each EIP · upgrades white · authors grey. Try the filter \`tag:#track/scourge\` or open the local graph of any EIP.`,
    ``,
    `- [[Upgrades Index]]`,
    `- [[Tracks Index]]`,
    `- [[Authors Index]]`,
    `- Lineages: ${LINEAGES.map((l) => link(lineageNote(l.title))).join(", ")}`,
    `- Canvas: [[Upgrade Timeline.canvas|Upgrade Timeline]]`,
  ].join("\n"),
);

// ---- Obsidian config: graph colours by track, sensible graph defaults ------------------------
const rgb = (hex: string) => parseInt(hex.slice(1), 16);
const colorGroups = [
  ...TRACKS.map((t) => ({ query: `tag:#track/${t} tag:#eip`, color: { a: 1, rgb: rgb(TRACK_HEX[t]) } })),
  { query: "tag:#upgrade", color: { a: 1, rgb: rgb("#f4f6f8") } },
  { query: "tag:#track", color: { a: 1, rgb: rgb("#ffd166") } },
  { query: "tag:#lineage", color: { a: 1, rgb: rgb("#c77dff") } },
  { query: "tag:#author", color: { a: 1, rgb: rgb("#6e7681") } },
  { query: "tag:#non-core", color: { a: 1, rgb: rgb("#3d4652") } },
];
writeFileSync(
  join(out, ".obsidian", "graph.json"),
  JSON.stringify(
    {
      "collapse-filter": false,
      search: "-file:Index",
      showTags: false,
      showAttachments: false,
      hideUnresolved: true,
      showOrphans: false,
      "collapse-color-groups": false,
      colorGroups,
      "collapse-display": false,
      showArrow: true,
      textFadeMultiplier: -1,
      nodeSizeMultiplier: 1.2,
      lineSizeMultiplier: 0.6,
      "collapse-forces": false,
      centerStrength: 0.5,
      repelStrength: 12,
      linkStrength: 1,
      linkDistance: 180,
      scale: 0.35,
      close: false,
    },
    null,
    2,
  ),
);
writeFileSync(join(out, ".obsidian", "app.json"), JSON.stringify({ alwaysUpdateLinks: true, showFrontmatter: false }, null, 2));

// ---- Canvas: upgrade timeline (columns of scheduled EIPs under each upgrade) ------------------
const nodes: object[] = [];
const edges: object[] = [];
const colW = 260;
const recent = s.upgrades.filter((u) => u.kind !== "legacy" || ["berlin", "london", "paris", "shapella"].includes(u.slug));
recent.forEach((u, i) => {
  const name = upgradeName.get(u.slug)!;
  const id = `u-${u.slug}`;
  nodes.push({ id, type: "file", file: `${name}.md`, x: i * colW, y: 0, width: 220, height: 80, color: upgradeStatus(u) === "shipped" ? "4" : "3" });
  if (i > 0) edges.push({ id: `e-${i}`, fromNode: `u-${recent[i - 1]!.slug}`, fromSide: "right", toNode: id, toSide: "left" });
  u.eips
    .filter((m) => m.stage === "Scheduled" && core.has(m.eip))
    .forEach((m, j) => {
      const e = core.get(m.eip)!;
      nodes.push({ id: `${id}-${e.eip}`, type: "file", file: `${eipNote(e.eip)}.md`, x: i * colW + 10, y: 120 + j * 70, width: 200, height: 56, color: TRACK_HEX[e.track] });
    });
});
writeFileSync(join(out, "Upgrade Timeline.canvas"), JSON.stringify({ nodes, edges }, null, 2));

console.log(`Wrote ${written} notes + graph config + canvas to ${out}`);
console.log(`  ${s.eips.length} Core EIPs, ${[...referenced].filter((n) => !core.has(n)).length} non-Core stubs, ${s.upgrades.length} upgrades, ${TRACKS.length} tracks, ${LINEAGES.length} lineages, ${authorNote.size} authors`);
