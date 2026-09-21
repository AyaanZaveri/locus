"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BriefcaseBusinessIcon,
  BuildingIcon,
  LoaderCircleIcon,
} from "lucide-react";
import {
  Command,
  CommandDialog,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

type SearchResults = {
  companies: {
    slug: string;
    name: string;
    logo: string | null;
    industry: string;
    location: string;
    countryCode: string;
  }[];
  people: {
    name: string;
    role: string;
    image: string | null;
    companySlug: string;
    companyName: string;
    companyLogo: string | null;
  }[];
  jobs: {
    title: string;
    focus: string;
    url: string | null;
    companySlug: string;
    companyName: string;
    companyLogo: string | null;
  }[];
};

const noSelectionValue = "__locus_no_command_selection__";

export function CompanySearch({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [selectedValue, setSelectedValue] = useState(noSelectionValue);
  const [results, setResults] = useState<SearchResults | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    const query = search.trim();
    const timeout = window.setTimeout(
      async () => {
        setIsLoading(true);
        try {
          const response = await fetch(
            `/api/search?q=${encodeURIComponent(query)}`,
            { signal: controller.signal },
          );
          if (!response.ok) throw new Error("Search request failed.");
          setResults((await response.json()) as SearchResults);
        } catch (error) {
          if ((error as DOMException).name !== "AbortError")
            setResults({ companies: [], people: [], jobs: [] });
        } finally {
          if (!controller.signal.aborted) setIsLoading(false);
        }
      },
      query ? 120 : 0,
    );
    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [open, search]);

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

  const visitCompany = (slug: string) => {
    onOpenChange(false);
    router.push(`/company/${slug}`);
  };
  const visitPerson = (slug: string) => {
    onOpenChange(false);
    router.push(`/company/${slug}#key-people`);
  };
  const visitJob = (url: string | null, slug: string) => {
    onOpenChange(false);
    if (url) window.open(url, "_blank", "noopener,noreferrer");
    else router.push(`/company/${slug}#jobs`);
  };
  const initials = (name: string) =>
    name
      .split(" ")
      .map((part) => part[0])
      .join("");
  const hasResults = Boolean(
    results &&
    (results.companies.length || results.people.length || results.jobs.length),
  );

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
        <div className="relative">
          <CommandInput
            autoFocus
            onValueChange={(value) => {
              setSearch(value);
              setSelectedValue(noSelectionValue);
            }}
            placeholder="Search companies, people, and jobs..."
            value={search}
          />
          {isLoading ? (
            <LoaderCircleIcon
              aria-label="Searching"
              className="pointer-events-none absolute right-3 top-1/2 size-3.5 -translate-y-1/2 animate-spin text-muted-foreground"
            />
          ) : null}
        </div>
        <CommandList
          ref={listRef}
          className="max-h-[min(24rem,calc(100dvh-12rem))] sm:max-h-[min(30rem,calc(100dvh-4rem))]"
        >
          {!results ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Loading…
            </p>
          ) : !hasResults ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No matching companies, people, or jobs.
            </p>
          ) : (
            <>
              {results.companies.length ? (
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
                              src={`https://hatscripts.github.io/circle-flags/flags/${company.countryCode}.svg`}
                            />
                            {company.location}
                          </Badge>
                        </div>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              ) : null}
              {results.people.length ? (
                <CommandGroup heading="People">
                  {results.people.map((person, index) => (
                    <CommandItem
                      key={`${person.companySlug}-${person.name}-${index}`}
                      onSelect={() => visitPerson(person.companySlug)}
                      value={`person-${person.companySlug}-${index}`}
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
                    </CommandItem>
                  ))}
                </CommandGroup>
              ) : null}
              {results.jobs.length ? (
                <CommandGroup heading="Jobs">
                  {results.jobs.map((job, index) => (
                    <CommandItem
                      key={`${job.companySlug}-${job.title}-${index}`}
                      onSelect={() => visitJob(job.url, job.companySlug)}
                      value={`job-${job.companySlug}-${index}`}
                      className="items-center gap-3 py-2"
                    >
                      {job.companyLogo ? (
                        <img
                          alt=""
                          aria-hidden="true"
                          className="size-8 rounded-sm object-contain ring-1 ring-border/50 shadow-xs"
                          src={job.companyLogo}
                        />
                      ) : (
                        <div className="flex size-8 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                          <BriefcaseBusinessIcon />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{job.title}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {job.companyName} · {job.focus}
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
