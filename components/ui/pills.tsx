import Link from "next/link";
import { TRACK_LABEL, statusColor, trackColor } from "@/lib/colors";
import type { Stage, Track } from "@/lib/types";

export function Swatch({ color, hatch = false, size = 10 }: { color: string; hatch?: boolean; size?: number }) {
  return (
    <span
      aria-hidden
      className={`inline-block shrink-0 rounded-[2px] ${hatch ? "hatch" : ""}`}
      style={{ width: size, height: size, backgroundColor: color, boxShadow: "inset 0 0 0 1px rgb(0 0 0 / 0.12)" }}
    />
  );
}

export function StatusPill({ status }: { status: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[13px]">
      <Swatch color={statusColor(status)} hatch={status === "Withdrawn"} />
      {status}
    </span>
  );
}

export function TrackPill({ track, link = false }: { track: Track; link?: boolean }) {
  const body = (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[13px]">
      <span aria-hidden className="inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: trackColor(track) }} />
      {TRACK_LABEL[track]}
    </span>
  );
  return link ? (
    <Link href={`/tracks/${track}`} className="no-underline hover:underline">
      {body}
    </Link>
  ) : (
    body
  );
}

const STAGE_STYLE: Record<Stage, string> = {
  Scheduled: "border-fg text-fg",
  Considered: "border-line-strong text-fg",
  Proposed: "border-dashed border-line-strong text-muted",
  Declined: "border-line text-muted line-through decoration-1",
};

export function StagePill({ stage, shipped = false }: { stage: Stage; shipped?: boolean }) {
  return (
    <span className={`inline-block whitespace-nowrap rounded-sm border px-1.5 py-px font-mono text-[11px] uppercase tracking-wide ${STAGE_STYLE[stage]}`}>
      {shipped && stage === "Scheduled" ? "Shipped" : stage}
    </span>
  );
}

export function EipNumber({ n, link = true }: { n: number; link?: boolean }) {
  const text = <span className="num whitespace-nowrap">EIP-{n}</span>;
  return link ? (
    <Link href={`/eips/${n}`} className="no-underline hover:underline">
      {text}
    </Link>
  ) : (
    text
  );
}
