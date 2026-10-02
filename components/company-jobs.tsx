"use client";

import { useMemo, useState } from "react";
import { getJobDepartmentIcon } from "@/components/job-department-icon";
import { JobCard } from "@/components/job-card";
import { Button } from "@/components/ui/button";
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
import { type CompanyProfile } from "@/lib/company-profile";
import { splitJobLocations } from "@/lib/job-location";
import { getJobLocationCountryCode } from "@/lib/job-location-country";
import { Globe2, Laptop, Search, UsersRound } from "lucide-react";

type Props = {
  company: Pick<CompanyProfile, "name" | "logo">;
  countryCode: string;
  jobs: CompanyProfile["jobs"];
};

const countryNames = new Intl.DisplayNames(["en"], { type: "region" });

function displayLocation(place: string) {
  return place
    .trim()
    .replace(/^Hybrid\s*[-–]\s*/i, "")
    .replace(/\s*(?:\((?:on-?site|hybrid)\)|\b(?:HQ|Hub|Headquarters))$/i, "");
}

function getLocationGroups(jobs: Props["jobs"]) {
  const counts = new Map<string, number>();
  const countryJobs = new Map<string, Set<number>>();

  for (const [index, job] of jobs.entries()) {
    for (const label of new Set(
      splitJobLocations(job.location).map(displayLocation),
    )) {
      if (!label || /\bremote\b/i.test(label)) continue;
      counts.set(label, (counts.get(label) ?? 0) + 1);
      const code = getJobLocationCountryCode(label) ?? "other";
      if (!countryJobs.has(code)) countryJobs.set(code, new Set());
      countryJobs.get(code)!.add(index);
    }
  }

  const placesByCountry = new Map<string, string[]>();
  for (const place of counts.keys()) {
    const code = getJobLocationCountryCode(place) ?? "other";
    if (!placesByCountry.has(code)) placesByCountry.set(code, []);
    placesByCountry.get(code)!.push(place);
  }

  return [...placesByCountry]
    .map(([code, places]) => ({
      code,
      label:
        code === "other"
          ? "Other locations"
          : (countryNames.of(code.toUpperCase()) ?? code),
      jobCount: countryJobs.get(code)?.size ?? 0,
      places: places.sort(
        (a, b) =>
          (counts.get(b) ?? 0) - (counts.get(a) ?? 0) || a.localeCompare(b),
      ),
    }))
    .sort(
      (a, b) =>
        (a.code === "other" ? 1 : 0) - (b.code === "other" ? 1 : 0) ||
        b.jobCount - a.jobCount ||
        a.label.localeCompare(b.label),
    );
}

function LocationIcon({ location }: { location: string }) {
  if (location === "all") {
    return (
      <Globe2
        aria-hidden="true"
        className="size-4 shrink-0 text-muted-foreground"
      />
    );
  }
  if (location === "remote") {
    return (
      <Laptop
        aria-hidden="true"
        className="size-4 shrink-0 text-muted-foreground"
      />
    );
  }

  const code = getJobLocationCountryCode(location);
  return code ? (
    <img
      alt=""
      aria-hidden="true"
      className="size-3.5 shrink-0 rounded-full"
      src={`https://hatscripts.github.io/circle-flags/flags/${code}.svg`}
    />
  ) : (
    <Globe2
      aria-hidden="true"
      className="size-3.5 shrink-0 text-muted-foreground"
    />
  );
}

export function CompanyJobs({ company, countryCode, jobs }: Props) {
  const [query, setQuery] = useState("");
  const [location, setLocation] = useState("all");
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([]);

  const departments = useMemo(
    () =>
      [
        ...new Set(
          jobs
            .map((job) => job.department)
            .filter((value): value is string => Boolean(value)),
        ),
      ].sort((a, b) => a.localeCompare(b)),
    [jobs],
  );
  const locationGroups = useMemo(() => getLocationGroups(jobs), [jobs]);
  const locations = useMemo(
    () => locationGroups.flatMap((group) => group.places),
    [locationGroups],
  );
  const hasRemoteJobs = jobs.some(
    (job) => job.workplaceType === "remote" || /\bremote\b/i.test(job.location),
  );
  const departmentItems = useMemo(
    () =>
      departments.map((department) => ({
        label: department,
        value: department,
      })),
    [departments],
  );
  const locationItems = useMemo(
    () => [
      { label: "Location", value: "all" },
      ...(hasRemoteJobs ? [{ label: "Remote", value: "remote" }] : []),
      ...locations.map((place) => ({ label: place, value: place })),
    ],
    [hasRemoteJobs, locations],
  );
  const SelectedDepartmentIcon =
    selectedDepartments.length === 1
      ? getJobDepartmentIcon(selectedDepartments[0])
      : UsersRound;
  const SingleDepartmentIcon =
    departments.length === 1 ? getJobDepartmentIcon(departments[0]) : null;
  const searchTerms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const visibleJobs = jobs.filter((job) => {
    if (
      selectedDepartments.length &&
      (!job.department || !selectedDepartments.includes(job.department))
    )
      return false;
    if (
      location === "remote" &&
      job.workplaceType !== "remote" &&
      !/\bremote\b/i.test(job.location)
    )
      return false;
    if (
      location !== "all" &&
      location !== "remote" &&
      !splitJobLocations(job.location).some(
        (place) =>
          displayLocation(place).toLowerCase() === location.toLowerCase(),
      )
    )
      return false;
    if (!searchTerms.length) return true;

    const searchableText = [
      job.title,
      job.focus,
      job.department,
      job.location,
      ...(job.skills ?? []),
      job.description,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return searchTerms.every((term) => searchableText.includes(term));
  });

  function toggleDepartment(department: string) {
    setSelectedDepartments((current) =>
      current.includes(department)
        ? current.filter((value) => value !== department)
        : [...current, department],
    );
  }

  return (
    <section id="jobs" className="mt-6 max-w-none scroll-mt-6">
      <h2 className="text-lg font-semibold tracking-tight">Jobs</h2>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <InputGroup className="w-full min-w-0 bg-transparent md:min-w-60 md:flex-1 dark:bg-input/30">
          <InputGroupAddon>
            <Search aria-hidden="true" />
          </InputGroupAddon>
          <InputGroupInput
            aria-label="Search jobs"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search jobs..."
            inputMode="search"
            type="text"
            value={query}
          />
          <InputGroupAddon align="inline-end">
            <span
              aria-live="polite"
              className="whitespace-nowrap text-xs tabular-nums"
            >
              {visibleJobs.length} jobs
            </span>
          </InputGroupAddon>
        </InputGroup>
        <div className="flex w-full min-w-0 flex-wrap items-center gap-2 md:w-auto md:max-w-full md:flex-none">
          {hasRemoteJobs || locations.length > 0 ? (
            <Select
              items={locationItems}
              onValueChange={(value) => setLocation(value ?? "all")}
              value={location}
            >
              <SelectTrigger
                aria-label="Filter locations"
                className="w-full sm:w-52"
                title={
                  location === "all"
                    ? "All locations"
                    : location === "remote"
                      ? "Remote"
                      : location
                }
              >
                <LocationIcon location={location} />
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
                      <LocationIcon location="all" />
                      All locations
                    </span>
                  </SelectItem>
                  {hasRemoteJobs ? (
                    <SelectItem className="pr-12" value="remote">
                      <span className="flex items-center gap-2">
                        <LocationIcon location="remote" />
                        Remote
                      </span>
                    </SelectItem>
                  ) : null}
                </SelectGroup>
                {locations.length ? (
                  <>
                    <SelectSeparator className="my-1" />
                    {locationGroups.map((group, index) => (
                      <SelectGroup
                        className={index === 0 ? "pt-0" : undefined}
                        key={group.code}
                      >
                        <SelectLabel>{group.label}</SelectLabel>
                        {group.places.map((place) => (
                          <SelectItem
                            className="pr-12"
                            key={place}
                            value={place}
                          >
                            <span className="flex items-center gap-2">
                              <LocationIcon location={place} />
                              {place}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    ))}
                  </>
                ) : null}
              </SelectContent>
            </Select>
          ) : null}
        </div>
      </div>

      {departments.length ? (
        <div className="mt-3 flex flex-wrap gap-1">
          {departments.length > 1 && departments.length <= 4 ? (
            <div
              aria-label="Filter by team"
              className="flex min-w-0 max-w-full flex-wrap gap-1"
              role="group"
            >
              {departments.map((department) => {
                const selected = selectedDepartments.includes(department);
                const Icon = getJobDepartmentIcon(department);
                return (
                  <Button
                    aria-pressed={selected}
                    className={
                      selected
                        ? "max-w-full"
                        : "max-w-full dark:bg-input/30 dark:hover:bg-input/50"
                    }
                    key={department}
                    onClick={() => toggleDepartment(department)}
                    title={department}
                    type="button"
                    variant={selected ? "default" : "outline"}
                  >
                    <Icon
                      aria-hidden="true"
                      className={
                        selected
                          ? "text-[color-mix(in_oklch,var(--primary-foreground)_70%,var(--primary)_30%)]"
                          : "text-muted-foreground"
                      }
                      data-icon="inline-start"
                    />
                    <span className="min-w-0 truncate">{department}</span>
                  </Button>
                );
              })}
            </div>
          ) : null}

          {departments.length === 1 ? (
            <Button
              aria-pressed={true}
              className="max-w-full cursor-default"
              title={departments[0]}
              type="button"
              variant="default"
            >
              {SingleDepartmentIcon ? (
                <SingleDepartmentIcon
                  aria-hidden="true"
                  className="text-[color-mix(in_oklch,var(--primary-foreground)_70%,var(--primary)_30%)]"
                  data-icon="inline-start"
                />
              ) : null}
              <span className="min-w-0 truncate">{departments[0]}</span>
            </Button>
          ) : null}

          {departments.length > 4 ? (
            <Select
              items={departmentItems}
              multiple
              onValueChange={setSelectedDepartments}
              value={selectedDepartments}
            >
              <SelectTrigger
                aria-label="Filter teams"
                className="w-full sm:w-44"
                title={
                  selectedDepartments.length
                    ? selectedDepartments.join(", ")
                    : "All teams"
                }
              >
                {SelectedDepartmentIcon ? (
                  <SelectedDepartmentIcon
                    aria-hidden="true"
                    className="text-muted-foreground"
                  />
                ) : null}
                <SelectValue className="min-w-0 truncate">
                  {(value: string[]) =>
                    value.length === 0
                      ? "All teams"
                      : value.length === 1
                        ? value[0]
                        : `${value.length} teams`
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent
                align="start"
                alignItemWithTrigger={false}
                className="w-[min(24rem,calc(100vw-2rem))]"
              >
                <SelectGroup>
                  {departmentItems.map((item) => {
                    const Icon = getJobDepartmentIcon(item.value);
                    return (
                      <SelectItem
                        className="pr-12"
                        key={item.value}
                        value={item.value}
                      >
                        <Icon
                          aria-hidden="true"
                          className="text-muted-foreground"
                        />
                        {item.label}
                      </SelectItem>
                    );
                  })}
                </SelectGroup>
              </SelectContent>
            </Select>
          ) : null}
        </div>
      ) : null}

      {visibleJobs.length ? (
        <div className="mt-3 flex flex-col gap-3">
          {visibleJobs.map((job, index) => (
            <JobCard
              company={company}
              countryCode={countryCode}
              job={job}
              key={`${job.title}-${job.location}-${job.focus}-${job.url ?? ""}-${index}`}
            />
          ))}
        </div>
      ) : (
        <div className="mt-3 rounded-lg border border-dashed border-border px-4 py-8 text-center">
          <p className="text-sm font-medium">No matching jobs</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Try another keyword or change a filter above.
          </p>
        </div>
      )}
    </section>
  );
}
