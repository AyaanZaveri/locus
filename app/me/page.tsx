import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { getUserProfile } from "@/lib/user-profile-store";
import { EMPTY_USER_PROFILE } from "@/lib/user-profile";
import { ProfileForm } from "@/components/profile-form";
import { ProfileSignIn } from "@/components/profile-sign-in";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { resolveProfileLocationCountryCode } from "@/lib/profile-locations";

export default async function MePage() {
  const session = await auth.api.getSession({ headers: await headers() });
  const profile = session
    ? ((await getUserProfile(session.user.id)) ?? EMPTY_USER_PROFILE)
    : EMPTY_USER_PROFILE;
  return (
    <main
      id="top"
      className="min-h-0 min-w-0 flex-1 overflow-y-auto ps-3 pe-1.5 pt-3 pb-20 md:p-6 md:pb-20"
    >
      <div className="mx-auto w-full min-w-0 max-w-7xl">
        <div className="mb-5 flex items-start gap-3">
          <SidebarTrigger
            aria-label="Open sidebar"
            className="mt-1 md:hidden"
          />
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Who am I?</h1>
          </div>
        </div>
        {session ? (
          <ProfileForm
            initialProfile={profile}
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
          <section className="rounded-xl border border-border p-6 sm:p-8">
            <h2 className="text-lg font-medium">Make Locus yours</h2>
            <p className="mt-2 mb-6 max-w-lg text-sm leading-relaxed text-muted-foreground">
              Save your skills, location, and the kind of work you want. Locus
              Focus will use them when you ask for recommendations.
            </p>
            <ProfileSignIn />
          </section>
        )}
      </div>
    </main>
  );
}
