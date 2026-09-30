import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { REQUIRED_UPGRADES } from "../config/upgrades";
import { fetchWithRetry } from "../lib/github";
import { SnapshotGuardError, guardSnapshot, runPipeline } from "../lib/pipeline";
import type { Snapshot } from "../lib/types";

const snapshotPath = join(__dirname, "../data/snapshot.json");

describe("snapshot guard", () => {
  it("rejects a thin snapshot", () => {
    expect(() => guardSnapshot({ eips: [], upgrades: [] })).toThrow(SnapshotGuardError);
    expect(() => guardSnapshot({ eips: [], upgrades: [] })).toThrow(/only 0 Core EIPs.*missing upgrades: homestead/);
  });

  it.runIf(existsSync(snapshotPath))("committed snapshot passes the guard and has every known upgrade", () => {
    const s = JSON.parse(readFileSync(snapshotPath, "utf8")) as Snapshot;
    expect(() => guardSnapshot(s)).not.toThrow();
    expect(s.eips.length).toBeGreaterThanOrEqual(350);
    const slugs = new Set(s.upgrades.map((u) => u.slug));
    for (const slug of REQUIRED_UPGRADES) expect(slugs).toContain(slug);
  });
});

describe("fetchWithRetry", () => {
  const ok = () => new Response("ok", { status: 200 });

  it("retries 429 and 5xx then succeeds", async () => {
    const f = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response("", { status: 429 }))
      .mockResolvedValueOnce(new Response("", { status: 502 }))
      .mockResolvedValueOnce(ok());
    const res = await fetchWithRetry("u", {}, { fetch: f, backoffMs: 1 });
    expect(res.status).toBe(200);
    expect(f).toHaveBeenCalledTimes(3);
  });

  it("does not retry a 404", async () => {
    const f = vi.fn<typeof fetch>().mockResolvedValue(new Response("", { status: 404 }));
    expect((await fetchWithRetry("u", {}, { fetch: f, backoffMs: 1 })).status).toBe(404);
    expect(f).toHaveBeenCalledTimes(1);
  });

  it("gives up after maxRetries", async () => {
    const f = vi.fn<typeof fetch>().mockResolvedValue(new Response("", { status: 503 }));
    expect((await fetchWithRetry("u", {}, { fetch: f, backoffMs: 1, maxRetries: 2 })).status).toBe(503);
    expect(f).toHaveBeenCalledTimes(3);
  });
});

describe("runPipeline cache", () => {
  it.runIf(existsSync(snapshotPath))("skips all file fetches when the tree SHA is unchanged", async () => {
    const prev = JSON.parse(readFileSync(snapshotPath, "utf8")) as Snapshot;
    const f = vi.fn<typeof fetch>().mockImplementation(async (url) => {
      if (String(url).includes("/commits/master")) {
        return Response.json({ sha: prev.source.commitSha, commit: { tree: { sha: prev.source.treeSha } } });
      }
      throw new Error(`unexpected fetch ${String(url)}`);
    });
    const r = await runPipeline({ previous: prev, fetch: f });
    expect(r.changed).toBe(false);
    expect(f).toHaveBeenCalledTimes(1);
  });
});
