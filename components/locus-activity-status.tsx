"use client";

const chevronDelays = Array.from({ length: 9 }, (_, index) => {
  const row = Math.floor(index / 3);
  const column = index % 3;
  return (column + Math.abs(row - 1)) * 90;
});

export function LocusActivityStatus({ label }: { label: string }) {
  return (
    <div
      aria-busy="true"
      className="flex items-center gap-2.5 motion-reduce:[&_[data-locus-loader-cell]]:[animation:none]"
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
    </div>
  );
}
