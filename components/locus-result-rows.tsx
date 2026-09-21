import { ArrowRight, BriefcaseBusinessIcon, BuildingIcon } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import Link from "next/link";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

export type LocusCompanyResult = {
  slug: string;
  name: string;
  logo: string | null;
  industry: string;
  location: string;
  countryCode?: string;
};

export type LocusPersonResult = {
  name: string;
  role: string;
  image: string | null;
  companySlug: string;
  companyName: string;
  companyLogo: string | null;
  countryCode?: string;
};

export type LocusJobResult = {
  title: string;
  focus: string;
  location?: string;
  url: string | null;
  companySlug: string;
  companyName: string;
  companyLogo: string | null;
  countryCode?: string;
};

export type LocusSearchResults = {
  companies: LocusCompanyResult[];
  people: LocusPersonResult[];
  jobs: LocusJobResult[];
};

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("");
}

function LocationFlag({ countryCode }: { countryCode?: string }) {
  return countryCode ? (
    <img
      alt=""
      aria-hidden="true"
      className="size-2.5 shrink-0 rounded-full"
      src={`https://hatscripts.github.io/circle-flags/flags/${countryCode}.svg`}
    />
  ) : null;
}

function Row({
  children,
  external = false,
  href,
  index,
}: {
  children: React.ReactNode;
  external?: boolean;
  href: string;
  index: number;
}) {
  const reduceMotion = useReducedMotion();
  const className =
    "group flex w-full min-w-0 items-center gap-3 rounded-lg px-2 py-2 transition-transform duration-150 ease-[cubic-bezier(0.2,0,0,1)] hover:bg-muted active:scale-[0.995] motion-reduce:transition-none motion-reduce:active:scale-100";

  return (
    <motion.div
      animate={{ opacity: 1, transform: "translateY(0)" }}
      initial={{
        opacity: 0,
        transform: reduceMotion ? "none" : "translateY(10px)",
      }}
      transition={{
        delay: reduceMotion ? 0 : index * 0.05,
        duration: 0.18,
        ease: [0.23, 1, 0.32, 1],
      }}
    >
      {external ? (
        <a className={className} href={href} rel="noreferrer" target="_blank">
          {children}
        </a>
      ) : (
        <Link className={className} href={href}>
          {children}
        </Link>
      )}
    </motion.div>
  );
}

export function LocusResultRows({
  companies,
  people,
  jobs,
}: LocusSearchResults) {
  if (!companies.length && !people.length && !jobs.length) return null;

  return (
    <div className="w-full space-y-1">
      {companies.map((company, index) => (
        <Row href={`/company/${company.slug}`} index={index} key={company.slug}>
          {company.logo ? (
            <img
              alt=""
              aria-hidden="true"
              className="size-8 rounded-sm object-contain ring-1 ring-border/50 shadow-xs"
              src={company.logo}
            />
          ) : (
            <div className="flex size-8 shrink-0 items-center justify-center rounded-sm bg-muted text-muted-foreground">
              <BuildingIcon className="size-4" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1 truncate text-sm font-medium">
              <span className="truncate">{company.name}</span>
              <ArrowRight
                aria-hidden="true"
                className="size-4 shrink-0 scale-[0.25] text-muted-foreground opacity-0 [filter:blur(4px)] transition-[opacity,scale,filter] duration-150 ease-[cubic-bezier(0.2,0,0,1)] group-hover:scale-100 group-hover:opacity-100 group-hover:[filter:blur(0px)] motion-reduce:transition-none"
              />
            </p>
            <div className="mt-1 flex flex-wrap gap-1.5">
              <Badge
                className="h-5 border-border bg-background px-1.5 text-[11px]"
                variant="outline"
              >
                {company.industry}
              </Badge>
              <Badge
                className="h-5 max-w-full border-border bg-background px-1.5 text-[11px]"
                variant="outline"
              >
                <LocationFlag countryCode={company.countryCode} />
                <span className="truncate">{company.location}</span>
              </Badge>
            </div>
          </div>
        </Row>
      ))}

      {people.map((person, index) => (
        <Row
          href={`/company/${person.companySlug}#key-people`}
          index={companies.length + index}
          key={`${person.companySlug}-${person.name}-${index}`}
        >
          <Avatar className="size-8">
            {person.image ? <AvatarImage alt="" src={person.image} /> : null}
            <AvatarFallback>{initials(person.name)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1 truncate text-sm font-medium">
              <span className="truncate">{person.name}</span>
              <ArrowRight
                aria-hidden="true"
                className="size-4 shrink-0 scale-[0.25] text-muted-foreground opacity-0 [filter:blur(4px)] transition-[opacity,scale,filter] duration-150 ease-[cubic-bezier(0.2,0,0,1)] group-hover:scale-100 group-hover:opacity-100 group-hover:[filter:blur(0px)] motion-reduce:transition-none"
              />
            </p>
            <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
              <span className="truncate font-medium">{person.role} @</span>
              {person.companyLogo ? (
                <img
                  alt=""
                  aria-hidden="true"
                  className="size-3 shrink-0 rounded-[3px] object-contain ring-1 ring-border/50"
                  src={person.companyLogo}
                />
              ) : null}
              <span className="truncate">{person.companyName}</span>
            </p>
          </div>
        </Row>
      ))}

      {jobs.map((job, index) => (
        <Row
          external={Boolean(job.url)}
          href={job.url ?? `/company/${job.companySlug}#jobs`}
          index={companies.length + people.length + index}
          key={`${job.companySlug}-${job.title}-${index}`}
        >
          {job.companyLogo ? (
            <img
              alt=""
              aria-hidden="true"
              className="size-8 rounded-sm object-contain ring-1 ring-border/50 shadow-xs"
              src={job.companyLogo}
            />
          ) : (
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <BriefcaseBusinessIcon className="size-4" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1 truncate text-sm font-medium">
              <span className="truncate">{job.title}</span>
              <ArrowRight
                aria-hidden="true"
                className="size-4 shrink-0 scale-[0.25] text-muted-foreground opacity-0 [filter:blur(4px)] transition-[opacity,scale,filter] duration-150 ease-[cubic-bezier(0.2,0,0,1)] group-hover:scale-100 group-hover:opacity-100 group-hover:[filter:blur(0px)] motion-reduce:transition-none"
              />
            </p>
            <p className="truncate text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <LocationFlag countryCode={job.countryCode} />
                {job.companyName}
              </span>{" "}
              · {job.focus}
            </p>
          </div>
        </Row>
      ))}
    </div>
  );
}
