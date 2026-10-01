// Ranking for the command palette. Pure, so it can be unit-tested.

import type { SearchIndex } from "@/app/api/index/route";

export interface Hit {
  href: string;
  kind: "EIP" | "Upgrade" | "Track" | "Page";
  label: string;
  detail?: string;
  status?: string;
  track?: string;
}

export const PAGES: Hit[] = [
  { href: "/", kind: "Page", label: "Dashboard" },
  { href: "/upgrades", kind: "Page", label: "Upgrades" },
  { href: "/tracks", kind: "Page", label: "Tracks" },
  { href: "/eips", kind: "Page", label: "Explorer" },
  { href: "/about", kind: "Page", label: "About" },
];

export function search(index: SearchIndex | null, q: string, limit = 12): Hit[] {
  const query = q.trim().toLowerCase().replace(/^eip[-\s]?/, "");
  if (!query) return PAGES;
  const terms = query.split(/\s+/);
  const hits: { hit: Hit; score: number }[] = [];
  const num = /^\d+$/.test(query) ? query : null;

  for (const [eip, title, status, track] of index?.eips ?? []) {
    const s = String(eip);
    const t = title.toLowerCase();
    let score = 0;
    if (num) score = s === num ? 100 : s.startsWith(num) ? 60 - s.length : 0;
    else if (terms.every((w) => t.includes(w))) score = 40 - (t.indexOf(terms[0]!) > 0 ? 5 : 0) - title.length / 100;
    if (score > 0) hits.push({ hit: { href: `/eips/${eip}`, kind: "EIP", label: `EIP-${eip}`, detail: title, status, track }, score });
  }
  for (const [slug, name] of index?.upgrades ?? []) {
    if (name.toLowerCase().includes(query) || slug.includes(query)) hits.push({ hit: { href: `/upgrades/${slug}`, kind: "Upgrade", label: name }, score: 80 });
  }
  for (const [slug, label] of index?.tracks ?? []) {
    if (label.toLowerCase().includes(query)) hits.push({ hit: { href: `/tracks/${slug}`, kind: "Track", label, track: slug }, score: 70 });
  }
  for (const p of PAGES) if (p.label.toLowerCase().includes(query)) hits.push({ hit: p, score: 50 });
  return hits
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((h) => h.hit);
}
