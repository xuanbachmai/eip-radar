import { NextResponse, type NextRequest } from "next/server";
import { getSiteData } from "@/lib/data";

export const revalidate = 21600;

/** Change log as JSON, newest first. `?limit=` (default 200, max 2000), `?eip=` and `?type=` filter. */
export async function GET(req: NextRequest) {
  const { changes, snapshot, checkedAt } = await getSiteData();
  const sp = req.nextUrl.searchParams;
  const limit = Math.min(2000, Math.max(1, Number(sp.get("limit")) || 200));
  const eip = sp.get("eip");
  const type = sp.get("type");
  const events = [...changes]
    .filter((e) => (!eip || ("eip" in e && String(e.eip) === eip)) && (!type || e.type === type))
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, limit);
  return NextResponse.json({
    source: snapshot.source,
    checkedAt,
    count: events.length,
    events,
  });
}
