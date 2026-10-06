import { auth } from "@/lib/auth";
import { isSameOriginRequest } from "@/lib/profile-request";
import { userProfileSchema, EMPTY_USER_PROFILE } from "@/lib/user-profile";
import { getUserProfile, saveUserProfile } from "@/lib/user-profile-store";

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session)
    return Response.json(
      { error: "Sign in to view your profile." },
      { status: 401 },
    );
  return Response.json(
    { profile: (await getUserProfile(session.user.id)) ?? EMPTY_USER_PROFILE },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}

export async function PUT(request: Request) {
  if (!isSameOriginRequest(request))
    return Response.json({ error: "Invalid request origin." }, { status: 403 });
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session)
    return Response.json(
      { error: "Sign in to save your profile." },
      { status: 401 },
    );
  const raw = await request.text();
  if (raw.length > 512000)
    return Response.json({ error: "Profile is too large." }, { status: 413 });
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return Response.json({ error: "Invalid profile data." }, { status: 400 });
  }
  const parsed = userProfileSchema.safeParse(body);
  if (!parsed.success)
    return Response.json(
      {
        error:
          "Check your profile. Keep each list to 50 items and descriptions within the character limits.",
      },
      { status: 400 },
    );
  try {
    await saveUserProfile(session.user.id, parsed.data);
    return Response.json({ profile: parsed.data });
  } catch {
    return Response.json(
      { error: "Couldn’t save your profile. Please try again." },
      { status: 500 },
    );
  }
}
