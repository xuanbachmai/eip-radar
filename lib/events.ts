// Human-readable text for change events (feed, RSS).

import { fmtDateTimeUtc } from "./format";
import type { ChangeEvent } from "./types";

export function describeEvent(e: ChangeEvent, upgradeName: (slug: string) => string): { subject: string; eip?: number; text: string } {
  switch (e.type) {
    case "status_change":
      return { eip: e.eip, subject: e.title, text: `${e.from} → ${e.to}` };
    case "new_eip":
      return { eip: e.eip, subject: e.title, text: `new Core EIP, ${e.status}` };
    case "fork_inclusion_change": {
      const u = upgradeName(e.upgrade);
      const text = e.from === null ? `${e.to} for ${u}` : e.to === null ? `removed from ${u} (was ${e.from})` : `${u}: ${e.from} → ${e.to}`;
      return { eip: e.eip, subject: e.title ?? "", text };
    }
    case "activation_scheduled":
      return {
        subject: upgradeName(e.upgrade),
        text: `${e.network} activation ${e.previous ? "moved to" : "set for"} ${fmtDateTimeUtc(e.timestamp)}`,
      };
    case "blob_params_set":
      return { subject: upgradeName(e.upgrade), text: `blob target/max set to ${e.params.target}/${e.params.max}` };
  }
}
