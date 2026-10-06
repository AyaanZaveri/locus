"use client";

import { useState } from "react";
import Link from "next/link";
import { LoaderCircleIcon, LogInIcon, LogOutIcon } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  SidebarFooter,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

export function SidebarAccount() {
  const {
    data: session,
    isPending,
    error: sessionError,
    refetch,
  } = authClient.useSession();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signIn() {
    setBusy(true);
    setError(null);
    try {
      const result = await authClient.signIn.social({
        provider: "google",
        callbackURL: window.location.pathname + window.location.search,
      });
      if (result.error) throw new Error(result.error.message);
    } catch {
      setError("Couldn’t sign in. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    setBusy(true);
    setError(null);
    try {
      const result = await authClient.signOut();
      if (result.error) throw new Error(result.error.message);
    } catch {
      setError("Couldn’t sign out. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <SidebarFooter className="absolute inset-x-0 bottom-0 z-20 py-1.5">
      <div className="relative flex flex-col gap-2">
        {session ? (
          <div className="flex min-w-0 items-center gap-1">
            <Link
              href="/soul"
              draggable={false}
              aria-label={`Edit ${session.user.name}’s profile`}
              className={buttonVariants({
                variant: "ghost",
                className:
                  "h-10 min-w-0 flex-1 justify-start gap-2.5 px-2 transition-[color,background-color,border-color,box-shadow,transform] motion-reduce:transition-none motion-reduce:active:scale-100",
              })}
            >
              <Avatar size="sm" className="size-5!">
                <AvatarImage
                  draggable={false}
                  src={session.user.image ?? undefined}
                  alt={session.user.name}
                />
                <AvatarFallback>
                  {session.user.name
                    .trim()
                    .split(/\s+/)
                    .slice(0, 2)
                    .map((part) => part[0])
                    .join("")
                    .toUpperCase() || "U"}
                </AvatarFallback>
              </Avatar>
              <span
                className="min-w-0 flex-1 truncate text-sm font-medium"
                title={session.user.name}
              >
                {session.user.name}
              </span>
            </Link>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Sign out"
              title="Sign out"
              disabled={busy}
              onClick={signOut}
            >
              {busy ? (
                <LoaderCircleIcon className="animate-spin motion-reduce:animate-none" />
              ) : (
                <LogOutIcon />
              )}
            </Button>
          </div>
        ) : (
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                disabled={isPending || busy}
                onClick={sessionError ? () => void refetch() : signIn}
              >
                {isPending || busy ? (
                  <LoaderCircleIcon className="animate-spin motion-reduce:animate-none" />
                ) : (
                  <LogInIcon />
                )}
                <span>
                  {isPending
                    ? "Loading account…"
                    : busy
                      ? "Signing in…"
                      : sessionError
                        ? "Retry account"
                        : "Sign in"}
                </span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        )}
        {error || sessionError ? (
          <p role="alert" className="px-2 text-xs text-destructive">
            {error ?? "Couldn’t load your account. Please retry."}
          </p>
        ) : null}
      </div>
    </SidebarFooter>
  );
}
