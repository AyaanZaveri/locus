"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BuildingIcon, BriefcaseBusinessIcon } from "lucide-react";

import {
  Command,
  CommandDialog,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  commandScore,
} from "@/components/ui/command";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import type { CompanyProfile } from "@/lib/company-profile";

type CompanySearchProps = {
  companies: CompanyProfile[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const noSelectionValue = "__locus_no_command_selection__";
const suggestedCompanyLimit = 6;
const companyResultLimit = 6;
const personResultLimit = 8;
const jobResultLimit = 10;

type PersonResult = {
  company: CompanyProfile;
  person: CompanyProfile["people"][number];
  index: number;
};

type JobResult = {
  company: CompanyProfile;
  job: CompanyProfile["jobs"][number];
  index: number;
};

function rankResults<T>(
  records: T[],
  query: string,
  getSearchValue: (record: T) => string,
  limit: number,
) {
  return records
    .map((record, index) => ({
      record,
      index,
      score: commandScore(getSearchValue(record), query),
    }))
    .filter((result) => result.score > 0)
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .slice(0, limit)
    .map(({ record }) => record);
}

export function CompanySearch({
  companies,
  open,
  onOpenChange,
}: CompanySearchProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [selectedValue, setSelectedValue] = useState(noSelectionValue);
  const listRef = useRef<HTMLDivElement>(null);
  const results = useMemo(() => {
    const query = search.trim();

    if (!query) {
      return {
        companies: companies.slice(0, suggestedCompanyLimit),
        people: [] as PersonResult[],
        jobs: [] as JobResult[],
      };
    }

    const people = companies.flatMap((company) =>
      company.people.map((person, index) => ({ company, person, index })),
    );
    const jobs = companies.flatMap((company) =>
      company.jobs.map((job, index) => ({ company, job, index })),
    );

    return {
      companies: rankResults(
        companies,
        query,
        (company) =>
          `${company.name} ${company.industry} ${company.location.label} ${company.slug}`,
        companyResultLimit,
      ),
      people: rankResults(
        people,
        query,
        ({ company, person }) =>
          `${person.name} ${person.role} ${company.name} ${company.slug}`,
        personResultLimit,
      ),
      jobs: rankResults(
        jobs,
        query,
        ({ company, job }) =>
          `${job.title} ${job.focus} ${job.department ?? ""} ${job.location} ${job.description ?? ""} ${job.skills?.join(" ") ?? ""} ${company.name} ${company.slug}`,
        jobResultLimit,
      ),
    };
  }, [companies, search]);
  const hasResults =
    results.companies.length > 0 ||
    results.people.length > 0 ||
    results.jobs.length > 0;

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        onOpenChange(!open);
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onOpenChange, open]);

  useLayoutEffect(() => {
    setSelectedValue(noSelectionValue);
    listRef.current?.scrollTo({ top: 0 });
  }, [open, search]);

  function handleSearchChange(nextSearch: string) {
    setSearch(nextSearch);
    setSelectedValue(noSelectionValue);
  }

  function visitCompany(slug: string) {
    onOpenChange(false);
    router.push(`/company/${slug}`);
  }

  function visitPerson(slug: string) {
    onOpenChange(false);
    router.push(`/company/${slug}#key-people`);
  }

  function visitJob(job: CompanyProfile["jobs"][number], slug: string) {
    onOpenChange(false);

    if (job.url) {
      window.open(job.url, "_blank", "noopener,noreferrer");
      return;
    }

    router.push(`/company/${slug}#jobs`);
  }

  function initials(name: string) {
    return name
      .split(" ")
      .map((part) => part[0])
      .join("");
  }

  return (
    <CommandDialog
      description="Search companies, people, and open jobs."
      onOpenChange={onOpenChange}
      open={open}
      title="Search Locus"
      className="inset-x-4 top-4 w-auto max-w-none translate-x-0 translate-y-0 sm:left-1/2 sm:right-auto sm:top-1/2 sm:w-full sm:max-w-xl sm:-translate-x-1/2 sm:-translate-y-1/2"
    >
      <Command
        onValueChange={setSelectedValue}
        shouldFilter={false}
        value={selectedValue}
      >
        <CommandInput
          autoFocus
          onValueChange={handleSearchChange}
          placeholder="Search companies, people, and jobs..."
          value={search}
        />
        <CommandList
          ref={listRef}
          className="max-h-[min(24rem,calc(100dvh-12rem))] sm:max-h-[min(30rem,calc(100dvh-4rem))]"
        >
          {!hasResults ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No matching companies, people, or jobs.
            </p>
          ) : (
            <>
              {results.companies.length > 0 ? (
                <CommandGroup
                  heading={search.trim() ? "Companies" : "Suggested companies"}
                >
                  {results.companies.map((company) => (
                    <CommandItem
                      key={company.slug}
                      onSelect={() => visitCompany(company.slug)}
                      value={`company-${company.slug}`}
                      className="items-center gap-3 py-2"
                    >
                      {company.logo ? (
                        <img
                          alt=""
                          aria-hidden="true"
                          className="size-8 rounded-sm object-contain ring-1 ring-border/50 shadow-xs"
                          src={company.logo}
                        />
                      ) : (
                        <div className="flex size-8 items-center justify-center rounded-sm bg-muted text-muted-foreground">
                          <BuildingIcon />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{company.name}</p>
                        <div className="mt-1 flex flex-wrap gap-1.5">
                          <Badge
                            className="h-5 border-border bg-background px-1.5 text-[11px]"
                            variant="outline"
                          >
                            {company.industry}
                          </Badge>
                          <Badge
                            className="h-5 border-border bg-background px-1.5 text-[11px]"
                            variant="outline"
                          >
                            <img
                              alt=""
                              aria-hidden="true"
                              className="size-2.5 rounded-full"
                              src={`https://hatscripts.github.io/circle-flags/flags/${company.location.countryCode}.svg`}
                            />
                            {company.location.label}
                          </Badge>
                        </div>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              ) : null}

              {results.people.length > 0 ? (
                <CommandGroup heading="People">
                  {results.people.map(({ company, person, index }) => (
                    <CommandItem
                      key={`${company.slug}-${person.name}-${person.role}-${index}`}
                      onSelect={() => visitPerson(company.slug)}
                      value={`person-${company.slug}-${index}`}
                      className="items-center gap-3 py-2"
                    >
                      <Avatar className="size-8">
                        {person.image ? (
                          <AvatarImage
                            alt=""
                            src={person.image}
                            className="ring-1 ring-border/50 shadow-xs"
                          />
                        ) : null}
                        <AvatarFallback>{initials(person.name)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{person.name}</p>
                        <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                          <span className="truncate">{person.role} @</span>
                          {company.logo ? (
                            <img
                              alt=""
                              aria-hidden="true"
                              className="size-3 shrink-0 rounded-[3px] object-contain ring-1 ring-border/50"
                              src={company.logo}
                            />
                          ) : null}
                          <span className="truncate">{company.name}</span>
                        </p>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              ) : null}

              {results.jobs.length > 0 ? (
                <CommandGroup heading="Jobs">
                  {results.jobs.map(({ company, job, index }) => (
                    <CommandItem
                      key={`${company.slug}-${job.title}-${job.location}-${index}`}
                      onSelect={() => visitJob(job, company.slug)}
                      value={`job-${company.slug}-${index}`}
                      className="items-center gap-3 py-2"
                    >
                      {company.logo ? (
                        <img
                          alt=""
                          aria-hidden="true"
                          className="size-8 rounded-sm object-contain ring-1 ring-border/50 shadow-xs"
                          src={company.logo}
                        />
                      ) : (
                        <div className="flex size-8 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                          <BriefcaseBusinessIcon />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{job.title}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {company.name} · {job.focus}
                        </p>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              ) : null}
            </>
          )}
        </CommandList>
      </Command>
    </CommandDialog>
  );
}
