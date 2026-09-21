"use client";

import { ArrowRight, ArrowUpRight, X } from "lucide-react";
import { type CSSProperties, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Streamdown } from "streamdown";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
} from "@/components/ui/drawer";
import type { CompanyProfile } from "@/lib/company-profile";

type Job = CompanyProfile["jobs"][number];

type JobCardProps = {
  company: Pick<CompanyProfile, "name" | "logo">;
  countryCode: string;
  job: Job;
};

function formatRange(
  minimum: number | null,
  maximum: number | null,
  format: (value: number) => string,
) {
  return [minimum, maximum]
    .filter((value): value is number => value !== null)
    .map(format)
    .join(" – ");
}

function normalizeJobMarkdown(description: string) {
  return description.replace(
    /\*\*\*([^\n]*?)\s+\*\*\*\[\*\*\*([^\n*]+)\*\*\*\]\(([^\s)]+)\)/g,
    "***$1*** [***$2***]($3)",
  );
}

function JobDetails({ job }: { job: Job }) {
  const salary = job.compensation?.salary;
  const equity = job.compensation?.equity;
  const experience = job.experience;
  const facts = [
    ["Status", job.status],
    ["Workplace", job.workplaceType],
    ["Commitment", job.employmentType?.replace("-", " ")],
    ["Department", job.department],
    [
      "Experience",
      experience?.minimumYears
        ? `${experience.minimumYears}+ years`
        : experience?.acceptsNewGrads
          ? "New grads welcome"
          : experience?.level,
    ],
    [
      "Salary",
      salary && (salary.minimum !== null || salary.maximum !== null)
        ? `${formatRange(salary.minimum, salary.maximum, (value) =>
            new Intl.NumberFormat("en-US", {
              style: "currency",
              currency: salary.currency,
              maximumFractionDigits: 0,
              notation: "compact",
            }).format(value),
          )} / ${salary.period}`
        : null,
    ],
    [
      "Equity",
      equity &&
      (equity.minimumPercent !== null || equity.maximumPercent !== null)
        ? formatRange(
            equity.minimumPercent,
            equity.maximumPercent,
            (value) => `${value}%`,
          )
        : null,
    ],
    [
      "US work authorization",
      job.visa?.requiresUSWorkAuthorization === false
        ? "Not required"
        : job.visa?.requiresUSWorkAuthorization === true
          ? "Required"
          : null,
    ],
    ["Visa sponsorship", job.visa?.sponsorship],
    ["Interview process", job.interviewProcess?.available ? "Available" : null],
  ].filter((fact): fact is [string, string] => Boolean(fact[1]));

  return facts.length || job.skills?.length ? (
    <section className="px-5 py-4 sm:px-6">
      <h3 className="text-base leading-5 font-semibold tracking-tight">
        Role details
      </h3>
      {facts.length ? (
        <dl className="mt-4 grid gap-x-6 gap-y-4 text-[15px] leading-5 sm:grid-cols-2">
          {facts.map(([label, value]) => (
            <div key={label}>
              <dt className="text-xs font-medium tracking-wide text-muted-foreground">
                {label}
              </dt>
              <dd className="mt-1 font-medium capitalize">{value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {job.skills?.length ? (
        <div className="mt-4">
          <p className="text-xs font-medium tracking-wide text-muted-foreground">
            Skills
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {job.skills.map((skill) => (
              <Badge key={skill} variant="secondary">
                {skill}
              </Badge>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  ) : null;
}

export function JobCard({ company, countryCode, job }: JobCardProps) {
  const [open, setOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const isRequestedJob =
    searchParams.get("job") === job.title &&
    searchParams.get("jobLocation") === job.location;

  useEffect(() => {
    const mediaQuery = window.matchMedia("(min-width: 640px)");
    const updateIsDesktop = () => setIsDesktop(mediaQuery.matches);

    updateIsDesktop();
    mediaQuery.addEventListener("change", updateIsDesktop);

    return () => mediaQuery.removeEventListener("change", updateIsDesktop);
  }, []);

  useEffect(() => {
    if (isRequestedJob) setOpen(true);
  }, [isRequestedJob]);

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (nextOpen || !isRequestedJob) return;

    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.delete("job");
    nextParams.delete("jobLocation");
    const query = nextParams.toString();
    router.replace(`${pathname}${query ? `?${query}` : ""}#jobs`, {
      scroll: false,
    });
  }

  return (
    <Drawer
      onOpenChange={handleOpenChange}
      open={open}
      swipeDirection={isDesktop ? "right" : "down"}
    >
      <button
        aria-haspopup="dialog"
        className="group block w-full cursor-pointer rounded-lg text-left transition-transform duration-150 ease-[cubic-bezier(0.2,0,0,1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.995] motion-reduce:transition-none"
        onClick={() => setOpen(true)}
        type="button"
      >
        <article className="flex items-center gap-3 rounded-lg border border-border bg-background p-3 transition-[background-color] duration-150 ease-[cubic-bezier(0.2,0,0,1)] group-hover:bg-muted motion-reduce:transition-none">
          {company.logo ? (
            <img
              alt={`${company.name} logo`}
              className="size-10 shrink-0 rounded-lg object-contain ring-1 ring-border/50 shadow-xs"
              draggable={false}
              src={company.logo}
            />
          ) : (
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-sm font-semibold text-muted-foreground">
              {company.name.slice(0, 1)}
            </div>
          )}
          <div className="min-w-0">
            <h3 className="flex items-center gap-1 truncate text-sm font-medium">
              <span className="truncate">{job.title}</span>
              {job.url ? (
                <ArrowRight
                  aria-hidden="true"
                  className="size-4 shrink-0 scale-[0.25] text-muted-foreground opacity-0 [filter:blur(4px)] transition-[opacity,scale,filter] duration-150 ease-[cubic-bezier(0.2,0,0,1)] group-hover:scale-100 group-hover:opacity-100 group-hover:[filter:blur(0px)] motion-reduce:transition-none"
                />
              ) : null}
            </h3>
            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <img
                alt=""
                aria-hidden="true"
                className="size-2.5 rounded-full"
                src={`https://hatscripts.github.io/circle-flags/flags/${countryCode}.svg`}
              />
              <span>{job.location.replace(/\s*\|\s*/g, " · ")}</span>
              <span aria-hidden="true">·</span>
              <span>{job.focus}</span>
            </div>
          </div>
        </article>
      </button>

      <DrawerContent
        side="bottom"
        className="overflow-hidden bg-sidebar/95 text-sidebar-foreground ring-0 shadow-[0_18px_56px_oklch(0_0_0_/_0.14)] backdrop-blur-2xl dark:bg-sidebar/85 sm:ml-auto sm:data-ending-style:[transform:translateX(calc(100%_+_0.75rem))] sm:data-starting-style:[transform:translateX(calc(100%_+_0.75rem))]"
        style={{ "--drawer-width": "34rem" } as CSSProperties}
      >
        <div
          aria-hidden="true"
          className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-muted-foreground/25 sm:hidden"
        />
        <header className="flex shrink-0 items-start gap-4 px-5 pt-6 pb-4 sm:px-6">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              {company.logo ? (
                <img
                  alt=""
                  className="size-5 shrink-0 rounded-[6px] bg-muted object-contain"
                  src={company.logo}
                />
              ) : (
                <div className="flex size-5 shrink-0 items-center justify-center rounded-[6px] bg-muted text-[10px] font-semibold">
                  {company.name.slice(0, 1)}
                </div>
              )}
              <p>{company.name}</p>
            </div>
            <DrawerTitle className="mt-2 text-xl leading-7 font-semibold tracking-tight text-balance">
              {job.title}
            </DrawerTitle>
            <DrawerDescription className="mt-2 flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
              <img
                alt=""
                aria-hidden="true"
                className="size-3 rounded-full"
                src={`https://hatscripts.github.io/circle-flags/flags/${countryCode}.svg`}
              />
              <span>{job.location.replace(/\s*\|\s*/g, " · ")}</span>
            </DrawerDescription>
          </div>
          <Button
            aria-label="Close job details"
            onClick={() => handleOpenChange(false)}
            size="icon"
            variant="ghost"
          >
            <X aria-hidden="true" />
          </Button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <JobDetails job={job} />

          {job.description ? (
            <section className="px-5 py-5 sm:px-6">
              <h3 className="text-base leading-5 font-semibold tracking-tight">
                About the role
              </h3>
              <Streamdown
                allowedElements={[
                  "a",
                  "blockquote",
                  "br",
                  "code",
                  "del",
                  "em",
                  "h1",
                  "h2",
                  "h3",
                  "h4",
                  "li",
                  "ol",
                  "p",
                  "strong",
                  "ul",
                ]}
                className="mt-3 max-w-[68ch] space-y-3 text-[15px] leading-6 text-muted-foreground text-pretty [&_a]:font-medium [&_a]:text-foreground [&_a]:underline [&_a]:underline-offset-4 [&_blockquote]:bg-muted/60 [&_blockquote]:px-3 [&_blockquote]:py-2 [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_h1]:text-lg [&_h1]:leading-6 [&_h1]:font-semibold [&_h2]:text-base [&_h2]:leading-5 [&_h2]:font-semibold [&_h3]:font-medium [&_li]:ml-5 [&_ol]:list-decimal [&_ul]:list-disc"
                linkSafety={{ enabled: false }}
                mode="static"
                skipHtml
              >
                {normalizeJobMarkdown(job.description)}
              </Streamdown>
            </section>
          ) : null}

          {job.interviewProcess?.summary ? (
            <section className="px-5 py-5 sm:px-6">
              <h3 className="text-base leading-5 font-semibold tracking-tight">
                Interview process
              </h3>
              <p className="mt-3 max-w-[68ch] text-[15px] leading-6 text-pretty text-muted-foreground">
                {job.interviewProcess.summary}
              </p>
            </section>
          ) : null}
        </div>

        <footer className="shrink-0 px-5 pt-3 pb-5 sm:px-6 sm:pb-6">
          {job.url ? (
            <Button
              className="h-9! w-full text-sm"
              nativeButton={false}
              render={<a href={job.url} rel="noreferrer" target="_blank" />}
            >
              View job
              <ArrowUpRight aria-hidden="true" />
            </Button>
          ) : (
            <Button className="h-12 w-full text-sm" disabled>
              Job link unavailable
            </Button>
          )}
        </footer>
      </DrawerContent>
    </Drawer>
  );
}
