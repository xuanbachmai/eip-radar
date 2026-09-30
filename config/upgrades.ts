// Pre-Berlin → Shapella fork membership is static (Appendix B). Everything from Dencun on is
// discovered from "Hardfork Meta - <Name>" EIPs at sync time — see lib/forks.ts.

export interface LegacyFork {
  name: string;
  slug: string;
  mainnet: string; // YYYY-MM-DD
  eips: number[];
  /** Optional one-word mascot/nickname shown in the UI. */
  mascot?: string;
}

export const LEGACY_FORKS: readonly LegacyFork[] = [
  { name: "Homestead", slug: "homestead", mainnet: "2016-03-14", eips: [2, 7] },
  { name: "Tangerine Whistle", slug: "tangerine-whistle", mainnet: "2016-10-18", eips: [150] },
  { name: "Spurious Dragon", slug: "spurious-dragon", mainnet: "2016-11-22", eips: [155, 160, 161, 170] },
  { name: "Byzantium", slug: "byzantium", mainnet: "2017-10-16", eips: [100, 140, 196, 197, 198, 211, 214, 649, 658] },
  { name: "Constantinople", slug: "constantinople", mainnet: "2019-02-28", eips: [145, 1014, 1052, 1234, 1283] },
  { name: "Istanbul", slug: "istanbul", mainnet: "2019-12-08", eips: [152, 1108, 1344, 1884, 2028, 2200] },
  { name: "Muir Glacier", slug: "muir-glacier", mainnet: "2020-01-02", eips: [2384] },
  { name: "Berlin", slug: "berlin", mainnet: "2021-04-15", eips: [2565, 2718, 2929, 2930] },
  { name: "London", slug: "london", mainnet: "2021-08-05", eips: [1559, 3198, 3529, 3541, 3554] },
  { name: "Arrow Glacier", slug: "arrow-glacier", mainnet: "2021-12-09", eips: [4345] },
  { name: "Gray Glacier", slug: "gray-glacier", mainnet: "2022-06-30", eips: [5133] },
  { name: "Paris (The Merge)", slug: "paris", mainnet: "2022-09-15", eips: [3675, 4399] },
  { name: "Shapella", slug: "shapella", mainnet: "2023-04-12", eips: [3651, 3855, 3860, 4895] },
];

/**
 * Meta EIPs below this number use the old "Hardfork Meta: X" format and are covered by
 * LEGACY_FORKS instead. EIP-7568 is the Berlin→Shapella backfill and lists no EIPs itself.
 */
export const FIRST_PARSED_META_EIP = 7569;

/** Upgrades that must exist in every snapshot or the sync fails (snapshot guard). */
export const REQUIRED_UPGRADES: readonly string[] = [
  ...LEGACY_FORKS.map((f) => f.slug),
  "dencun",
  "pectra",
  "fusaka",
  "bpo1",
  "bpo2",
  "bpo3",
  "glamsterdam",
  "hegota",
];

export const MIN_CORE_EIPS = 350;

/** Names used in blob-schedule tables (EL fork names) → upgrade slugs. */
export const BLOB_SCHEDULE_ALIASES: Record<string, string> = {
  cancun: "dencun",
  prague: "pectra",
  osaka: "fusaka",
};
