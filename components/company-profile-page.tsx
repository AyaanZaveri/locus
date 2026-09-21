// import { ProgressiveBlur } from "@/components/motion-primitives/progressive-blur";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { JobCard } from "@/components/job-card";
import { SidebarTrigger } from "@/components/ui/sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { type ActivityType, type CompanyProfile } from "@/lib/company-profile";
import { cn } from "@/lib/utils";
import {
  ArrowUpRight,
  Asterisk,
  BookOpen,
  BriefcaseBusiness,
  Flag,
  Newspaper,
  TrendingUp,
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react";

const activityIcon: Record<ActivityType, LucideIcon> = {
  documentation: BookOpen,
  funding: TrendingUp,
  growth: TrendingUp,
  hiring: BriefcaseBusiness,
  news: Newspaper,
  people: Users,
  product: Flag,
};

function formatFundingDate(date: string | null) {
  if (!date) {
    return null;
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return date;
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "long",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));
}

function getSourceHost(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export function CompanyProfilePage({ profile }: { profile: CompanyProfile }) {
  const latestRound =
    profile.funding.rounds.find(
      (round) => round.id === profile.funding.latestRoundId,
    ) ?? profile.funding.rounds[0];
  const previousRounds = profile.funding.rounds.filter(
    (round) => round.id !== latestRound?.id,
  );

  return (
    <main
      id="top"
      className="min-h-0 min-w-0 flex-1 overflow-y-auto ps-3 pe-1.5 py-3 md:p-6"
    >
      <div className="mx-auto grid w-full min-w-0 max-w-7xl gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0">
          <div className="relative w-full max-w-full">
            <div className="relative isolate aspect-[1200/630] overflow-hidden rounded-lg ring-1 ring-black/10 shadow-xs md:aspect-[16/7] dark:ring-white/10">
              {profile.banner ? (
                <img
                  alt={`${profile.name} banner`}
                  draggable={false}
                  className={cn(
                    "block size-full max-w-full object-cover",
                    profile.bannerPosition ?? "object-center",
                  )}
                  src={profile.banner}
                />
              ) : (
                <div aria-hidden="true" className="size-full bg-muted" />
              )}
              {/* <ProgressiveBlur
                className="pointer-events-none absolute inset-x-0 bottom-0 h-1/5 overflow-hidden rounded-b-lg"
                blurIntensity={0.5}
              /> */}
            </div>
            <SidebarTrigger
              aria-label="Open sidebar"
              className="absolute top-3 left-3 border-border bg-background/90 text-foreground shadow-xs backdrop-blur-sm hover:bg-background md:hidden"
              size="icon"
            />
            <div className="absolute -bottom-8 left-4 rounded-xl ring-1 ring-border bg-background/30 p-1 shadow-xs backdrop-blur-sm sm:-bottom-6 sm:left-5">
              <div className="rounded-lg bg-background/60">
                {profile.logo ? (
                  <img
                    alt={`${profile.name} logo`}
                    draggable={false}
                    className="size-16 rounded-lg ring-1 ring-border/25 sm:size-20"
                    src={profile.logo}
                  />
                ) : (
                  <div className="flex size-16 items-center justify-center rounded-lg bg-muted text-xl font-semibold text-muted-foreground sm:size-20">
                    {profile.name.slice(0, 1)}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="px-2">
            <h1 className="mt-12 text-2xl font-semibold tracking-tight">
              {profile.name}
            </h1>
            <p className="text-sm font-medium text-muted-foreground">
              {profile.tagline}
            </p>

            <div className="mt-3 flex flex-wrap gap-2">
              <Badge variant="secondary">{profile.industry}</Badge>
              <Badge variant="secondary">
                <img
                  alt=""
                  aria-hidden="true"
                  className="mr-0.5 size-3 rounded-full"
                  src={`https://hatscripts.github.io/circle-flags/flags/${profile.location.countryCode}.svg`}
                />
                {profile.location.label}
              </Badge>
              <Badge variant="secondary">
                <Asterisk aria-hidden="true" />
                {profile.stage}
              </Badge>
              <Badge variant="secondary">
                <UserRound aria-hidden="true" />
                {profile.employees}
              </Badge>
            </div>

            <section className="mt-6 max-w-3xl">
              <h2 className="text-lg font-semibold tracking-tight">About</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {profile.description}
              </p>
            </section>

            {latestRound ? (
              <section className="mt-6 max-w-none">
                <h2 className="text-lg font-semibold tracking-tight">
                  Funding
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  <span className="font-mono font-semibold tabular-nums text-foreground">
                    {profile.financials.totalFunding.display}
                  </span>{" "}
                  total funding · {profile.funding.rounds.length} rounds
                </p>
                <div className="mt-4">
                  <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    Rounds
                  </p>
                  <div className="mt-3">
                    {[latestRound, ...previousRounds].map((round, index) => {
                      const isLatest = round.id === latestRound.id;
                      const isLast =
                        index === profile.funding.rounds.length - 1;

                      return (
                        <div
                          className="grid grid-cols-[0.75rem_minmax(0,1fr)] gap-3"
                          key={round.id}
                        >
                          <div className="relative flex justify-center">
                            <span
                              className={cn(
                                "mt-1.5 size-2 shrink-0 rounded-full bg-muted-foreground",
                                isLatest && "bg-emerald-500",
                              )}
                            />
                            {!isLast ? (
                              <span className="absolute top-5 bottom-0 w-0.5 rounded-full bg-border" />
                            ) : null}
                          </div>
                          <article className="pb-5">
                            <div className="min-w-0">
                              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3 gap-y-2">
                                <div>
                                  <p className="text-sm font-medium">
                                    {round.stage}
                                  </p>
                                  {formatFundingDate(round.announcedAt) ||
                                  round.sourceUrl ? (
                                    <div className="mt-0.5 flex flex-wrap items-center gap-x-1 text-xs font-medium text-muted-foreground">
                                      {formatFundingDate(round.announcedAt) ? (
                                        <time>
                                          {formatFundingDate(round.announcedAt)}
                                        </time>
                                      ) : null}
                                      {formatFundingDate(round.announcedAt) &&
                                      round.sourceUrl ? (
                                        <span aria-hidden="true">·</span>
                                      ) : null}
                                      {round.sourceUrl ? (
                                        <Tooltip>
                                          <TooltipTrigger
                                            className="inline-flex items-center gap-0.5 rounded-sm text-muted-foreground transition-colors duration-150 ease-[cubic-bezier(0.2,0,0,1)] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none"
                                            render={
                                              <a
                                                href={round.sourceUrl}
                                                rel="noreferrer"
                                                target="_blank"
                                              />
                                            }
                                          >
                                            Source
                                            <ArrowUpRight
                                              aria-hidden="true"
                                              className="size-3.5"
                                              strokeWidth={2}
                                            />
                                          </TooltipTrigger>
                                          <TooltipContent
                                            className="gap-1.5 bg-background/90 px-2 py-1.5 text-foreground ring-1 ring-border shadow-xs backdrop-blur-sm"
                                            showArrow={false}
                                          >
                                            <img
                                              alt=""
                                              aria-hidden="true"
                                              className="-ml-px size-3.5 shrink-0 rounded-[3px] object-contain"
                                              src={`https://www.google.com/s2/favicons?domain=${getSourceHost(
                                                round.sourceUrl,
                                              )}&sz=64`}
                                            />
                                            <span className="font-mono font-medium tracking-tight">
                                              {getSourceHost(round.sourceUrl)}
                                            </span>
                                          </TooltipContent>
                                        </Tooltip>
                                      ) : null}
                                    </div>
                                  ) : null}
                                </div>
                                <p className="justify-self-end font-mono text-base font-semibold tabular-nums">
                                  {round.amount.display}
                                </p>
                                <div className="flex flex-wrap items-center gap-1.5">
                                  {round.leadInvestors.map((investor) => (
                                    <Button
                                      className="rounded-full border-border dark:border-border bg-background dark:bg-background"
                                      key={investor.name}
                                      nativeButton={!investor.website}
                                      render={
                                        investor.website ? (
                                          <a
                                            href={investor.website}
                                            rel="noreferrer"
                                            target="_blank"
                                          />
                                        ) : undefined
                                      }
                                      size="xs"
                                      variant="outline"
                                    >
                                      {investor.logo ? (
                                        <img
                                          alt=""
                                          className="size-3 rounded-full object-contain mr-0.5"
                                          src={investor.logo}
                                        />
                                      ) : null}
                                      {investor.name}
                                    </Button>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </article>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </section>
            ) : null}

            <section id="key-people" className="mt-6 max-w-none scroll-mt-6">
              <h2 className="text-lg font-semibold tracking-tight">
                Key people
              </h2>
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {profile.people.map((person) => (
                  <div
                    className="flex items-center gap-3 rounded-lg border border-border bg-background p-3"
                    key={person.name}
                  >
                    <Avatar className="size-10">
                      {person.image ? (
                        <AvatarImage
                          alt={person.name}
                          src={person.image}
                          className={"ring-1 ring-border/50 shadow-xs"}
                        />
                      ) : null}
                      <AvatarFallback>
                        {person.name
                          .split(" ")
                          .map((part) => part[0])
                          .join("")}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {person.name}
                      </p>
                      <p className="truncate text-xs font-medium text-muted-foreground">
                        {person.role}
                      </p>
                    </div>
                    <div className="ml-auto flex shrink-0 items-center gap-1">
                      {person.linkedin ? (
                        <Button
                          aria-label={`${person.name} on LinkedIn`}
                          nativeButton={false}
                          render={
                            <a
                              href={person.linkedin}
                              rel="noreferrer"
                              target="_blank"
                            />
                          }
                          size="icon-sm"
                          variant="ghost"
                        >
                          <span
                            aria-hidden="true"
                            className="block size-3.5 shrink-0 bg-muted-foreground"
                            style={{
                              mask: "url('/icons/linkedin.svg') center / contain no-repeat",
                              WebkitMask:
                                "url('/icons/linkedin.svg') center / contain no-repeat",
                            }}
                          />
                        </Button>
                      ) : null}
                      {person.x ? (
                        <Button
                          aria-label={`${person.name} on X`}
                          nativeButton={false}
                          render={
                            <a
                              href={person.x}
                              rel="noreferrer"
                              target="_blank"
                            />
                          }
                          size="icon-sm"
                          variant="ghost"
                        >
                          <span
                            aria-hidden="true"
                            className="block size-3.5 shrink-0 bg-muted-foreground"
                            style={{
                              mask: "url('/icons/x.svg') center / contain no-repeat",
                              WebkitMask:
                                "url('/icons/x.svg') center / contain no-repeat",
                            }}
                          />
                        </Button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {profile.jobs.length ? (
              <section id="jobs" className="mt-6 max-w-none scroll-mt-6">
                <h2 className="text-lg font-semibold tracking-tight">Jobs</h2>
                <div className="mt-3 flex flex-col gap-3">
                  {profile.jobs.map((job, index) => (
                    <JobCard
                      company={{ name: profile.name, logo: profile.logo }}
                      countryCode={profile.location.countryCode}
                      job={job}
                      key={`${job.title}-${job.location}-${job.focus}-${job.url ?? ""}-${index}`}
                    />
                  ))}
                </div>
              </section>
            ) : null}
          </div>
        </div>

        <aside className="h-fit self-start p-2">
          <h2 className="text-xl font-semibold tracking-tight">
            Recent activity
          </h2>
          <ol className="mt-3">
            {profile.activity.slice(0, 8).map((item, index, activity) => {
              const Icon = activityIcon[item.type];
              const isLast = index === activity.length - 1;

              return (
                <li
                  className="grid grid-cols-[0.75rem_minmax(0,1fr)] gap-3"
                  key={item.title}
                >
                  <div className="relative flex justify-center">
                    <Icon
                      aria-hidden="true"
                      className="mt-0.5 size-3 shrink-0 text-emerald-500"
                      strokeWidth={2.25}
                    />
                    {!isLast ? (
                      <span className="absolute top-5 bottom-1 w-0.5 rounded-full bg-border" />
                    ) : null}
                  </div>
                  <article className="pb-5">
                    <div className="text-xs font-medium text-muted-foreground">
                      <time dateTime={item.dateTime}>{item.time}</time>
                    </div>
                    <h3 className="mt-0.5 text-sm font-semibold leading-5 text-pretty">
                      {item.title}
                    </h3>
                    <p className="mt-1 text-sm leading-5 text-muted-foreground text-pretty">
                      {item.description}
                    </p>
                  </article>
                </li>
              );
            })}
          </ol>
        </aside>
      </div>
    </main>
  );
}
