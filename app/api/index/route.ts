// Compact index of every Core EIP, upgrade and track. Loaded lazily by the command palette and
// the watchlist so neither has to ship this data in the landing page's HTML or JS.

import { NextResponse } from "next/server";
import { TRACK_META } from "@/config/tracks";
import { getSiteData } from "@/lib/data";
import { TRACKS } from "@/lib/types";

export const revalidate = 21600;

export interface SearchIndex {
  eips: [number, string, string, string][]; // [eip, title, status, track]
  upgrades: [string, string][]; // [slug, name]
  tracks: [string, string][]; // [slug, label]
}

export async function GET() {
  const { snapshot } = await getSiteData();
  const body: SearchIndex = {
    eips: snapshot.eips.map((e) => [e.eip, e.title, e.status, e.track]),
    upgrades: [...snapshot.upgrades].reverse().map((u) => [u.slug, u.name]),
    tracks: TRACKS.map((t) => [t, TRACK_META[t].label]),
  };
  return NextResponse.json(body, { headers: { "Cache-Control": "public, max-age=600, stale-while-revalidate=21600" } });
}
