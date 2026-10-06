import { auth } from "@/lib/auth";
import { isSameOriginRequest } from "@/lib/profile-request";
import {
  MAX_RESUME_BYTES,
  readResumeText,
  ResumeInputError,
} from "@/lib/resume-text";
import { reserveResumeImport } from "@/lib/user-profile-store";
import { extractResumeDetails } from "@/lib/ai/resume-extraction";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(request: Request) {
  if (!isSameOriginRequest(request))
    return Response.json({ error: "Invalid request origin." }, { status: 403 });
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session)
    return Response.json(
      { error: "Sign in to import a resume." },
      { status: 401 },
    );
  const length = Number(request.headers.get("content-length"));
  if (length > MAX_RESUME_BYTES + 65536)
    return Response.json(
      { error: "Choose a resume under 3 MB." },
      { status: 413 },
    );
  if (!process.env.OPENCODE_GO_API_KEY)
    return Response.json(
      {
        error:
          "Resume import is unavailable right now. You can still fill in your profile manually.",
      },
      { status: 503 },
    );
  try {
    const form = await request.formData();
    const file = form.get("resume");
    if (!(file instanceof File))
      return Response.json({ error: "Choose a resume file." }, { status: 400 });
    const text = await readResumeText(file);
    if (!(await reserveResumeImport(session.user.id)))
      return Response.json(
        { error: "Please wait a minute before importing another resume." },
        { status: 429, headers: { "Retry-After": "60" } },
      );
    const details = await extractResumeDetails(
      text,
      AbortSignal.any([request.signal, AbortSignal.timeout(90000)]),
    );
    return Response.json(
      { details },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    if (error instanceof ResumeInputError)
      return Response.json({ error: error.message }, { status: 400 });
    // Do not log resume text or provider exceptions, which can contain prompts.
    return Response.json(
      {
        error:
          "Couldn’t read your resume right now. Try again in a minute, or fill in your details manually.",
      },
      { status: 502 },
    );
  }
}
