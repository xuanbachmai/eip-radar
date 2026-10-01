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
  ok: "text-muted bg-surface-2",
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
  const when = now ? relativeTime(checked, now) : `${info.checkedAt.slice(0, 16).replace("T", " ")} UTC`;
  const note = [info.mode === "committed" ? "committed snapshot" : null, level === "warn" ? "may be stale" : level === "bad" ? "stale" : null]
    .filter(Boolean)
    .join(", ");
  return (
    <div
      data-testid="freshness"
      title={info.error ? `Live check failed: ${info.error}` : undefined}
      className={`inline-flex max-w-full items-center gap-2 rounded-full border border-current/20 py-0.5 pr-0.5 pl-2.5 font-mono text-[11px] ${LEVEL_CLASS[level]}`}
    >
      <span aria-hidden className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-current ${state === "checking" ? "animate-pulse" : ""}`} />
      <span className="min-w-0 truncate">
        <span className="hidden sm:inline">
          Synced from{" "}
          <a href="https://github.com/ethereum/EIPs" className="underline decoration-current/40">
            ethereum/EIPs
          </a>{" "}
        </span>
        @{" "}
        <a href={`https://github.com/ethereum/EIPs/commit/${info.commitSha}`} className="underline decoration-current/40">
          {short}
        </a>{" "}
        · <time dateTime={info.checkedAt}>{when}</time>
        {note ? <span> · {note}</span> : null}
        {state === "failed" ? <span> · check failed</span> : null}
      </span>
      <button
        type="button"
        onClick={check}
        disabled={state === "checking"}
        className="shrink-0 rounded-full border border-current/30 px-2 py-px hover:border-current disabled:opacity-60"
      >
        {state === "checking" ? "Checking…" : "Check now"}
      </button>
      <span role="status" aria-live="polite" className="sr-only">
        {state === "failed" ? "Update check failed" : state === "checking" ? "Checking for updates" : ""}
      </span>
    </div>
  );
}
