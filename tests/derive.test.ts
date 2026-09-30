import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { describeEvent } from "../lib/events";
import { ageToActivation, authorActivity, blobSchedule, creationByYear, lastVisitCount, median, statusHistory } from "../lib/derive";
import { freshnessLevel, relativeTime, toCsv } from "../lib/format";
import { buildRows } from "../lib/rows";
import { TRACKS, type ChangeEvent, type CoreEip, type Snapshot } from "../lib/types";

const snapshot = JSON.parse(readFileSync(join(__dirname, "../data/snapshot.json"), "utf8")) as Snapshot;
const e7732 = snapshot.eips.find((e) => e.eip === 7732)!;

describe("statusHistory", () => {
  it("starts at created and marks unobserved transitions", () => {
    const h = statusHistory({ ...e7732, status: "Final" } as CoreEip, []);
    expect(h[0]).toMatchObject({ status: "Draft", since: e7732.created, source: "created" });
    expect(h[h.length - 1]).toMatchObject({ status: "Final", since: "" });
  });
  it("appends observed status changes", () => {
    const ev: ChangeEvent = { at: "2026-10-01T00:00:00Z", commit: "x", type: "status_change", eip: 7732, title: "", track: "scourge", from: "Review", to: "Last Call" };
    const h = statusHistory({ ...e7732, status: "Last Call" } as CoreEip, [ev]);
    expect(h.map((s) => s.status)).toEqual(["Draft", "Last Call"]);
  });
});

describe("snapshot derivations", () => {
  it("blob schedule matches the meta EIPs", () => {
    expect(blobSchedule(snapshot.upgrades).map((s) => [s.slug, s.target, s.max])).toEqual([
      ["dencun", 3, 6],
      ["pectra", 6, 9],
      ["bpo1", 10, 15],
      ["bpo2", 14, 21],
      ["bpo3", null, null],
    ]);
  });

  it("creation counts add up to the Core total", () => {
    const rows = creationByYear(snapshot.eips, TRACKS);
    expect(rows.reduce((a, r) => a + r.total, 0)).toBe(snapshot.eips.length);
    expect(creationByYear(snapshot.eips, TRACKS, true).reduce((a, r) => a + r.total, 0)).toBeLessThan(snapshot.eips.length);
  });

  it("lead time lengthened after London", () => {
    const pts = ageToActivation(snapshot);
    const med = (slug: string) => median(pts.filter((p) => p.upgrade === slug).map((p) => p.years));
    expect(med("london")).toBeLessThan(2);
    expect(med("pectra")).toBeGreaterThan(med("berlin"));
    expect(pts.every((p) => p.years > 0)).toBe(true);
  });

  it("authors are ranked by EIPs in motion", () => {
    const rows = authorActivity(snapshot.eips, 5);
    expect(rows).toHaveLength(5);
    expect(rows[0]!.total).toBeGreaterThanOrEqual(rows[4]!.total);
  });

  it("rows carry latest upgrade membership", () => {
    const row = buildRows(snapshot, []).find((r) => r.eip === 7805)!;
    expect(row).toMatchObject({ upgrade: "hegota", stage: "Scheduled" });
  });
});

describe("formatting", () => {
  it("freshness thresholds are 12 h and 48 h", () => {
    const now = Date.UTC(2026, 0, 3);
    expect(freshnessLevel(now - 11 * 3.6e6, now)).toBe("ok");
    expect(freshnessLevel(now - 13 * 3.6e6, now)).toBe("warn");
    expect(freshnessLevel(now - 49 * 3.6e6, now)).toBe("bad");
    expect(relativeTime(now - 3 * 3.6e6, now)).toBe("3 h ago");
  });
  it("CSV escapes quotes, commas and newlines", () => {
    expect(toCsv([{ a: 'x,"y"', b: 1 }])).toBe('a,b\n"x,""y""",1\n');
  });
  it("counts events since last visit", () => {
    expect(lastVisitCount([{ at: "2026-01-02T00:00:00Z" }, { at: "2025-12-01T00:00:00Z" }], Date.UTC(2026, 0, 1))).toBe(1);
    expect(lastVisitCount([{ at: "2026-01-02T00:00:00Z" }], null)).toBe(0);
  });
});

describe("feed text", () => {
  const name = (s: string) => ({ glamsterdam: "Glamsterdam" })[s] ?? s;
  it("describes a forced status change", () => {
    const ev: ChangeEvent = { at: "2026-10-01T00:00:00Z", commit: "abc", type: "status_change", eip: 7732, title: "ePBS", track: "scourge", from: "Review", to: "Last Call" };
    expect(describeEvent(ev, name)).toEqual({ eip: 7732, subject: "ePBS", text: "Review → Last Call" });
  });
  it("describes stage moves and activations", () => {
    expect(describeEvent({ at: "", commit: "", type: "fork_inclusion_change", eip: 1, title: "t", upgrade: "glamsterdam", from: "Proposed", to: "Scheduled" }, name).text).toBe(
      "Glamsterdam: Proposed → Scheduled",
    );
    expect(describeEvent({ at: "", commit: "", type: "activation_scheduled", upgrade: "glamsterdam", network: "Mainnet", timestamp: 1_800_000_000 }, name).text).toMatch(
      /^Mainnet activation set for 15 Jan 2027/,
    );
  });
});
