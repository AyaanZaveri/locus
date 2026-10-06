"use client";

import type { ReactNode } from "react";
import { SparkleIcon } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { SoulCover } from "@/components/soul-cover";
import { getSoulCoverStyle } from "@/lib/soul-cover";

export function SoulProfileHeader({
  seed,
  user,
  children,
}: {
  seed: number;
  user?: { name: string; email: string; image?: string | null };
  children?: ReactNode;
}) {
  return (
    <header className="soul-identity" style={getSoulCoverStyle(seed)}>
      <div className="relative isolate h-56 overflow-clip rounded-lg ring-1 ring-black/10 shadow-xs sm:h-64 lg:h-72 dark:ring-white/10">
        <SoulCover seed={seed} />
        <div className="absolute top-3 left-3 flex items-center gap-2 sm:top-4 sm:left-5">
          <SidebarTrigger
            aria-label="Open sidebar"
            className="rounded-lg bg-background/80 backdrop-blur-md md:hidden"
          />
          <h1 className="sr-only">Soul</h1>
        </div>
      </div>
      <div className="relative px-2 sm:px-5">
        <div className="absolute -top-10 left-2 rounded-xl ring-1 ring-border/50 bg-background/30 p-1 shadow-xs backdrop-blur-sm sm:-top-16 sm:left-5 dark:ring-border/75">
          <div className="rounded-lg bg-background/60">
            <Avatar className="size-16 rounded-lg ring-1 ring-border/25 after:rounded-lg sm:size-20">
              <AvatarImage
                className="rounded-lg"
                src={user?.image ?? undefined}
                alt={user?.name ?? ""}
              />
              <AvatarFallback className="soul-avatar-fallback rounded-lg text-xl font-medium text-foreground">
                {user ? (
                  user.name
                    .trim()
                    .split(/\s+/)
                    .slice(0, 2)
                    .map((part) => part[0])
                    .join("")
                ) : (
                  <SparkleIcon aria-hidden="true" className="size-7" />
                )}
              </AvatarFallback>
            </Avatar>
          </div>
        </div>
        <div className="flex min-w-0 flex-wrap items-end justify-between gap-4 pt-12">
          <div className="min-w-0">
            <h2 className="text-3xl leading-tight font-semibold tracking-tight">
              {user?.name ?? "Make Locus yours"}
            </h2>
          </div>
          {children ? (
            <div className="flex shrink-0 items-center gap-2 pb-0.5">
              {children}
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
