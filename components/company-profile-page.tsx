// import { ProgressiveBlur } from "@/components/motion-primitives/progressive-blur";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  type ActivityType,
  type CompanyProfile,
} from "@/lib/company-profile";
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

export function CompanyProfilePage({ profile }: { profile: CompanyProfile }) {
  const latestRound =
    profile.funding.rounds.find(
      (round) => round.id === profile.funding.latestRoundId,
    ) ?? profile.funding.rounds[0];
  const previousRounds = profile.funding.rounds.filter(
    (round) => round.id !== latestRound?.id,
  );

  return (
    <main id="top" className="min-h-0 flex-1 overflow-y-auto p-6">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div>
          <div className="relative max-w-8xl">
            <div className="relative isolate h-72 overflow-hidden rounded-lg shadow-xs">
              {profile.banner ? (
                <img
                  alt={`${profile.name} banner`}
                  draggable={false}
                  className={cn(
                    "size-full object-cover",
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
            <div className="absolute -bottom-8 left-4 rounded-xl ring-1 ring-border/50 bg-background/30 p-1 shadow-xs backdrop-blur-sm sm:-bottom-6 sm:left-5">
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
            <section className="mt-6 max-w-3xl">
              <h2 className="text-lg font-semibold tracking-tight">Funding</h2>
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
                    const isLast = index === profile.funding.rounds.length - 1;

                    return (
                      <div
                        className="grid grid-cols-[0.75rem_minmax(0,1fr)] gap-3"
                        key={round.id}
                      >
                        <div className="relative flex justify-center">
                          <span
                            className={cn(
                              "mt-1.5 size-2 shrink-0 rounded-full bg-muted-foreground/50",
                              isLatest && "bg-[#d86b23]",
                            )}
                          />
                          {!isLast ? (
                            <span className="absolute top-5 bottom-0 w-0.5 rounded-full bg-border" />
                          ) : null}
                        </div>
                        <article className="pb-5">
                          <div className="min-w-0">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-sm font-medium">{round.stage}</p>
                                {formatFundingDate(round.announcedAt) ? (
                                  <p className="mt-0.5 text-xs font-medium text-muted-foreground">
                                    {formatFundingDate(round.announcedAt)}
                                  </p>
                                ) : null}
                                {round.leadInvestors.length ? (
                                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                                    {round.leadInvestors.map((investor) => (
                                      <Button
                                        className="rounded-full"
                                        key={investor.name}
                                        nativeButton={false}
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
                                            className="size-3 rounded-full object-contain"
                                            src={investor.logo}
                                          />
                                        ) : null}
                                        {investor.name}
                                      </Button>
                                    ))}
                                  </div>
                                ) : null}
                              </div>
                              <p className="shrink-0 font-mono text-base font-semibold tabular-nums">
                                {round.amount.display}
                              </p>
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

          <section className="mt-6 max-w-3xl">
            <h2 className="text-lg font-semibold tracking-tight">Key people</h2>
            <div className="mt-4 grid grid-cols-2 gap-3">
              {profile.people.map((person) => (
                <div
                  className="flex items-center gap-3 rounded-lg border border-border/50 bg-background p-3"
                  key={person.name}
                >
                  <Avatar className="size-10">
                    {person.image ? (
                      <AvatarImage alt={person.name} src={person.image} className={"ring-1 ring-border/50 shadow-xs"} />
                    ) : null}
                    <AvatarFallback>
                      {person.name
                        .split(" ")
                        .map((part) => part[0])
                        .join("")}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{person.name}</p>
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
                          <a href={person.x} rel="noreferrer" target="_blank" />
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
            <section className="mt-6 max-w-3xl">
              <h2 className="text-lg font-semibold tracking-tight">Jobs</h2>
              <div className="mt-3 flex flex-col gap-3">
                {profile.jobs.map((job, index) => {
                  const jobKey = `${job.title}-${job.location}-${job.focus}-${job.url ?? ""}-${index}`;
                  const card = (
                    <article className="group flex items-center gap-3 rounded-lg border border-border/50 bg-background p-3 transition-[background-color] duration-150 ease-[cubic-bezier(0.2,0,0,1)] hover:bg-muted/25 motion-reduce:transition-none">
                      {profile.logo ? (
                        <img
                          alt={`${profile.name} logo`}
                          className="size-10 shrink-0 rounded-lg object-contain ring-1 ring-border/50 shadow-xs"
                          draggable={false}
                          src={profile.logo}
                        />
                      ) : (
                        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-sm font-semibold text-muted-foreground">
                          {profile.name.slice(0, 1)}
                        </div>
                      )}
                      <div className="min-w-0">
                        <h3 className="flex items-center gap-1 truncate text-sm font-semibold">
                          <span className="truncate">{job.title}</span>
                          {job.url ? (
                            <ArrowUpRight
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
                            src={`https://hatscripts.github.io/circle-flags/flags/${profile.location.countryCode}.svg`}
                          />
                          <span>{job.location}</span>
                          <span aria-hidden="true">·</span>
                          <span className="text-xs font-medium text-muted-foreground">
                            {job.focus}
                          </span>
                        </div>
                      </div>
                    </article>
                  );

                  return job.url ? (
                    <a
                      className="group block rounded-lg transition-transform duration-150 ease-[cubic-bezier(0.2,0,0,1)] active:scale-[0.995] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none"
                      draggable={false}
                      href={job.url}
                      key={jobKey}
                      rel="noreferrer"
                      target="_blank"
                    >
                      {card}
                    </a>
                  ) : (
                    <div key={jobKey}>{card}</div>
                  );
                })}
              </div>
            </section>
          ) : null}
        </div>

        <aside className="h-fit self-start p-2">
          <h2 className="text-xl font-semibold tracking-tight">Recent activity</h2>
          <ol className="mt-3 space-y-5">
            {profile.activity.slice(0, 5).map((item) => {
              const Icon = activityIcon[item.type]

              return (
                <li
                  className="min-w-0"
                  key={item.title}
                >
                  <article>
                    <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                      <time dateTime={item.dateTime}>{item.time}</time>
                      <Icon
                        aria-hidden="true"
                        className="size-3 text-[#d86b23]"
                        strokeWidth={2.25}
                      />
                    </div>
                    <h3 className="mt-0.5 text-sm font-semibold leading-5 text-pretty">
                      {item.title}
                    </h3>
                    <p className="mt-1 text-sm leading-5 text-muted-foreground text-pretty">
                      {item.description}
                    </p>
                  </article>
                </li>
              )
            })}
          </ol>
        </aside>
      </div>
    </main>
  );
}
