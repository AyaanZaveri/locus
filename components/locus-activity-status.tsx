"use client";

import { useEffect, useState } from "react";

const chevronDelays = Array.from({ length: 9 }, (_, index) => {
  const row = Math.floor(index / 3);
  const column = index % 3;
  return (column + Math.abs(row - 1)) * 90;
});

function useElapsed(startedAt: number) {
  const [elapsedMs, setElapsedMs] = useState(0);

  useEffect(() => {
    const tick = () => setElapsedMs(Date.now() - startedAt);
    tick();
    const timer = window.setInterval(tick, 100);
    return () => window.clearInterval(timer);
  }, [startedAt]);

  const seconds = Math.max(0, Math.floor(elapsedMs / 100) / 10);
  if (seconds < 60) return `${seconds.toFixed(1)}s`;

  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ${(seconds % 60).toFixed(1)}s`;
}

export function LocusActivityStatus({
  label,
  startedAt,
}: {
  label: string;
  startedAt: number;
}) {
  const elapsed = useElapsed(startedAt);

  return (
    <div
      aria-busy="true"
      className="flex items-center gap-2 motion-reduce:[&_[data-locus-loader-cell]]:[animation:none]"
      role="status"
    >
      <span
        aria-hidden="true"
        className="grid grid-cols-[repeat(3,4px)] gap-[1.5px]"
      >
        {chevronDelays.map((delay, index) => (
          <span
            className="size-1 rounded-[1px] bg-foreground opacity-15"
            data-locus-loader-cell
            key={index}
            style={{
              animation: `pixel-on 650ms ease-in-out ${delay}ms infinite`,
            }}
          />
        ))}
      </span>
      <span
        className="bg-clip-text text-sm font-medium text-transparent"
        style={{
          backgroundImage:
            "linear-gradient(90deg, var(--muted-foreground) 35%, var(--foreground) 50%, var(--muted-foreground) 65%)",
          backgroundSize: "200% 100%",
          animation: "shimmer-text 1.4s linear infinite",
        }}
      >
        {label}
      </span>
      {/*<span
        aria-hidden="true"
        className="font-mono text-[11px] text-muted-foreground tabular-nums"
      >
        {elapsed}
      </span>*/}
    </div>
  );
}
