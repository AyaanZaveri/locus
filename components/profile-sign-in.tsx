"use client";

import { useState } from "react";
import { LogInIcon } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";

export function ProfileSignIn() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <div className="space-y-3">
      <Button
        size="lg"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError("");
          try {
            const result = await authClient.signIn.social({
              provider: "google",
              callbackURL: "/me",
            });
            if (result.error) throw new Error();
          } catch {
            setError("Couldn’t sign in. Please try again.");
          } finally {
            setBusy(false);
          }
        }}
      >
        <LogInIcon />
        {busy ? "Opening Google…" : "Sign in with Google"}
      </Button>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
