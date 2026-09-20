"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BuildingIcon, BriefcaseBusinessIcon } from "lucide-react";

import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  commandFilter,
} from "@/components/ui/command";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import type { CompanyProfile } from "@/lib/company-profile";

type CompanySearchProps = {
  companies: CompanyProfile[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const noSelectionValue = "__autumn_no_command_selection__";

export function CompanySearch({
  companies,
  open,
  onOpenChange,
}: CompanySearchProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [selectedValue, setSelectedValue] = useState(noSelectionValue);
  const listRef = useRef<HTMLDivElement>(null);

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
      title="Search Autumn"
      className="sm:max-w-xl"
    >
      <Command
        filter={commandFilter}
        onValueChange={setSelectedValue}
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
          className="max-h-[min(24rem,calc(100dvh-12rem))]"
        >
          <CommandEmpty>No matching companies, people, or jobs.</CommandEmpty>

          <CommandGroup heading="Companies">
            {companies.map((company) => (
              <CommandItem
                key={company.slug}
                onSelect={() => visitCompany(company.slug)}
                value={`${company.name} ${company.industry} ${company.location.label} ${company.slug}`}
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
                    <Badge className="h-5 border-border/50 bg-background/70 px-1.5 text-[11px]" variant="outline">{company.industry}</Badge>
                    <Badge className="h-5 border-border/50 bg-background/70 px-1.5 text-[11px]" variant="outline">
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

          <CommandGroup heading="People">
            {companies.flatMap((company) =>
              company.people.map((person, index) => (
                <CommandItem
                  key={`${company.slug}-${person.name}-${person.role}-${index}`}
                  onSelect={() => visitPerson(company.slug)}
                  value={`${person.name} ${person.role} ${company.name} ${company.slug} ${index}`}
                  className="items-center gap-3 py-2"
                >
                  <Avatar className="size-8">
                    {person.image ? <AvatarImage alt="" src={person.image} className="ring-1 ring-border/50 shadow-xs" /> : null}
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
              )),
            )}
          </CommandGroup>

          <CommandGroup heading="Jobs">
            {companies.flatMap((company) =>
              company.jobs.map((job, index) => (
                <CommandItem
                  key={`${company.slug}-${job.title}-${job.location}-${index}`}
                  onSelect={() => visitJob(job, company.slug)}
                  value={`${job.title} ${job.focus} ${job.location} ${company.name} ${company.slug} ${index}`}
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
              )),
            )}
          </CommandGroup>
        </CommandList>
      </Command>
    </CommandDialog>
  );
}
