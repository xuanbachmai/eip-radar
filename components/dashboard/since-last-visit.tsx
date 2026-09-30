"use client";

import { useEffect, useRef, useState } from "react";
import { lastVisitCount } from "@/lib/derive";

const KEY = "eip-radar:last-visit";

/** "N changes since your last visit" from a localStorage timestamp. Renders nothing if storage is unavailable. */
export function SinceLastVisit({ times }: { times: string[] }) {
  const [count, setCount] = useState<number | null>(null);
  const timesRef = useRef(times);
  useEffect(() => {
    // Once per mount: read the previous visit, then stamp this one.
    const times = timesRef.current;
    let since: number | null;
    try {
      const raw = localStorage.getItem(KEY);
      since = raw ? Number(raw) : null;
      localStorage.setItem(KEY, String(Date.now()));
    } catch {
      return; // storage blocked: badge stays hidden, page is otherwise unaffected
    }
    setCount(since === null || Number.isNaN(since) ? null : lastVisitCount(times.map((at) => ({ at })), since));
  }, []);

  if (count === null) return null;
  return (
    <span className="rounded-full border border-line-strong px-2 py-0.5 text-xs" data-testid="since-last-visit">
      {count === 0 ? "Nothing new since your last visit" : `${count} change${count === 1 ? "" : "s"} since your last visit`}
    </span>
  );
}
