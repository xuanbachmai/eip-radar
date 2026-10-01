"use client";

// Client-only state: the lazily fetched search index and the per-browser watchlist.

import { useEffect, useState, useSyncExternalStore } from "react";
import type { SearchIndex } from "@/app/api/index/route";

export type { SearchIndex };

// ---- search index (fetched once per page load, on demand) -----------------------------------

let indexPromise: Promise<SearchIndex> | null = null;

export function loadSearchIndex(): Promise<SearchIndex> {
  indexPromise ??= fetch("/api/index")
    .then((r) => {
      if (!r.ok) throw new Error(String(r.status));
      return r.json() as Promise<SearchIndex>;
    })
    .catch((err) => {
      indexPromise = null; // allow a retry
      throw err;
    });
  return indexPromise;
}

export function useSearchIndex(enabled = true): SearchIndex | null {
  const [index, setIndex] = useState<SearchIndex | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let live = true;
    loadSearchIndex()
      .then((i) => live && setIndex(i))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [enabled]);
  return index;
}

// ---- watchlist (localStorage; the page works identically when storage is unavailable) --------

const KEY = "eip-radar:watchlist";
const EMPTY: readonly number[] = [];
let cache: readonly number[] | null = null;
const listeners = new Set<() => void>();

function read(): readonly number[] {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    cache = Array.isArray(parsed) ? parsed.filter((n): n is number => Number.isInteger(n)) : [];
  } catch {
    cache = [];
  }
  return cache;
}

function write(next: number[]) {
  cache = [...new Set(next)].sort((a, b) => a - b);
  try {
    localStorage.setItem(KEY, JSON.stringify(cache));
  } catch {
    /* storage blocked: keep the in-memory list for this page view */
  }
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      cache = null;
      l();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(l);
    window.removeEventListener("storage", onStorage);
  };
}

export function useWatchlist() {
  const list = useSyncExternalStore(subscribe, read, () => EMPTY);
  return {
    list,
    has: (n: number) => list.includes(n),
    toggle: (n: number) => write(list.includes(n) ? list.filter((x) => x !== n) : [...list, n]),
  };
}
