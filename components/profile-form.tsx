"use client";

import { useEffect, useRef, useState } from "react";
import { CheckIcon, LoaderCircleIcon, UploadIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { CompanySizeOptions } from "@/components/company-size-options";
import { ProfileLocationInput } from "@/components/profile-location-input";
import { SoulProfileHeader } from "@/components/soul-profile-header";
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldSet,
  FieldLegend,
} from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  mergeResumeDetails,
  resumeDetailsSchema,
  splitProfileTags,
  userProfileSchema,
  type ResumeDetails,
  type UserProfile,
} from "@/lib/user-profile";

const tagFields = ["skills", "desiredRoles", "desiredLocations"] as const;
const longFields = [
  {
    key: "about",
    label: "Your background",
    placeholder: "I build backend systems in Go and Python. I’ve worked on…",
    max: 3000,
  },
  {
    key: "lookingFor",
    label: "What would you love to work on?",
    placeholder:
      "I want to build developer tools with a small team. I like owning problems end to end…",
    max: 3000,
  },
  {
    key: "dealBreakers",
    label: "Anything you want to avoid?",
    placeholder:
      "Frequent travel, sales-heavy roles, or work outside my time zone…",
    max: 1500,
  },
] as const;
const resumeFields: Array<keyof ResumeDetails> = [
  "about",
  "skills",
  "currentRole",
  "location",
];
const workArrangements = [
  { value: "any", label: "Open to anything" },
  { value: "remote", label: "Remote" },
  { value: "hybrid", label: "Hybrid" },
  { value: "on-site", label: "On-site" },
] as const;

export function ProfileForm({
  initialProfile,
  user,
  initialLocationCountryCode,
  coverSeed = 0,
}: {
  initialProfile: UserProfile;
  user: { name: string; email: string; image?: string | null };
  initialLocationCountryCode?: string | null;
  coverSeed?: number;
}) {
  const [profile, setProfile] = useState(initialProfile);
  const [saved, setSaved] = useState(initialProfile);
  const [tagInputs, setTagInputs] = useState(
    Object.fromEntries(
      tagFields.map((key) => [
        key,
        initialProfile[key].join(key === "desiredLocations" ? "; " : ", "),
      ]),
    ) as Record<(typeof tagFields)[number], string>,
  );
  const [saving, setSaving] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [resumeError, setResumeError] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const current = {
    ...profile,
    ...Object.fromEntries(
      tagFields.map((key) => [
        key,
        splitProfileTags(
          tagInputs[key],
          key === "desiredLocations" ? ";" : ",",
        ),
      ]),
    ),
  } as UserProfile;
  const dirty = JSON.stringify(current) !== JSON.stringify(saved);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  function update<K extends keyof UserProfile>(key: K, value: UserProfile[K]) {
    setProfile((previous) => ({ ...previous, [key]: value }));
    setMessage("");
    setError("");
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setMessage("");
    setError("");
    const parsed = userProfileSchema.safeParse(current);
    if (!parsed.success) {
      setError(
        "Keep each list to 50 items, with up to 120 characters per item. Check your descriptions and try again.",
      );
      return;
    }
    setSaving(true);
    try {
      const response = await fetch("/api/me", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error ?? "Couldn’t save. Please try again.");
      const persisted = userProfileSchema.parse(result.profile);
      setProfile(persisted);
      setSaved(persisted);
      setTagInputs(
        Object.fromEntries(
          tagFields.map((key) => [
            key,
            persisted[key].join(key === "desiredLocations" ? "; " : ", "),
          ]),
        ) as typeof tagInputs,
      );
      setMessage("Saved.");
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Couldn’t save. Please try again.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function importResume(file: File) {
    setExtracting(true);
    setResumeError("");
    setMessage("");
    setError("");
    try {
      if (file.size > 3 * 1024 * 1024)
        throw new Error("Choose a resume under 3 MB.");
      const data = new FormData();
      data.set("resume", file);
      const response = await fetch("/api/me/resume", {
        method: "POST",
        body: data,
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(
          result.error ??
            "Couldn’t import. Try again or fill in your details below.",
        );
      const details = resumeDetailsSchema.parse(result.details);
      const merged = mergeResumeDetails(
        current,
        details,
        resumeFields.filter((key) => details[key].length > 0),
      );
      setProfile(merged);
      setTagInputs(
        Object.fromEntries(
          tagFields.map((key) => [
            key,
            merged[key].join(key === "desiredLocations" ? "; " : ", "),
          ]),
        ) as typeof tagInputs,
      );
      setMessage(
        "Resume details filled in. Review the fields and save when you’re ready.",
      );
    } catch (failure) {
      setResumeError(
        failure instanceof Error
          ? failure.message
          : "Couldn’t import. Try again or fill in your details below.",
      );
    } finally {
      setExtracting(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  return (
    <div className="flex w-full flex-col gap-4">
      <SoulProfileHeader seed={coverSeed} user={user}>
        <Button
          type="button"
          variant="outline"
          className="h-9"
          disabled={extracting || saving}
          onClick={() => fileInput.current?.click()}
        >
          {extracting ? (
            <LoaderCircleIcon className="animate-spin motion-reduce:animate-none" />
          ) : (
            <UploadIcon />
          )}{" "}
          {extracting ? "Reading resume…" : "Fill thru resume"}
        </Button>
        <input
          ref={fileInput}
          type="file"
          accept=".pdf,.docx,.txt"
          aria-label="Upload resume"
          hidden
          tabIndex={-1}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void importResume(file);
          }}
        />
      </SoulProfileHeader>
      {resumeError ? (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {resumeError}
        </p>
      ) : null}
      <form
        onSubmit={save}
        className="soul-form flex flex-col gap-6 px-2 sm:px-5"
      >
        <fieldset
          disabled={saving || extracting}
          className="flex min-w-0 flex-col gap-6"
        >
          <section
            aria-labelledby="background-heading"
            className="flex flex-col gap-4"
          >
            <div>
              <h2 id="background-heading" className="text-xl font-semibold tracking-tight">
                Your background
              </h2>
            </div>
            <FieldGroup className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="location">Where are you based</FieldLabel>
                <ProfileLocationInput
                  id="location"
                  value={profile.location}
                  initialCountryCode={initialLocationCountryCode}
                  onChange={(value) => update("location", value)}
                  disabled={saving || extracting}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="currentRole">
                  Current or most recent role
                </FieldLabel>
                <Input
                  id="currentRole"
                  className="h-9"
                  maxLength={120}
                  value={profile.currentRole}
                  onChange={(event) =>
                    update("currentRole", event.target.value)
                  }
                  placeholder="Software engineer"
                />
              </Field>
            </FieldGroup>
            <Field>
              <FieldLabel htmlFor="skills">Skills</FieldLabel>
              <Input
                id="skills"
                className="h-9"
                placeholder="Go, Python, distributed systems, product design"
                value={tagInputs.skills}
                onChange={(event) => {
                  setTagInputs({ ...tagInputs, skills: event.target.value });
                  setMessage("");
                }}
                maxLength={6000}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="about">{longFields[0].label}</FieldLabel>
              <Textarea
                id="about"
                className="min-h-28"
                maxLength={3000}
                value={profile.about}
                onChange={(event) => update("about", event.target.value)}
                placeholder={longFields[0].placeholder}
              />
            </Field>
          </section>

          <section
            aria-labelledby="preferences-heading"
            className="flex flex-col gap-4"
          >
            <div>
              <h2 id="preferences-heading" className="text-xl font-semibold tracking-tight">
                Your next role
              </h2>
            </div>
            <Field>
              <FieldLabel htmlFor="desiredRoles">
                Roles you’re interested in
              </FieldLabel>
              <Input
                id="desiredRoles"
                className="h-9"
                placeholder="Backend engineer, founding engineer"
                value={tagInputs.desiredRoles}
                onChange={(event) => {
                  setTagInputs({
                    ...tagInputs,
                    desiredRoles: event.target.value,
                  });
                  setMessage("");
                }}
                maxLength={6000}
              />
            </Field>
            {longFields.slice(1).map(({ key, label, placeholder, max }) => (
              <Field key={key}>
                <FieldLabel htmlFor={key}>{label}</FieldLabel>
                <Textarea
                  id={key}
                  className="min-h-24"
                  maxLength={max}
                  value={profile[key]}
                  onChange={(event) => update(key, event.target.value)}
                  placeholder={placeholder}
                />
              </Field>
            ))}
            <FieldGroup className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="workPreference">
                  Work arrangement
                </FieldLabel>
                <Select
                  items={workArrangements}
                  value={profile.workPreference}
                  disabled={saving || extracting}
                  onValueChange={(value) => {
                    if (value) update("workPreference", value);
                  }}
                >
                  <SelectTrigger
                    id="workPreference"
                    className="w-full data-[size=default]:h-9"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent align="start" alignItemWithTrigger={false}>
                    <SelectGroup>
                      {workArrangements.map(({ value, label }) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor="desiredLocations">
                  Preferred work locations
                </FieldLabel>
                <Input
                  id="desiredLocations"
                  className="h-9"
                  placeholder="Toronto, Canada; London, UK"
                  value={tagInputs.desiredLocations}
                  onChange={(event) => {
                    setTagInputs({
                      ...tagInputs,
                      desiredLocations: event.target.value,
                    });
                    setMessage("");
                  }}
                  maxLength={6000}
                />
              </Field>
            </FieldGroup>
            <Field
              orientation="horizontal"
              data-disabled={saving || extracting}
            >
              <Checkbox
                id="openToRelocation"
                disabled={saving || extracting}
                checked={profile.openToRelocation}
                onCheckedChange={(checked) =>
                  update("openToRelocation", checked)
                }
              />
              <FieldLabel htmlFor="openToRelocation">
                I’m open to relocating
              </FieldLabel>
            </Field>
            <FieldSet className="mt-2">
              <FieldLegend variant="label" className="mb-3">
                Preferred company size
              </FieldLegend>
              <CompanySizeOptions
                value={profile.companySizes}
                disabled={saving || extracting}
                onValueChange={(value) => update("companySizes", value)}
              />
            </FieldSet>
          </section>
        </fieldset>
        <div className="flex flex-col gap-3 pt-2">
          <div className="flex items-center gap-3">
            <Button
              type="submit"
              className="h-9"
              disabled={saving || extracting || !dirty}
            >
              {saving ? (
                <LoaderCircleIcon className="animate-spin motion-reduce:animate-none" />
              ) : (
                <CheckIcon />
              )}
              {saving ? "Saving…" : "Save profile"}
            </Button>
          </div>
          {error ? (
            <p role="alert" className="mt-2 text-sm text-destructive">
              {error}
            </p>
          ) : null}
          {message ? (
            <p role="status" className="mt-2 text-sm">
              {message}
            </p>
          ) : null}
        </div>
      </form>
    </div>
  );
}
