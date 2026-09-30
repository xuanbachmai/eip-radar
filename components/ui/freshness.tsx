"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { freshnessLevel, relativeTime } from "@/lib/format";

export interface FreshnessInfo {
  commitSha: string;
  checkedAt: string;
  mode: "live" | "committed";
  error?: string;
}

const LEVEL_CLASS = {
  ok: "text-muted",
  warn: "text-[var(--warn-fg)] bg-[var(--warn-bg)]",
  bad: "text-[var(--bad-fg)] bg-[var(--bad-bg)]",
} as const;

export function Freshness({ initial }: { initial: FreshnessInfo }) {
  const router = useRouter();
  const [info, setInfo] = useState(initial);
  const [now, setNow] = useState<number | null>(null);
  const [state, setState] = useState<"idle" | "checking" | "failed">("idle");

  useEffect(() => setInfo(initial), [initial]);
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  const checked = Date.parse(info.checkedAt);
  // Before hydration render against the check time itself so server and client HTML agree.
  const level = freshnessLevel(checked, now ?? checked);

  async function check() {
    setState("checking");
    try {
      const res = await fetch("/api/refresh?force=1", { method: "POST" });
      if (!res.ok) throw new Error(String(res.status));
      setInfo((await res.json()) as FreshnessInfo);
      setState("idle");
      setNow(Date.now());
      router.refresh();
    } catch {
      setState("failed");
    }
  }

  const short = info.commitSha.slice(0, 7);
  return (
    <div
      data-testid="freshness"
      className={`flex flex-wrap items-center gap-x-2 gap-y-1 rounded px-2 py-1 font-mono text-xs ${LEVEL_CLASS[level]}`}
    >
      <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full bg-current" />
      <span>
        Synced from{" "}
        <a href="https://github.com/ethereum/EIPs" className="underline">
          ethereum/EIPs
        </a>{" "}
        @{" "}
        <a href={`https://github.com/ethereum/EIPs/commit/${info.commitSha}`} className="underline">
          {short}
        </a>{" "}
        · <time dateTime={info.checkedAt}>{now ? relativeTime(checked, now) : info.checkedAt.slice(0, 16).replace("T", " ") + " UTC"}</time>
      </span>
      {info.mode === "committed" ? (
        <span title={info.error}>· from committed snapshot{info.error ? " (live check failed)" : ""}</span>
      ) : null}
      {level !== "ok" ? <span>· {level === "warn" ? "may be stale" : "stale"}</span> : null}
      <button
        type="button"
        onClick={check}
        disabled={state === "checking"}
        className="ml-1 rounded border border-current/30 px-1.5 py-px hover:border-current disabled:opacity-60"
      >
        {state === "checking" ? "Checking…" : "Check now"}
      </button>
      <span role="status" aria-live="polite" className="sr-only">
        {state === "failed" ? "Update check failed" : state === "checking" ? "Checking for updates" : ""}
      </span>
      {state === "failed" ? <span aria-hidden>· check failed</span> : null}
    </div>
  );
}
