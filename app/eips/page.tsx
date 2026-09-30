import type { Metadata } from "next";
import { Suspense } from "react";
import { Explorer } from "@/components/explorer/explorer";
import { PageHeader } from "@/components/ui/stat";
import { getSiteData } from "@/lib/data";
import { buildRows } from "@/lib/rows";

export const revalidate = 21600;
export const metadata: Metadata = { title: "Explorer", description: "Search and filter every Core EIP." };

export default async function ExplorerPage() {
  const { snapshot: s, changes } = await getSiteData();
  const rows = buildRows(s, changes);
  const upgrades = s.upgrades.filter((u) => u.eips.length).map((u) => ({ slug: u.slug, name: u.name }));
  return (
    <>
      <PageHeader eyebrow="Explorer" title="All Core EIPs">
        {rows.length} proposals. Filters live in the URL, so any view can be shared. Select a row for details.
      </PageHeader>
      <Suspense fallback={<div className="h-[70vh] rounded border border-line bg-surface" />}>
        <Explorer rows={rows} upgrades={upgrades} />
      </Suspense>
    </>
  );
}
