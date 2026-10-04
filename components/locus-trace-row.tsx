import { ArrowUpRightIcon, NetworkIcon, SearchIcon } from "lucide-react";

import type { LocusTrace } from "@/lib/locus-tool-trace";

export function LocusTraceRow({ trace }: { trace: LocusTrace }) {
  return (
    <p
      aria-busy={trace.phase === "running"}
      aria-live={trace.phase === "running" ? "off" : "polite"}
      className={`flex items-center gap-2 px-2 text-sm text-muted-foreground ${
        trace.phase === "error" ? "text-destructive" : ""
      }`}
      role="status"
      title={trace.detail}
    >
      {trace.logo && trace.icon === "company" ? (
        <img
          alt=""
          aria-hidden="true"
          className="size-4 shrink-0 rounded-[3.5px] object-contain"
          src={trace.logo}
        />
      ) : trace.icon === "semantic" ? (
        <NetworkIcon
          aria-hidden="true"
          className="size-3.5 shrink-0 stroke-2"
        />
      ) : trace.icon === "navigation" ? (
        <ArrowUpRightIcon
          aria-hidden="true"
          className="size-4 shrink-0 stroke-2"
        />
      ) : (
        <SearchIcon aria-hidden="true" className="size-3.5 shrink-0 stroke-2" />
      )}
      <span className="min-w-0 truncate">{trace.label}</span>
    </p>
  );
}
