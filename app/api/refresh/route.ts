// Re-run the live pipeline and revalidate every page that depends on it.
//   Vercel Cron: GET with `Authorization: Bearer $CRON_SECRET` every 6 hours.
//   "Check now": POST ?force=1 from the freshness line; throttled so it can't be used to hammer GitHub.

import { revalidatePath, revalidateTag } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import { DATA_TAG, getSiteData } from "@/lib/data";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MIN_INTERVAL_MS = 2 * 60_000;

async function handle(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const isCron = !!secret && req.headers.get("authorization") === `Bearer ${secret}`;
  const force = req.nextUrl.searchParams.get("force") === "1";
  if (!isCron && !force) return NextResponse.json({ error: "pass ?force=1" }, { status: 400 });

  const before = await getSiteData();
  const age = Date.now() - Date.parse(before.checkedAt);
  if (isCron || age > MIN_INTERVAL_MS || before.mode === "committed") {
    revalidateTag(DATA_TAG);
    revalidatePath("/", "layout");
  }
  // React cache() doesn't memoise outside a render, so this re-reads the (now invalidated) data cache.
  const after = isCron || age > MIN_INTERVAL_MS ? await getSiteData() : before;
  return NextResponse.json(
    {
      commitSha: after.snapshot.source.commitSha,
      checkedAt: after.checkedAt,
      mode: after.mode,
      error: after.error,
      eips: after.snapshot.eips.length,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export const GET = handle;
export const POST = handle;
