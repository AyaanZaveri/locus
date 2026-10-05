"use client";

import { ArrowRight, BriefcaseBusinessIcon, BuildingIcon } from "lucide-react";
import Link from "next/link";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { CommandItem } from "@/components/ui/command";
import { jobDetailsHref } from "@/lib/job-navigation";
import { personDetailsHref } from "@/lib/person-navigation";

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
  url: string | null;
  countryCode?: string;
};

export type LocusJobResult = {
  title: string;
  focus: string;
  location: string;
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

type LocusResult =
  | { kind: "company"; result: LocusCompanyResult }
  | { kind: "person"; result: LocusPersonResult }
  | { kind: "job"; result: LocusJobResult };

type LocusResultRowProps =
  | (LocusResult & {
      variant: "command";
      value: string;
      onSelect: () => void;
    })
  | (LocusResult & {
      variant: "link";
      onNavigate?: () => void;
    });

const rowClassName = "locus-result-row items-center gap-3 py-2";

function ResultTitle({
  children,
  showArrow,
}: {
  children: React.ReactNode;
  showArrow: boolean;
}) {
  return (
    <p className="flex min-w-0 items-center gap-1 font-medium">
      <span className="truncate">{children}</span>
      {showArrow ? (
        <ArrowRight
          aria-hidden="true"
          className="locus-result-arrow size-4 shrink-0 text-muted-foreground"
        />
      ) : null}
    </p>
  );
}

export function locusResultHref(result: LocusResult) {
  if (result.kind === "company") return `/company/${result.result.slug}`;
  if (result.kind === "person") {
    return personDetailsHref({
      companySlug: result.result.companySlug,
      name: result.result.name,
      url: result.result.url,
    });
  }

  return jobDetailsHref({
    companySlug: result.result.companySlug,
    title: result.result.title,
    location: result.result.location,
    url: result.result.url,
  });
}

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
       src={`https://hatscripts.github.io/circle-flags/flags/${countryCode.toLowerCase()}.svg`}
    />
  ) : null;
}

function LocusResultRowContent(props: LocusResult & { showArrow: boolean }) {
  if (props.kind === "company") {
    const { result } = props;
    return (
      <>
        {result.logo ? (
          <img
            alt=""
            aria-hidden="true"
            className="size-8 rounded-sm object-contain ring-1 ring-border/50 shadow-xs"
            src={result.logo}
          />
        ) : (
          <div className="flex size-8 shrink-0 items-center justify-center rounded-sm bg-muted text-muted-foreground">
            <BuildingIcon className="size-4" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <ResultTitle showArrow={props.showArrow}>{result.name}</ResultTitle>
          <div className="mt-1 flex flex-wrap gap-1.5">
            <Badge
              className="h-5 border-border bg-background px-1.5 text-[11px]"
              variant="outline"
            >
              {result.industry}
            </Badge>
            <Badge
              className="h-5 max-w-full border-border bg-background px-1.5 text-[11px]"
              variant="outline"
            >
              <LocationFlag countryCode={result.countryCode} />
              <span className="truncate">{result.location}</span>
            </Badge>
          </div>
        </div>
      </>
    );
  }

  if (props.kind === "person") {
    const { result } = props;
    return (
      <>
        <Avatar className="size-8">
          {result.image ? <AvatarImage alt="" src={result.image} /> : null}
          <AvatarFallback>{initials(result.name)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <ResultTitle showArrow={props.showArrow}>{result.name}</ResultTitle>
          <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
            <span className="truncate font-medium">{result.role} @</span>
            {result.companyLogo ? (
              <img
                alt=""
                aria-hidden="true"
                className="size-3 shrink-0 rounded-[3px] object-contain ring-1 ring-border/50"
                src={result.companyLogo}
              />
            ) : null}
            <span className="truncate">{result.companyName}</span>
          </p>
        </div>
      </>
    );
  }

  const { result } = props;
  return (
    <>
      {result.companyLogo ? (
        <img
          alt=""
          aria-hidden="true"
          className="size-8 rounded-sm object-contain ring-1 ring-border/50 shadow-xs"
          src={result.companyLogo}
        />
      ) : (
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
          <BriefcaseBusinessIcon className="size-4" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <ResultTitle showArrow={props.showArrow}>{result.title}</ResultTitle>
        <p className="truncate text-xs text-muted-foreground">
          <span className="font-medium">{result.companyName}</span> ·{" "}
          {result.focus}
        </p>
      </div>
    </>
  );
}

export function LocusResultRow(props: LocusResultRowProps) {
  const href = locusResultHref(props);

  if (props.variant === "command") {
    return (
      <CommandItem
        className={rowClassName}
        draggable={false}
        onDragStart={(event) => event.preventDefault()}
        onSelect={props.onSelect}
        value={props.value}
      >
        <LocusResultRowContent {...props} showArrow={false} />
      </CommandItem>
    );
  }

  return (
    <Link
      className={`group/command-item flex w-full min-w-0 cursor-pointer items-center rounded-lg px-2 text-sm outline-hidden transition-transform duration-150 ease-[cubic-bezier(0.2,0,0,1)] hover:bg-muted focus-visible:bg-muted active:scale-[0.995] motion-reduce:transform-none motion-reduce:transition-none ${rowClassName}`}
      href={href}
      draggable={false}
      onDragStart={(event) => event.preventDefault()}
      onClick={props.onNavigate}
    >
      <LocusResultRowContent {...props} showArrow />
    </Link>
  );
}
