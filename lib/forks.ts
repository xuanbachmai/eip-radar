// Hardfork Meta EIP parsing → upgrades, inclusion stages, activation tables, blob parameters.

import { BLOB_SCHEDULE_ALIASES, FIRST_PARSED_META_EIP, LEGACY_FORKS } from "../config/upgrades";
import { parseTable, splitSections, type MarkdownTable, type ParsedEip } from "./parse";
import type { Activation, BlobParams, Stage, Upgrade, UpgradeEip } from "./types";

const META_TITLE = /^Hardfork Meta\s*[-–—:]\s*(.+?)\s*$/i;
const BPO_NAME = /^BPO[\s-]*(\d+)$/i;

/** Upgrade name if this EIP is a parseable Hardfork Meta ("Hardfork Meta - Pectra" → "Pectra"). */
export function hardforkMetaName(eip: number, title: string): string | undefined {
  if (eip < FIRST_PARSED_META_EIP) return undefined;
  return META_TITLE.exec(title)?.[1];
}

export function slugify(name: string): string {
  const bpo = BPO_NAME.exec(name.trim());
  if (bpo) return `bpo${bpo[1]}`;
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\(.*?\)/g, "")
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function networkKey(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

export interface ParsedMeta {
  eip: number;
  name: string;
  slug: string;
  status: string;
  eips: UpgradeEip[];
  activations: Activation[];
  mascot?: string;
  /** BPO activation tables embedded in a parent fork's meta EIP, keyed by BPO slug. */
  bpoActivations: Record<string, Activation[]>;
  /** For BPO metas: their own parameters. */
  blobParams?: BlobParams;
  /** For BPO metas: mainnet activation time from the parameters table. */
  blobActivation?: number | null;
  /** Earlier blob schedules restated in "Historical Context" tables, keyed by upgrade slug. */
  historicalBlobParams: Record<string, BlobParams>;
}

function stageOf(heading: string): Stage | undefined {
  const h = heading.toLowerCase();
  if (/declined/.test(h)) return "Declined";
  if (/proposed for inclusion/.test(h)) return "Proposed";
  if (/considered for inclusion/.test(h)) return "Considered";
  if (/scheduled for inclusion|included eips|^included$/.test(h)) return "Scheduled";
  return undefined;
}

const OTHER_HEADING = /\bother\b|networking|informational|interface|meta eips/i;
const LIST_HEADING = /\beips?\b|inclusion|included/i;

export function parseHardforkMeta(meta: ParsedEip): ParsedMeta {
  const name = hardforkMetaName(meta.eip, meta.title);
  if (!name) throw new Error(`EIP-${meta.eip} is not a Hardfork Meta EIP`);
  const slug = slugify(name);
  const sections = splitSections(meta.body);

  // --- inclusion lists -------------------------------------------------------
  // Walk headings keeping a stack; a bullet's stage comes from the nearest ancestor heading that
  // names a stage. Sections under "Other EIPs" inherit the enclosing stage (or Scheduled at top level).
  const eips = new Map<number, UpgradeEip>();
  const stack: { level: number; heading: string }[] = [];
  for (const s of sections) {
    if (s.level === 0) continue;
    while (stack.length && stack[stack.length - 1]!.level >= s.level) stack.pop();
    stack.push({ level: s.level, heading: s.heading });

    const inList = stack.some((h) => LIST_HEADING.test(h.heading) && !/full spec/i.test(h.heading));
    if (!inList || stack.some((h) => /activation|mascot|full spec|rationale|blob parameter/i.test(h.heading))) {
      continue;
    }
    const other = stack.some((h) => OTHER_HEADING.test(h.heading));
    let stage: Stage | undefined;
    for (let i = stack.length - 1; i >= 0 && !stage; i--) stage = stageOf(stack[i]!.heading);
    stage ??= other ? "Scheduled" : undefined;
    if (!stage) continue;

    for (const m of s.content.matchAll(/^\s*[*-]\s+\[EIP-(\d+)\]/gm)) {
      const n = Number(m[1]);
      if (n === meta.eip) continue;
      // Later (more specific) listings win; an EIP appears once per upgrade.
      eips.set(n, { eip: n, stage, section: other ? "other" : "core" });
    }
  }

  // --- activation tables -----------------------------------------------------
  let activations: Activation[] = [];
  const bpoActivations: Record<string, Activation[]> = {};
  let inBpoBlock = false;
  for (const s of sections) {
    if (s.level === 0) continue;
    if (/^activation$/i.test(s.heading.trim())) {
      inBpoBlock = false;
      const t = parseTable(s.content);
      if (t) activations = parseActivationTable(t);
      continue;
    }
    if (/blob parameter only/i.test(s.heading)) {
      inBpoBlock = true;
      continue;
    }
    const bpo = BPO_NAME.exec(s.heading.trim());
    if (inBpoBlock && bpo) {
      const t = parseTable(s.content);
      if (t) bpoActivations[`bpo${bpo[1]}`] = parseActivationTable(t);
    } else if (s.level <= 2) inBpoBlock = false;
  }

  // --- mascot ----------------------------------------------------------------
  const mascotSection = sections.find((s) => /^mascot$/i.test(s.heading.trim()));
  const mascot = mascotSection
    ? /^\s*(.+?)\s+(?:is|was) the mascot/im.exec(mascotSection.content)?.[1]?.trim()
    : undefined;

  // --- blob parameters -------------------------------------------------------
  let blobParams: BlobParams | undefined;
  let blobActivation: number | null | undefined;
  const historicalBlobParams: Record<string, BlobParams> = {};
  for (const s of sections) {
    const t = parseTable(s.content);
    if (!t) continue;
    const h = t.header.map((c) => c.toLowerCase());
    if (h[0] === "field" && h[1] === "value") {
      const field = (re: RegExp) => t.rows.find((r) => re.test(r[0] ?? ""))?.[1];
      if (field(/blob target/i) === undefined) continue;
      blobParams = {
        target: parseNum(field(/blob target/i)),
        max: parseNum(field(/blob max/i)),
        baseFeeUpdateFraction: parseNum(field(/base fee update fraction/i)),
      };
      blobActivation = parseNum(field(/activation time/i));
    } else if (/upgrade/.test(h[0] ?? "") && h.some((c) => /blob target/.test(c))) {
      const col = (re: RegExp) => h.findIndex((c) => re.test(c));
      const [ti, mi, fi] = [col(/blob target/), col(/blob max/), col(/base fee/)];
      for (const r of t.rows) {
        const raw = (r[0] ?? "").replace(/[*_`]/g, "").trim();
        const key = BLOB_SCHEDULE_ALIASES[raw.toLowerCase()] ?? slugify(raw);
        historicalBlobParams[key] = {
          target: parseNum(r[ti]),
          max: parseNum(r[mi]),
          baseFeeUpdateFraction: fi === -1 ? null : parseNum(r[fi]),
        };
      }
    }
  }

  return {
    eip: meta.eip,
    name,
    slug,
    status: meta.status,
    eips: [...eips.values()].sort((a, b) => a.eip - b.eip),
    activations,
    mascot,
    bpoActivations,
    blobParams,
    blobActivation,
    historicalBlobParams,
  };
}

/** Parse "1,234", "`1746612311`", "1791294816 (2026-10-06 …)", "<!-- TODO -->" → number | null. */
export function parseNum(cell: string | undefined): number | null {
  if (!cell) return null;
  const clean = cell.replace(/<!--[\s\S]*?-->/g, "").replace(/`/g, "");
  const m = /\d[\d,_]*/.exec(clean);
  return m ? Number(m[0].replace(/[,_]/g, "")) : null;
}

export function parseActivationTable(t: MarkdownTable): Activation[] {
  const col = (re: RegExp) => t.header.findIndex((c) => re.test(c));
  const [ni, ei, ti, fi] = [col(/network/i), col(/epoch/i), col(/timestamp/i), col(/fork id/i)];
  const out: Activation[] = [];
  for (const r of t.rows) {
    const network = (r[ni === -1 ? 0 : ni] ?? "").replace(/[*`]/g, "").trim();
    if (!network) continue;
    const a: Activation = { network, key: networkKey(network) };
    const epoch = ei === -1 ? null : parseNum(r[ei]);
    const ts = ti === -1 ? null : parseNum(r[ti]);
    const forkId = fi === -1 ? undefined : /0x[0-9a-f]+/i.exec(r[fi] ?? "")?.[0]?.toLowerCase();
    if (epoch !== null) a.epoch = epoch;
    if (ts !== null && ts > 1e9) a.timestamp = ts;
    if (forkId) a.forkId = forkId;
    out.push(a);
  }
  return out;
}

function mergeActivations(a: Activation[], b: Activation[]): Activation[] {
  const byKey = new Map(a.map((x) => [x.key, { ...x }]));
  for (const x of b) byKey.set(x.key, { ...x, ...byKey.get(x.key), ...definedOnly(x) });
  return [...byKey.values()];
}

function definedOnly<T extends object>(o: T): Partial<T> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>;
}

export function mainnetTimestamp(u: Pick<Upgrade, "activations">): number | undefined {
  return u.activations.find((a) => a.key === "mainnet")?.timestamp;
}

/** Assemble the full upgrade list: static legacy forks + everything parsed from meta EIPs. */
export function buildUpgrades(metas: ParsedMeta[]): Upgrade[] {
  const upgrades: Upgrade[] = LEGACY_FORKS.map((f) => ({
    slug: f.slug,
    name: f.name,
    kind: "legacy" as const,
    ...(f.mascot ? { mascot: f.mascot } : {}),
    activations: [{ network: "Mainnet", key: "mainnet", timestamp: Date.parse(`${f.mainnet}T00:00:00Z`) / 1000 }],
    eips: f.eips.map((eip) => ({ eip, stage: "Scheduled" as const, section: "core" as const })),
  }));

  const historical: Record<string, BlobParams> = {};
  for (const m of metas) Object.assign(historical, m.historicalBlobParams);

  const parentOf = new Map<string, { slug: string; activations: Activation[] }>();
  for (const m of metas) {
    for (const [bpo, acts] of Object.entries(m.bpoActivations)) parentOf.set(bpo, { slug: m.slug, activations: acts });
  }

  for (const m of metas) {
    const isBpo = BPO_NAME.test(m.name.trim());
    const parent = parentOf.get(m.slug);
    let activations = m.activations;
    if (parent) activations = mergeActivations(parent.activations, activations);
    if (isBpo && m.blobActivation && !activations.some((a) => a.key === "mainnet" && a.timestamp)) {
      activations = mergeActivations(activations, [
        { network: "Mainnet", key: "mainnet", timestamp: m.blobActivation },
      ]);
    }
    const blobParams = m.blobParams ?? historical[m.slug];
    upgrades.push({
      slug: m.slug,
      name: isBpo ? `BPO${BPO_NAME.exec(m.name.trim())![1]}` : m.name,
      kind: isBpo ? "bpo" : "meta",
      metaEip: m.eip,
      metaStatus: m.status,
      ...(parent ? { parent: parent.slug } : {}),
      ...(m.mascot ? { mascot: m.mascot } : {}),
      activations,
      eips: m.eips,
      ...(blobParams ? { blobParams } : {}),
    });
  }

  // BPOs whose own meta EIP doesn't exist yet but are scheduled inside a parent fork.
  for (const [slug, p] of parentOf) {
    if (upgrades.some((u) => u.slug === slug)) continue;
    upgrades.push({
      slug,
      name: slug.toUpperCase(),
      kind: "bpo",
      parent: p.slug,
      activations: p.activations,
      eips: [],
      ...(historical[slug] ? { blobParams: historical[slug] } : {}),
    });
  }

  return sortUpgrades(upgrades);
}

/** Dated upgrades by mainnet activation; undated ones after, by meta EIP number. */
export function sortUpgrades(upgrades: Upgrade[]): Upgrade[] {
  return [...upgrades].sort((a, b) => {
    const ta = mainnetTimestamp(a);
    const tb = mainnetTimestamp(b);
    if (ta !== undefined && tb !== undefined) return ta - tb;
    if (ta !== undefined) return -1;
    if (tb !== undefined) return 1;
    return (a.metaEip ?? Infinity) - (b.metaEip ?? Infinity);
  });
}

/** Membership of one EIP across every upgrade, in upgrade order. */
export function upgradesForEip(eip: number, upgrades: Upgrade[]): { upgrade: string; stage: Stage }[] {
  const out: { upgrade: string; stage: Stage }[] = [];
  for (const u of upgrades) {
    const hit = u.eips.find((e) => e.eip === eip);
    if (hit) out.push({ upgrade: u.slug, stage: hit.stage });
  }
  return out;
}
