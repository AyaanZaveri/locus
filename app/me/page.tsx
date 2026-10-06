import type { Metadata } from "next";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { getUserProfile } from "@/lib/user-profile-store";
import { EMPTY_USER_PROFILE } from "@/lib/user-profile";
import { ProfileForm } from "@/components/profile-form";
import { ProfileSignIn } from "@/components/profile-sign-in";
import { SoulProfileHeader } from "@/components/soul-profile-header";
import { getSoulCoverSeed } from "@/lib/soul-cover";
import { resolveProfileLocationCountryCode } from "@/lib/profile-locations";

export const metadata: Metadata = {
  title: "Soul · Locus",
  description: "Your background, your strengths, and what comes next.",
  robots: { index: false, follow: false },
};

export default async function MePage() {
  const session = await auth.api.getSession({ headers: await headers() });
  const profile = session
    ? ((await getUserProfile(session.user.id)) ?? EMPTY_USER_PROFILE)
    : EMPTY_USER_PROFILE;
  return (
    <main
      id="top"
      className="soul-page min-h-0 min-w-0 flex-1 overflow-y-auto ps-3 pe-1.5 pt-3 pb-20 md:p-6 md:pb-20"
    >
      <div className="mx-auto w-full min-w-0 max-w-7xl">
        <div className="w-full">
          {session ? (
            <ProfileForm
              initialProfile={profile}
              coverSeed={getSoulCoverSeed(session.user.id)}
              initialLocationCountryCode={resolveProfileLocationCountryCode(
                profile.location,
              )}
              user={{
                name: session.user.name,
                email: session.user.email,
                image: session.user.image,
              }}
            />
          ) : (
            <div className="flex flex-col gap-4">
              <SoulProfileHeader seed={getSoulCoverSeed("locus-soul")} />
              <section className="px-2 sm:px-5">
                <p className="mb-5 max-w-lg text-sm leading-relaxed text-muted-foreground">
                  Save your skills, location, and the kind of work you want.
                  Locus Focus will use them when you ask for recommendations.
                </p>
                <ProfileSignIn />
              </section>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
