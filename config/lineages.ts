// Curated lineage chains: the long arcs where one proposal replaced another.
// Each step is an EIP number; a step may be a group (e.g. 8105/8184 as parallel successors).

import type { Track } from "../lib/types";

export interface Lineage {
  id: string;
  title: string;
  track: Track;
  /** One line on what the arc is about. */
  summary: string;
  steps: (number | number[])[];
}

export const LINEAGES: readonly Lineage[] = [
  {
    id: "account-abstraction",
    title: "Account abstraction",
    track: "splurge",
    summary: "From contract-validated transactions to native frame transactions.",
    steps: [86, 2938, 3074, 5003, 7701, 7702, 8141],
  },
  {
    id: "censorship-resistance",
    title: "Censorship resistance",
    track: "scourge",
    summary: "Inclusion lists and enshrined PBS, converging on fork-choice-enforced lists.",
    steps: [7547, 7732, 7805, [8105, 8184]],
  },
  {
    id: "state-tree",
    title: "State tree",
    track: "verge",
    summary: "Replacing the hexary Merkle-Patricia trie to make stateless verification practical.",
    steps: [3102, 6800, 7748, 7864, 8297, 8347],
  },
  {
    id: "selfdestruct",
    title: "SELFDESTRUCT",
    track: "purge",
    summary: "Neutering, then removing, the opcode that breaks state assumptions.",
    steps: [4758, 6780, 8246],
  },
  {
    id: "data-availability",
    title: "Data availability",
    track: "surge",
    summary: "Blobs, more blobs, then sampling so nodes don't have to download them all.",
    steps: [4844, 7691, 7594, 8079],
  },
];
