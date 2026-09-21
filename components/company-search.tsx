"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircleIcon } from "lucide-react";
import {
  Command,
  CommandDialog,
  CommandGroup,
  CommandInput,
  CommandList,
} from "@/components/ui/command";
import {
  LocusResultRow,
  locusResultHref,
  type LocusSearchResults,
} from "@/components/locus-result-row";

type SearchResults = LocusSearchResults;

const noSelectionValue = "__locus_no_command_selection__";

export function CompanySearch({
  open,
  onOpenChange,
  suggestedCompanies,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  suggestedCompanies: SearchResults["companies"];
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [selectedValue, setSelectedValue] = useState(noSelectionValue);
  const [results, setResults] = useState<SearchResults>({
    companies: suggestedCompanies.slice(0, 6),
    people: [],
    jobs: [],
  });
  const [isLoading, setIsLoading] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const query = search.trim();
    if (!open || !query) return;
    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
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
    }, 120);
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
              if (!value.trim()) {
                setResults({
                  companies: suggestedCompanies.slice(0, 6),
                  people: [],
                  jobs: [],
                });
              }
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
          {!hasResults ? (
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
                    <LocusResultRow
                      kind="company"
                      key={company.slug}
                      onSelect={() => visitCompany(company.slug)}
                      result={company}
                      value={`company-${company.slug}`}
                      variant="command"
                    />
                  ))}
                </CommandGroup>
              ) : null}
              {results.people.length ? (
                <CommandGroup heading="People">
                  {results.people.map((person, index) => (
                    <LocusResultRow
                      kind="person"
                      key={`${person.companySlug}-${person.name}-${index}`}
                      onSelect={() => visitPerson(person.companySlug)}
                      result={person}
                      value={`person-${person.companySlug}-${index}`}
                      variant="command"
                    />
                  ))}
                </CommandGroup>
              ) : null}
              {results.jobs.length ? (
                <CommandGroup heading="Jobs">
                  {results.jobs.map((job, index) => (
                    <LocusResultRow
                      kind="job"
                      key={`${job.companySlug}-${job.title}-${index}`}
                      onSelect={() => {
                        onOpenChange(false);
                        router.push(
                          locusResultHref({ kind: "job", result: job }),
                        );
                      }}
                      result={job}
                      value={`job-${job.companySlug}-${index}`}
                      variant="command"
                    />
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
