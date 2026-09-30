// Shared data model for the pipeline and the site. Everything in data/snapshot.json conforms to `Snapshot`.

export const TRACKS = ["merge", "surge", "scourge", "verge", "purge", "splurge", "legacy"] as const;
export type Track = (typeof TRACKS)[number];

export const STATUSES = ["Final", "Last Call", "Review", "Draft", "Stagnant", "Withdrawn", "Living"] as const;
export type Status = (typeof STATUSES)[number];

/** Inclusion stages as defined by EIP-7723. Shipped upgrades list their EIPs as `Scheduled`. */
export const STAGES = ["Scheduled", "Considered", "Proposed", "Declined"] as const;
export type Stage = (typeof STAGES)[number];

export interface Author {
  name: string;
  /** GitHub handle without the @, when the front matter gives one. Emails are deliberately dropped. */
  handle?: string;
}

/** Lightweight row kept for every file in EIPS/, so unchanged files can be skipped on the next sync. */
export interface IndexEntry {
  eip: number;
  blob: string;
  title: string;
  status: string;
  type: string;
  category?: string;
}

export interface CoreEip {
  eip: number;
  title: string;
  description?: string;
  authors: Author[];
  status: Status;
  type: string;
  category: "Core";
  created: string; // YYYY-MM-DD
  requires: number[];
  lastCallDeadline?: string;
  withdrawalReason?: string;
  discussionsTo?: string;
  abstract?: string;
  track: Track;
  trackSource: "override" | "rule";
  /** Git blob SHA of the source file at the snapshot commit. */
  blob: string;
}

export interface Activation {
  /** Display name as written in the meta EIP, e.g. "Holešky". */
  network: string;
  /** Normalised key: mainnet | sepolia | holesky | hoodi | goerli | … */
  key: string;
  epoch?: number;
  /** Unix seconds. */
  timestamp?: number;
  forkId?: string;
}

export interface BlobParams {
  /** null means the meta EIP still has a TODO for this value. */
  target: number | null;
  max: number | null;
  baseFeeUpdateFraction: number | null;
}

export interface UpgradeEip {
  eip: number;
  stage: Stage;
  /** `other` = listed under Other/Networking/Informational — not a Core change of this fork. */
  section: "core" | "other";
}

export interface Upgrade {
  slug: string;
  name: string;
  kind: "legacy" | "meta" | "bpo";
  /** Hardfork Meta EIP this was parsed from (absent for static pre-Berlin data). */
  metaEip?: number;
  metaStatus?: string;
  /** For BPOs: the fork whose meta EIP schedules them (e.g. fusaka). */
  parent?: string;
  mascot?: string;
  activations: Activation[];
  eips: UpgradeEip[];
  blobParams?: BlobParams;
}

export interface Snapshot {
  schemaVersion: 1;
  parserVersion: number;
  generatedAt: string;
  source: {
    repo: string;
    branch: string;
    commitSha: string;
    treeSha: string;
    committedAt?: string;
  };
  eips: CoreEip[];
  upgrades: Upgrade[];
  index: IndexEntry[];
}

export type ChangeEvent =
  | (BaseEvent & { type: "status_change"; eip: number; title: string; track: Track; from: string; to: string })
  | (BaseEvent & { type: "new_eip"; eip: number; title: string; track: Track; status: string })
  | (BaseEvent & {
      type: "fork_inclusion_change";
      eip: number;
      title?: string;
      track?: Track;
      upgrade: string;
      from: Stage | null;
      to: Stage | null;
    })
  | (BaseEvent & { type: "activation_scheduled"; upgrade: string; network: string; timestamp: number; previous?: number })
  | (BaseEvent & { type: "blob_params_set"; upgrade: string; params: BlobParams });

interface BaseEvent {
  /** ISO time the sync observed the change. */
  at: string;
  /** ethereum/EIPs commit the change was observed at. */
  commit: string;
  /** Present when reconstructed from commit history (scripts/backfill.ts) rather than seen by a sync. */
  source?: "backfill";
}
