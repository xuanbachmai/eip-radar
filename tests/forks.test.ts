import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildUpgrades, hardforkMetaName, mainnetTimestamp, parseHardforkMeta, slugify } from "../lib/forks";
import { parseEip } from "../lib/parse";

const meta = (n: number) =>
  parseHardforkMeta(parseEip(readFileSync(join(__dirname, "fixtures/meta", `eip-${n}.md`), "utf8"), `EIPS/eip-${n}.md`));

describe("hardforkMetaName / slugify", () => {
  it("recognises modern meta EIPs only", () => {
    expect(hardforkMetaName(7773, "Hardfork Meta - Glamsterdam")).toBe("Glamsterdam");
    expect(hardforkMetaName(609, "Hardfork Meta: Byzantium")).toBeUndefined();
    expect(hardforkMetaName(7568, "Hardfork Meta Backfill - Berlin to Shapella")).toBeUndefined();
  });
  it("slugifies accents and BPO names", () => {
    expect(slugify("Hegotá")).toBe("hegota");
    expect(slugify("BPO-3")).toBe("bpo3");
    expect(slugify("BPO 1")).toBe("bpo1");
  });
});

describe("EIP-7600 Pectra", () => {
  const m = meta(7600);
  it("lists included Core EIPs as Scheduled and separates Other EIPs", () => {
    const core = m.eips.filter((e) => e.section === "core").map((e) => e.eip);
    expect(core).toEqual([2537, 2935, 6110, 7002, 7251, 7549, 7623, 7685, 7691, 7702]);
    expect(m.eips.filter((e) => e.section === "other").map((e) => e.eip)).toEqual([7642, 7840]);
    expect(new Set(m.eips.map((e) => e.stage))).toEqual(new Set(["Scheduled"]));
  });
  it("parses the backticked activation table", () => {
    expect(m.activations.map((a) => a.key)).toEqual(["holesky", "sepolia", "hoodi", "mainnet"]);
    expect(m.activations[3]).toEqual({ network: "Mainnet", key: "mainnet", epoch: 364032, timestamp: 1746612311 });
  });
});

describe("EIP-7607 Fusaka", () => {
  const m = meta(7607);
  it("reads fork IDs and embedded BPO schedules", () => {
    expect(m.activations.find((a) => a.key === "mainnet")).toMatchObject({ timestamp: 1764798551, forkId: "0x5167e2a6" });
    expect(Object.keys(m.bpoActivations)).toEqual(["bpo1", "bpo2"]);
    expect(m.bpoActivations.bpo2!.find((a) => a.key === "mainnet")).toMatchObject({ epoch: 419072, timestamp: 1767747671 });
  });
  it("does not treat BPO table rows as EIPs", () => {
    expect(m.eips.filter((e) => e.section === "core")).toHaveLength(9);
  });
});

describe("EIP-7773 Glamsterdam", () => {
  const m = meta(7773);
  it("has 18 scheduled Core-section EIPs including ePBS and BALs", () => {
    const sched = m.eips.filter((e) => e.stage === "Scheduled" && e.section === "core").map((e) => e.eip);
    expect(sched).toHaveLength(18);
    expect(sched).toEqual(expect.arrayContaining([7732, 7928]));
  });
  it("marks networking/informational EIPs as other", () => {
    expect(m.eips.find((e) => e.eip === 8070)).toMatchObject({ section: "other" });
    expect(m.eips.find((e) => e.eip === 7904)).toMatchObject({ section: "other" });
  });
  it("reads the mascot and a partially filled activation table", () => {
    expect(m.mascot).toMatch(/^Polar bear/);
    expect(m.activations.find((a) => a.key === "sepolia")).toMatchObject({ epoch: 353024, timestamp: 1791294816 });
    expect(m.activations.find((a) => a.key === "mainnet")).toEqual({ network: "Mainnet", key: "mainnet" });
  });
});

describe("EIP-8081 Hegotá", () => {
  const m = meta(8081);
  const stage = (s: string) => m.eips.filter((e) => e.stage === s).map((e) => e.eip);
  it("splits all four stages", () => {
    expect(stage("Scheduled")).toEqual([7805, 8141]);
    expect(stage("Considered")).toContain(3298);
    expect(stage("Proposed")).toContain(4758);
    expect(stage("Declined")).toContain(7645);
  });
  it("ignores inline links to other EIPs inside a bullet", () => {
    expect(m.eips.some((e) => e.eip === 20)).toBe(false);
  });
  it("has no dates yet", () => {
    expect(m.activations.every((a) => a.timestamp === undefined)).toBe(true);
  });
});

describe("BPO metas", () => {
  it("EIP-8134 reads blob params and the historical schedule", () => {
    const m = meta(8134);
    expect(m.blobParams).toEqual({ target: 10, max: 15, baseFeeUpdateFraction: 8346193 });
    expect(m.blobActivation).toBe(1765290071);
    expect(m.historicalBlobParams.dencun).toEqual({ target: 3, max: 6, baseFeeUpdateFraction: 3338477 });
    expect(m.historicalBlobParams.pectra).toEqual({ target: 6, max: 9, baseFeeUpdateFraction: 5007716 });
  });
  it("EIP-8138 leaves TODO values open", () => {
    const m = meta(8138);
    expect(m.blobParams).toEqual({ target: null, max: null, baseFeeUpdateFraction: null });
    expect(m.blobActivation).toBeNull();
  });
});

describe("buildUpgrades", () => {
  const upgrades = buildUpgrades([7569, 7600, 7607, 7773, 8081, 8134, 8135, 8138].map(meta));
  const bySlug = Object.fromEntries(upgrades.map((u) => [u.slug, u]));

  it("prepends static legacy forks and orders by mainnet date, undated last", () => {
    expect(upgrades[0]!.slug).toBe("homestead");
    const slugs = upgrades.map((u) => u.slug);
    expect(slugs.slice(-6)).toEqual(["fusaka", "bpo1", "bpo2", "glamsterdam", "hegota", "bpo3"]);
  });
  it("merges BPO activations from the parent fork with the BPO's own params", () => {
    expect(bySlug.bpo1).toMatchObject({ kind: "bpo", parent: "fusaka", name: "BPO1" });
    expect(bySlug.bpo1!.activations.find((a) => a.key === "sepolia")?.forkId).toBe("0x56078a1e");
    expect(bySlug.bpo1!.blobParams).toMatchObject({ target: 10, max: 15 });
  });
  it("backfills Dencun and Pectra blob params from historical tables", () => {
    expect(bySlug.dencun!.blobParams).toMatchObject({ target: 3, max: 6 });
    expect(bySlug.pectra!.blobParams).toMatchObject({ target: 6, max: 9 });
  });
  it("gives BPO3 no mainnet date", () => {
    expect(mainnetTimestamp(bySlug.bpo3!)).toBeUndefined();
  });
});
