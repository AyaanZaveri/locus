"use client";

import { Globe, Laptop } from "lucide-react";
import { cn } from "cn";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { splitJobLocations } from "@/lib/job-location";
import { getJobLocationCountryCode } from "@/lib/job-location-country";

const countryNames = new Intl.DisplayNames(["en"], { type: "region" });

export function JobLocationFlags({
  location,
  size = "card",
}: {
  location: string;
  size?: "card" | "details";
}) {
  const country = getJobLocationCountryCode(location);
  const isRemote = /\bremote\b/i.test(location);
  const FallbackIcon = isRemote ? Laptop : Globe;
  const countryName = country ? countryNames.of(country.toUpperCase()) : null;
  const label = isRemote
    ? countryName
      ? `Remote · ${countryName}`
      : "Remote"
    : countryName || "Worldwide or unspecified country";

  return (
    <span
      aria-label={label}
      role="img"
      className="inline-flex shrink-0 items-center"
    >
      {country && !isRemote ? (
        <Avatar className={size === "details" ? "size-3" : "size-2.5"}>
          <AvatarImage
            alt=""
            src={`https://hatscripts.github.io/circle-flags/flags/${country}.svg`}
          />
          <AvatarFallback>
            <Globe aria-hidden="true" className="size-full" />
          </AvatarFallback>
        </Avatar>
      ) : (
        <FallbackIcon
          aria-hidden="true"
          className={cn(
            isRemote
              ? size === "details"
                ? "size-[15px]"
                : "size-[13px]"
              : size === "details"
                ? "size-3.5"
                : "size-3",
            isRemote && "-translate-y-[0.5px]",
          )}
        />
      )}
    </span>
  );
}

export function JobLocations({
  location,
  size = "card",
}: {
  location: string;
  size?: "card" | "details";
}) {
  const places = splitJobLocations(location);
  const visiblePlaces = size === "card" ? places.slice(0, 2) : places;
  const remainingCount = places.length - visiblePlaces.length;

  return (
    <span className="inline-flex min-w-0 items-center gap-1.5">
      <span
        className={cn(
          "min-w-0",
          size === "card" ? "truncate" : "flex flex-wrap items-center gap-y-1",
        )}
      >
        {visiblePlaces.map((place, index) => (
          <span key={place}>
            {index > 0 ? (
              <span aria-hidden="true" className="mx-1.5">
                ·
              </span>
            ) : null}
            <span className="inline-flex items-center gap-1.5 align-middle">
              {index === 0 ||
              /\bremote\b/i.test(place) ||
              /\bremote\b/i.test(places[index - 1]) ||
              !getJobLocationCountryCode(place) ||
              getJobLocationCountryCode(place) !==
                getJobLocationCountryCode(places[index - 1]) ? (
                <JobLocationFlags location={place} size={size} />
              ) : null}
              <span>{place}</span>
            </span>
          </span>
        ))}
      </span>
      {remainingCount > 0 ? (
        <span className="inline-flex shrink-0 items-center gap-1.5">
          <span aria-hidden="true">·</span>
          <span>{remainingCount} more</span>
        </span>
      ) : null}
    </span>
  );
}
