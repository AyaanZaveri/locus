"use client";

import { useState } from "react";
import Link from "next/link";
import { Asterisk, Globe2, Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CompanyDirectoryItem } from "@/lib/company-profile";
import { cn } from "@/lib/utils";

const countryNames = new Intl.DisplayNames(["en"], { type: "region" });

export function CompaniesDirectory({
  companies,
}: {
  companies: CompanyDirectoryItem[];
}) {
  const [query, setQuery] = useState("");
  const [industry, setIndustry] = useState("all");
  const [location, setLocation] = useState("all");

  const industries = [
    ...new Set(companies.map((company) => company.industry)),
  ].sort((a, b) => a.localeCompare(b));
  const locationGroups = new Map<string, Set<string>>();
  for (const company of companies) {
    const code = company.location.countryCode.toUpperCase();
    if (!locationGroups.has(code)) locationGroups.set(code, new Set());
    locationGroups.get(code)!.add(company.location.label);
  }
  const groupedLocations = [...locationGroups]
    .map(([code, places]) => ({
      code,
      label: countryNames.of(code) ?? code,
      count: companies.filter(
        (company) => company.location.countryCode.toUpperCase() === code,
      ).length,
      places: [...places].sort((a, b) => a.localeCompare(b)),
    }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  const locationItems = [
    { label: "All locations", value: "all" },
    ...groupedLocations.flatMap((group) =>
      group.places.map((place) => ({ label: place, value: place })),
    ),
  ];
  const industryItems = [
    { label: "All industries", value: "all" },
    ...industries.map((value) => ({ label: value, value })),
  ];
  const selectedCountryCode = groupedLocations
    .find((group) => group.places.includes(location))
    ?.code.toLowerCase();
  const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  const visibleCompanies = companies.filter((company) => {
    if (industry !== "all" && company.industry !== industry) return false;
    if (location !== "all" && company.location.label !== location) return false;
    const searchable = [
      company.name,
      company.tagline,
      company.industry,
      company.location.label,
      company.stage,
    ]
      .join(" ")
      .toLocaleLowerCase();
    return terms.every((term) => searchable.includes(term));
  });

  if (!companies.length) {
    return <p className="text-sm text-muted-foreground">No companies yet.</p>;
  }

  return (
    <>
      <div className="mb-6 flex flex-wrap gap-2">
        <InputGroup className="w-full min-w-0 bg-transparent sm:max-w-sm dark:bg-input/30">
          <InputGroupAddon>
            <Search aria-hidden="true" />
          </InputGroupAddon>
          <InputGroupInput
            aria-label="Search companies"
            inputMode="search"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search companies..."
            type="text"
            value={query}
          />
        </InputGroup>
        <Select
          items={industryItems}
          onValueChange={(value) => setIndustry(value ?? "all")}
          value={industry}
        >
          <SelectTrigger
            aria-label="Filter by industry"
            className="min-w-0 flex-1 sm:w-44 sm:flex-none"
            title={industry === "all" ? "All industries" : industry}
          >
            <SelectValue className="min-w-0 truncate" />
          </SelectTrigger>
          <SelectContent
            align="start"
            alignItemWithTrigger={false}
            className="min-w-52"
          >
            <SelectGroup className="pb-0">
              <SelectItem className="pr-12" value="all">
                All industries
              </SelectItem>
            </SelectGroup>
            <SelectSeparator className="my-1" />
            <SelectGroup className="pt-0">
              <SelectLabel>Industries</SelectLabel>
              {industries.map((value) => (
                <SelectItem className="pr-12" key={value} value={value}>
                  {value}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        <Select
          items={locationItems}
          onValueChange={(value) => setLocation(value ?? "all")}
          value={location}
        >
          <SelectTrigger
            aria-label="Filter by location"
            className="min-w-0 flex-1 sm:w-52 sm:flex-none"
            title={location === "all" ? "All locations" : location}
          >
            {selectedCountryCode ? (
              <img
                alt=""
                aria-hidden="true"
                className="size-3.5 shrink-0 rounded-full"
                src={`https://hatscripts.github.io/circle-flags/flags/${selectedCountryCode}.svg`}
              />
            ) : (
              <Globe2
                aria-hidden="true"
                className="size-4 shrink-0 text-muted-foreground"
              />
            )}
            <SelectValue className="min-w-0 truncate" />
          </SelectTrigger>
          <SelectContent
            align="start"
            alignItemWithTrigger={false}
            className="min-w-60"
          >
            <SelectGroup className="pb-0">
              <SelectItem className="pr-12" value="all">
                <span className="flex items-center gap-2">
                  <Globe2
                    aria-hidden="true"
                    className="size-4 shrink-0 text-muted-foreground"
                  />
                  All locations
                </span>
              </SelectItem>
            </SelectGroup>
            <SelectSeparator className="my-1" />
            {groupedLocations.map((group, index) => (
              <SelectGroup
                className={index === 0 ? "pt-0" : undefined}
                key={group.code}
              >
                <SelectLabel>{group.label}</SelectLabel>
                {group.places.map((place) => (
                  <SelectItem className="pr-12" key={place} value={place}>
                    <span className="flex items-center gap-2">
                      <img
                        alt=""
                        aria-hidden="true"
                        className="size-3.5 shrink-0 rounded-full"
                        src={`https://hatscripts.github.io/circle-flags/flags/${group.code.toLowerCase()}.svg`}
                      />
                      {place}
                    </span>
                  </SelectItem>
                ))}
              </SelectGroup>
            ))}
          </SelectContent>
        </Select>
      </div>

      <p aria-live="polite" className="mb-5 text-sm text-muted-foreground">
        {visibleCompanies.length}{" "}
        {visibleCompanies.length === 1 ? "company" : "companies"}
        {visibleCompanies.length !== companies.length
          ? ` of ${companies.length}`
          : ""}
      </p>

      {visibleCompanies.length ? (
        <div className="grid gap-x-6 gap-y-10 md:grid-cols-2 xl:grid-cols-3">
          {visibleCompanies.map((company) => (
            <Link
              key={company.slug}
              href={`/company/${company.slug}`}
              draggable={false}
              className="company-directory-card group block min-w-0 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4 focus-visible:ring-offset-background"
            >
              <article>
                <div className="relative">
                  <div className="aspect-[2/1] overflow-hidden rounded-xl bg-muted ring-1 ring-border/60">
                    {company.banner ? (
                      <img
                        src={company.banner}
                        alt=""
                        draggable={false}
                        className={cn(
                          "size-full object-cover",
                          company.bannerPosition ?? "object-center",
                        )}
                      />
                    ) : (
                      <div className="flex size-full items-center justify-center text-5xl font-semibold text-muted-foreground/30">
                        {company.name.slice(0, 1)}
                      </div>
                    )}
                    <div className="company-directory-banner-overlay pointer-events-none absolute inset-0 rounded-xl bg-black/10 opacity-0" />
                  </div>
                  <div className="absolute -bottom-5 left-4 rounded-xl bg-background/30 p-1 shadow-xs ring-1 ring-border/75 backdrop-blur-sm">
                    <div className="rounded-lg bg-background/60">
                      {company.logo ? (
                        <img
                          src={company.logo}
                          alt=""
                          draggable={false}
                          className="size-11 rounded-lg object-contain ring-1 ring-border/25 sm:size-12"
                        />
                      ) : (
                        <span
                          className="flex size-11 items-center justify-center rounded-lg bg-muted text-lg font-semibold text-muted-foreground sm:size-12"
                          aria-hidden="true"
                        >
                          {company.name.slice(0, 1)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="px-1 pt-8">
                  <h2 className="text-lg font-semibold tracking-tight">
                    {company.name}
                  </h2>
                  <span className="line-clamp-2 text-sm font-medium leading-relaxed text-muted-foreground">
                    {company.tagline}
                  </span>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <Badge
                      variant="secondary"
                      className="h-4.5 px-1.5 text-[11px]"
                    >
                      {company.industry}
                    </Badge>
                    <Badge
                      variant="secondary"
                      className="h-4.5 px-1.5 text-[11px]"
                    >
                      <img
                        alt=""
                        aria-hidden="true"
                        draggable={false}
                        className="size-3 rounded-full"
                        src={`https://hatscripts.github.io/circle-flags/flags/${company.location.countryCode}.svg`}
                      />
                      {company.location.label}
                    </Badge>
                    <Badge
                      variant="secondary"
                      className="h-4.5 px-1.5 text-[11px]"
                    >
                      <Asterisk aria-hidden="true" />
                      {company.stage}
                    </Badge>
                  </div>
                </div>
              </article>
            </Link>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          No companies match your filters.
        </p>
      )}
    </>
  );
}
