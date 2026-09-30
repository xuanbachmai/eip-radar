"use client";

import { useEffect, useState } from "react";

function parts(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return { d: Math.floor(s / 86_400), h: Math.floor((s % 86_400) / 3600), m: Math.floor((s % 3600) / 60), s: s % 60 };
}

/** Live countdown to a unix timestamp. Renders a static placeholder until hydrated (no mismatch). */
export function Countdown({ ts, label }: { ts: number; label: string }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const p = parts(ts * 1000 - (now ?? ts * 1000));
  const past = now !== null && now >= ts * 1000;
  return (
    <div>
      <div className="eyebrow">{label}</div>
      {past ? (
        <div className="num mt-1 text-2xl font-semibold">activated</div>
      ) : (
        <div className="num mt-1 flex items-baseline gap-3 text-3xl font-semibold sm:text-4xl" aria-live="off">
          {now === null ? (
            <span className="text-muted">––d ––h ––m</span>
          ) : (
            <>
              <span>
                {p.d}
                <small className="ml-0.5 text-sm text-muted">d</small>
              </span>
              <span>
                {String(p.h).padStart(2, "0")}
                <small className="ml-0.5 text-sm text-muted">h</small>
              </span>
              <span>
                {String(p.m).padStart(2, "0")}
                <small className="ml-0.5 text-sm text-muted">m</small>
              </span>
              <span className="text-muted">
                {String(p.s).padStart(2, "0")}
                <small className="ml-0.5 text-sm">s</small>
              </span>
            </>
          )}
        </div>
      )}
    </div>
  );
}
