// import { ProgressiveBlur } from "@/components/motion-primitives/progressive-blur";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CompanyJobs } from "@/components/company-jobs";
import { PersonCard } from "@/components/person-card";
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

function getBannerObjectPosition(position?: string) {
  if (!position) return "center";
  if (position.startsWith("object-[") && position.endsWith("]")) {
    return position.slice(8, -1).replaceAll("_", " ");
  }

  const namedPositions: Record<string, string> = {
    "object-bottom": "bottom",
    "object-center": "center",
    "object-left": "left",
    "object-left-bottom": "left bottom",
    "object-left-top": "left top",
    "object-right": "right",
    "object-right-bottom": "right bottom",
    "object-right-top": "right top",
    "object-top": "top",
  };

  return namedPositions[position] ?? "center";
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
      className="min-h-0 min-w-0 flex-1 overflow-y-auto ps-3 pe-1.5 pt-3 pb-20 md:p-6 md:pb-20"
    >
      <div className="mx-auto grid w-full min-w-0 max-w-7xl gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0">
          <div className="relative w-full max-w-full">
            <div className="relative isolate aspect-[1200/630] overflow-hidden rounded-lg ring-1 ring-black/10 shadow-xs md:aspect-[16/7] dark:ring-white/10">
              {profile.banner ? (
                <img
                  alt={`${profile.name} banner`}
                  draggable={false}
                  className="block size-full max-w-full object-cover"
                  style={{
                    objectPosition: getBannerObjectPosition(profile.bannerPosition),
                  }}
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
              className="absolute top-3 left-3 size-8 rounded-lg border-border/50 bg-background/85 p-0 text-foreground shadow-xs backdrop-blur-xl backdrop-saturate-150 hover:bg-background/95 md:hidden dark:bg-background/75 dark:hover:bg-background/85 [&_svg]:size-4!"
              size="icon"
            />
            <div className="absolute -bottom-8 left-4 rounded-xl ring-1 ring-border/75 bg-background/30 p-1 shadow-xs backdrop-blur-sm sm:-bottom-6 sm:left-5">
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
                  src={`https://hatscripts.github.io/circle-flags/flags/${profile.location.countryCode.toLowerCase()}.svg`}
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
                     {profile.financials.totalFunding?.display ?? "Undisclosed"}
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
                                      className={cn(
                                        "rounded-full border-border bg-background dark:border-border dark:bg-background",
                                        investor.website && "investor-link",
                                      )}
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
                                          className="mr-0.5 size-3 rounded-full object-contain"
                                          src={investor.logo}
                                        />
                                      ) : null}
                                      <span className="inline-flex items-center">
                                        {investor.name}
                                        {investor.website ? (
                                          <span
                                            aria-hidden="true"
                                            className="investor-arrow grid w-0 shrink-0 overflow-hidden text-muted-foreground opacity-0"
                                          >
                                            <ArrowUpRight
                                              className="size-3.5 shrink-0"
                                              strokeWidth={2.25}
                                            />
                                          </span>
                                        ) : null}
                                      </span>
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
                  <PersonCard key={person.name} person={person} />
                ))}
              </div>
            </section>

            {profile.jobs.length ? (
              <CompanyJobs
                company={{ name: profile.name, logo: profile.logo }}
                jobs={profile.jobs}
              />
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
