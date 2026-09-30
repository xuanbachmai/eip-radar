import Link from "next/link";
import type { Lineage } from "@/config/lineages";
import { TRACK_LABEL, statusColor, trackColor } from "@/lib/colors";
import type { CoreEip } from "@/lib/types";
import { DataTable } from "./frame";

export interface LineageStep {
  eip: number;
  title: string;
  status: string;
  year: string;
  core: boolean;
}

export function resolveLineage(l: Lineage, eips: Map<number, CoreEip>, index: Map<number, { title: string; status: string }>) {
  return l.steps.map((s) =>
    (Array.isArray(s) ? s : [s]).map((n): LineageStep => {
      const e = eips.get(n);
      const i = index.get(n);
      return {
        eip: n,
        title: e?.title ?? i?.title ?? "Not in ethereum/EIPs",
        status: e?.status ?? i?.status ?? "—",
        year: e?.created.slice(0, 4) ?? "",
        core: !!e,
      };
    }),
  );
}

export function LineageChains({ chains }: { chains: { lineage: Lineage; steps: LineageStep[][] }[] }) {
  const flat = chains.flatMap((c) => c.steps.flat().map((s) => ({ c: c.lineage.title, s })));
  const live = flat.filter((f) => ["Draft", "Review", "Last Call"].includes(f.s.status)).length;
  return (
    <figure className="m-0">
      <ol className="space-y-6">
        {chains.map(({ lineage, steps }) => (
          <li key={lineage.id}>
            <div className="mb-2 flex flex-wrap items-baseline gap-x-3">
              <span aria-hidden className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: trackColor(lineage.track) }} />
              <h3 className="display text-base font-bold">{lineage.title}</h3>
              <span className="text-sm text-muted">
                {TRACK_LABEL[lineage.track]} · {lineage.summary}
              </span>
            </div>
            <ol className="flex flex-wrap items-stretch gap-y-2" aria-label={`${lineage.title} lineage`}>
              {steps.map((group, gi) => (
                <li key={gi} className="flex items-stretch">
                  {gi > 0 ? (
                    <span aria-hidden className="flex items-center px-1.5 text-faint">
                      →
                    </span>
                  ) : null}
                  <div className="flex flex-col gap-1">
                    {group.map((s) => (
                      <StepCard key={s.eip} step={s} />
                    ))}
                  </div>
                </li>
              ))}
            </ol>
          </li>
        ))}
      </ol>
      <figcaption className="mt-4 text-sm text-muted">
        {chains.length} curated lineages, {flat.length} proposals; {live} still in motion. Each arrow is a replacement or refinement, not a formal
        dependency.
      </figcaption>
      <details className="mt-2 text-sm">
        <summary className="cursor-pointer text-muted hover:text-fg">Data table</summary>
        <DataTable columns={["Lineage", "EIP", "Title", "Status", "Year"]} rows={flat.map((f) => [f.c, f.s.eip, f.s.title, f.s.status, f.s.year])} />
      </details>
    </figure>
  );
}

function StepCard({ step }: { step: LineageStep }) {
  const dead = step.status === "Stagnant" || step.status === "Withdrawn";
  return (
    <Link
      href={`/eips/${step.eip}`}
      title={`EIP-${step.eip}: ${step.title} (${step.status}${step.year ? `, ${step.year}` : ""})`}
      className={`block w-[150px] rounded border border-line bg-surface px-2 py-1.5 no-underline hover:border-line-strong ${dead ? "opacity-75" : ""}`}
      style={{ borderTop: `3px solid ${statusColor(step.status)}` }}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="num text-[13px] font-semibold">{step.eip}</span>
        <span className="num text-[11px] text-muted">{step.year}</span>
      </div>
      <div className="line-clamp-2 text-xs leading-snug">{step.title}</div>
      <div className="mt-0.5 text-[11px] text-muted">{step.status}</div>
    </Link>
  );
}
