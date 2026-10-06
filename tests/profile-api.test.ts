import assert from "node:assert/strict";
import { test } from "node:test";
import { randomUUID } from "node:crypto";
import { serializeSignedCookie } from "better-call";
import { eq } from "drizzle-orm";
import { EMPTY_USER_PROFILE } from "../lib/user-profile";

// Opt-in integration: node --env-file=.env.local --conditions=react-server
// --import tsx --test tests/profile-api.test.ts, with LOCUS_PROFILE_TEST_URL set.
test(
  "profile API isolates users, validates input, and keeps resume drafts unsaved",
  { skip: !process.env.LOCUS_PROFILE_TEST_URL },
  async () => {
    const { db } = await import("../lib/db/client");
    const { user, session } = await import("../lib/db/auth-schema");
    const base = process.env.LOCUS_PROFILE_TEST_URL!;
    const ids = [randomUUID(), randomUUID()];
    const cookies: string[] = [];
    try {
      for (const id of ids) {
        const token = randomUUID();
        await db.insert(user).values({
          id,
          name: "Profile API Test",
          email: `${id}@example.invalid`,
        });
        await db.insert(session).values({
          id: randomUUID(),
          token,
          userId: id,
          expiresAt: new Date(Date.now() + 900000),
        });
        cookies.push(
          (
            await serializeSignedCookie(
              "better-auth.session_token",
              token,
              process.env.BETTER_AUTH_SECRET!,
            )
          ).split(";")[0],
        );
      }
      const request = (path: string, index: number, init?: RequestInit) =>
        fetch(`${base}${path}`, {
          ...init,
          headers: { cookie: cookies[index], origin: base, ...init?.headers },
        });
      assert.equal((await fetch(`${base}/api/me`)).status, 401);
      assert.equal(
        (
          await fetch(`${base}/api/me`, {
            method: "PUT",
            headers: { origin: base },
            body: "{}",
          })
        ).status,
        401,
      );
      assert.equal(
        (
          await request("/api/me", 0, {
            method: "PUT",
            headers: { origin: "https://attacker.test" },
            body: "{}",
          })
        ).status,
        403,
      );
      assert.equal(
        (
          await request("/api/me", 0, {
            method: "PUT",
            body: JSON.stringify({ ...EMPTY_USER_PROFILE, userId: ids[1] }),
          })
        ).status,
        400,
      );
      const profile = {
        ...EMPTY_USER_PROFILE,
        skills: ["Go"],
        lookingFor: "Climate software",
      };
      assert.equal(
        (
          await request("/api/me", 0, {
            method: "PUT",
            body: JSON.stringify(profile),
          })
        ).status,
        200,
      );
      assert.deepEqual(
        (await (await request("/api/me", 0)).json()).profile,
        profile,
      );
      assert.deepEqual(
        (await (await request("/api/me", 1)).json()).profile,
        EMPTY_USER_PROFILE,
      );

      if (process.env.LOCUS_TEST_RESUME_INFERENCE === "1") {
        const form = new FormData();
        form.set(
          "resume",
          new File(
            [
              "Taylor Example\nToronto, Canada\nSenior Backend Engineer (2024–present)\nBuilt APIs in Go and Python, maintained PostgreSQL databases, and operated Kubernetes infrastructure. Created observability dashboards and collaborated with designers to ship developer tools.",
            ],
            "resume.txt",
          ),
        );
        const response = await request("/api/me/resume", 1, {
          method: "POST",
          body: form,
        });
        assert.equal(response.status, 200);
        const result = await response.json();
        assert.ok(result.details.about.length > 0);
        assert.ok(
          result.details.skills.some((skill: string) =>
            /go|python/i.test(skill),
          ),
        );
        assert.equal(typeof result.details.lookingFor, "string");
        assert.deepEqual(
          (await (await request("/api/me", 1)).json()).profile,
          EMPTY_USER_PROFILE,
        );
        assert.equal(
          (await request("/api/me/resume", 1, { method: "POST", body: form }))
            .status,
          200,
        );
      }
    } finally {
      for (const id of ids) await db.delete(user).where(eq(user.id, id));
    }
  },
);
