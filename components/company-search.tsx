"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircleIcon } from "lucide-react";
import { CommandSearchCache } from "@/lib/command-search-cache";
import { immediateCompanyMatches } from "@/lib/command-company-matches";
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
const emptyResults: SearchResults = { companies: [], people: [], jobs: [] };

export function CompanySearch({
  open,
  onOpenChange,
  suggestedCompanies,
  companies,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  suggestedCompanies: SearchResults["companies"];
  companies: SearchResults["companies"];
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [selectedValue, setSelectedValue] = useState(noSelectionValue);
  const [snapshot, setSnapshot] = useState({
    query: "",
    results: emptyResults,
    error: false,
  });
  const cache = useRef(new CommandSearchCache<SearchResults>());
  const listRef = useRef<HTMLDivElement>(null);
  const query = search.trim();
  const isLoading = open && Boolean(query) && snapshot.query !== query;
  // Never allow keyboard navigation into results from an older query.
  const results = !query
    ? { companies: suggestedCompanies.slice(0, 6), people: [], jobs: [] }
    : snapshot.query === query
      ? snapshot.results
      : {
          companies: immediateCompanyMatches(companies, query),
          people: [],
          jobs: [],
        };

  useEffect(() => {
    if (!open || !query) return;
    const cached = cache.current.get(query);
    if (cached) {
      setSnapshot({ query, results: cached, error: false });
      return;
    }
    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/search?q=${encodeURIComponent(query)}`,
          { signal: controller.signal },
        );
        if (!response.ok) throw new Error("Search request failed.");
        const data = (await response.json()) as SearchResults;
        if (controller.signal.aborted) return;
        cache.current.set(query, data);
        setSnapshot({ query, results: data, error: false });
      } catch (error) {
        if (
          !controller.signal.aborted &&
          (error as DOMException).name !== "AbortError"
        )
          setSnapshot({ query, results: emptyResults, error: true });
      }
    }, 80);
    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [open, query]);

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
  const visitPerson = (person: SearchResults["people"][number]) => {
    onOpenChange(false);
    router.push(locusResultHref({ kind: "person", result: person }));
  };
  const hasResults = Boolean(
    results &&
    (results.companies.length || results.people.length || results.jobs.length),
  );
  const firstResultValue = results.companies[0]
    ? `company-${results.companies[0].slug}`
    : results.people[0]
      ? `person-${results.people[0].companySlug}-0`
      : results.jobs[0]
        ? `job-${results.jobs[0].companySlug}-0`
        : noSelectionValue;

  return (
    <CommandDialog
      description="Quickly find companies, people, and jobs."
      onOpenChange={onOpenChange}
      open={open}
      title="Search Locus"
      className="inset-x-4 top-4 w-auto max-w-none translate-x-0 translate-y-0 sm:left-1/2 sm:right-auto sm:top-1/2 sm:w-full sm:max-w-xl sm:-translate-x-1/2 sm:-translate-y-1/2"
    >
      <Command
        onValueChange={setSelectedValue}
        shouldFilter={false}
        value={
          query && selectedValue === noSelectionValue
            ? firstResultValue
            : selectedValue
        }
      >
        <div className="relative">
          <CommandInput
            autoFocus
            className={isLoading ? "pr-10" : undefined}
            onValueChange={(value) => {
              setSearch(value);
              setSelectedValue(noSelectionValue);
              const cached = cache.current.get(value.trim());
              if (cached)
                setSnapshot({
                  query: value.trim(),
                  results: cached,
                  error: false,
                });
            }}
            placeholder="Search companies, people, and jobs..."
            value={search}
          />
          {isLoading ? (
            <LoaderCircleIcon
              aria-label="Searching"
              role="status"
              className="pointer-events-none absolute right-3 top-1/2 size-3.5 -translate-y-1/2 animate-spin text-muted-foreground motion-reduce:animate-none"
            />
          ) : null}
        </div>
        <CommandList
          ref={listRef}
          aria-busy={isLoading}
          className="max-h-[min(24rem,calc(100dvh-12rem))] sm:max-h-[min(30rem,calc(100dvh-4rem))]"
        >
          {!hasResults ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {isLoading
                ? "Searching…"
                : snapshot.query === query && snapshot.error
                  ? "Search unavailable. Try again."
                  : "No matching companies, people, or jobs."}
              {!isLoading && !snapshot.error ? (
                <span className="mt-2 block text-xs">
                  For deeper searches, use Locus Focus (⌘J).
                </span>
              ) : null}
            </p>
          ) : (
            <>
              {results.companies.length ? (
                <CommandGroup
                  heading={search.trim() ? "Companies" : "Recently funded"}
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
                      onSelect={() => visitPerson(person)}
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
