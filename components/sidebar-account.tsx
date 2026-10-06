"use client";

import { useState } from "react";
import Link from "next/link";
import { LoaderCircleIcon, LogInIcon, LogOutIcon } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
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
    <SidebarFooter className="border-t border-sidebar-border">
      {session ? (
        <div className="flex min-w-0 items-center gap-2.5 px-2 py-1">
          <Link
            href="/me"
            aria-label={`Edit ${session.user.name}’s profile`}
            className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Avatar>
              <AvatarImage
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
    </SidebarFooter>
  );
}
