"use client";

import { useEffect, useRef, useState } from "react";
import { GlobeIcon, LoaderCircleIcon } from "lucide-react";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxChips,
  ComboboxChip,
  ComboboxChipsInput,
  ComboboxValue,
  ComboboxTrigger,
} from "@/components/ui/combobox";
import { InputGroupAddon } from "@/components/ui/input-group";
import { getJobLocationCountryCode } from "@/lib/job-location-country";
import type { ProfileLocation } from "@/lib/profile-locations";

function CountryFlag({ code }: { code: string }) {
  return (
    <img
      src={`https://hatscripts.github.io/circle-flags/flags/${code.toLowerCase()}.svg`}
      alt=""
      className="size-4 shrink-0"
    />
  );
}

export function getLocationBadgeLabel(location: ProfileLocation): string {
  const parts = location.label.split(",").map((part) => part.trim());
  return location.countryCode && parts.length > 1
    ? parts.slice(0, -1).join(", ")
    : location.label;
}

function LocationSearchStatus() {
  return (
    <span
      role="status"
      className="bg-clip-text text-transparent motion-reduce:animate-none!"
      style={{
        backgroundImage:
          "linear-gradient(90deg, var(--muted-foreground) 35%, var(--foreground) 50%, var(--muted-foreground) 65%)",
        backgroundSize: "200% 100%",
        animation: "shimmer-text 1.4s linear infinite",
      }}
    >
      Looking that up...
    </span>
  );
}

export function ProfileLocationInput({
  id,
  value: singleValue,
  onChange,
  disabled,
  initialCountryCode,
  selectedValues,
  onSelectedValuesChange,
  initialCountryCodes,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  initialCountryCode?: string | null;
  selectedValues?: string[];
  onSelectedValuesChange?: (values: string[]) => void;
  initialCountryCodes?: Record<string, string | null>;
}) {
  const multiple = selectedValues !== undefined;
  const [query, setQuery] = useState("");
  const value = multiple ? query : singleValue;
  const [knownCountries, setKnownCountries] = useState<Record<string, string>>(
    {},
  );
  const chosenLocations: ProfileLocation[] = (selectedValues ?? []).map(
    (label) => ({
      label,
      countryCode:
        knownCountries[label] ??
        initialCountryCodes?.[label] ??
        getJobLocationCountryCode(label) ??
        "",
    }),
  );
  const [results, setResults] = useState<{
    query: string | null;
    locations: ProfileLocation[];
    nextOffset: number | null;
  }>({ query: null, locations: [], nextOffset: null });
  const anchor = useRef<HTMLDivElement>(null);
  const initialValue = useRef(value);
  const requestController = useRef<AbortController | null>(null);
  const fetchingMore = useRef(false);
  const [selected, setSelected] = useState<ProfileLocation | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [open, setOpen] = useState(false);
  const locations = results.query === value ? results.locations : [];
  const searching = loading || (results.query !== value && !failed);
  const busy = open && (searching || loadingMore);
  const countryCode =
    (selected?.label === value ? selected.countryCode : null) ??
    locations.find((location) => location.label === value)?.countryCode ??
    (value === initialValue.current ? initialCountryCode : null) ??
    getJobLocationCountryCode(value);

  useEffect(() => {
    const controller = new AbortController();
    requestController.current = controller;
    fetchingMore.current = false;
    const timer = setTimeout(async () => {
      setLoading(true);
      setLoadingMore(false);
      setFailed(false);
      try {
        const response = await fetch(
          `/api/locations?q=${encodeURIComponent(value)}`,
          { signal: controller.signal },
        );
        if (!response.ok) throw new Error("Location lookup failed");
        const data = await response.json();
        if (!controller.signal.aborted)
          setResults({
            query: value,
            locations: data.locations,
            nextOffset: data.nextOffset,
          });
      } catch {
        if (!controller.signal.aborted) setFailed(true);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 180);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [value]);

  async function loadMore() {
    const controller = requestController.current;
    if (
      !controller ||
      controller.signal.aborted ||
      fetchingMore.current ||
      loading ||
      results.query !== value ||
      results.nextOffset === null
    )
      return;
    fetchingMore.current = true;
    setLoadingMore(true);
    setFailed(false);
    try {
      const response = await fetch(
        `/api/locations?q=${encodeURIComponent(value)}&offset=${results.nextOffset}`,
        { signal: controller.signal },
      );
      if (!response.ok) throw new Error("Location lookup failed");
      const data = await response.json();
      if (!controller.signal.aborted)
        setResults((previous) => ({
          ...previous,
          locations: [...previous.locations, ...data.locations],
          nextOffset: data.nextOffset,
        }));
    } catch {
      if (!controller.signal.aborted) setFailed(true);
    } finally {
      if (!controller.signal.aborted) {
        fetchingMore.current = false;
        setLoadingMore(false);
      }
    }
  }

  return (
    <div ref={anchor} className="w-full min-w-0">
      <Combobox
        multiple={multiple}
        items={locations}
        filter={null}
        inputValue={value}
        value={
          multiple
            ? chosenLocations
            : selected?.label === value
              ? selected
              : null
        }
        disabled={disabled}
        onOpenChange={setOpen}
        itemToStringLabel={(location: ProfileLocation) => location.label}
        itemToStringValue={(location: ProfileLocation) => location.label}
        isItemEqualToValue={(item, value) => item.label === value.label}
        onInputValueChange={(input, details) => {
          if (details.reason === "input-change") {
            if (multiple) setQuery(input);
            else onChange(input);
          }
        }}
        onValueChange={(location) => {
          if (Array.isArray(location)) {
            if (location.length > 50) return;
            setKnownCountries((previous) => ({
              ...previous,
              ...Object.fromEntries(
                location
                  .filter((item) => item.countryCode)
                  .map((item) => [item.label, item.countryCode]),
              ),
            }));
            onSelectedValuesChange?.(location.map((item) => item.label));
            setQuery("");
            return;
          }
          setSelected(location);
          if (location) onChange(location.label);
        }}
      >
        {multiple ? (
          <ComboboxChips className="min-h-9 w-full bg-control py-0.5">
            <ComboboxValue>
              {chosenLocations.map((location) => (
                <ComboboxChip
                  key={location.label}
                  className="h-7 max-w-full cursor-default select-none gap-1.5 rounded-md [&_[data-slot=combobox-chip-remove]_svg]:size-4! [&_[data-slot=combobox-chip-remove]:active]:scale-90"
                  aria-label={location.label}
                >
                  {location.countryCode ? (
                    <CountryFlag code={location.countryCode} />
                  ) : (
                    <GlobeIcon aria-hidden="true" className="size-4 shrink-0" />
                  )}
                  <span className="min-w-0 truncate">
                    {getLocationBadgeLabel(location)}
                  </span>
                </ComboboxChip>
              ))}
            </ComboboxValue>
            <ComboboxChipsInput
              id={id}
              className={
                chosenLocations.length ? "min-w-28 py-1 pl-1" : "min-w-28 py-1"
              }
              placeholder={
                chosenLocations.length ? "Add location…" : "Search cities…"
              }
              maxLength={120}
              disabled={disabled}
              autoComplete="off"
            />
            {busy ? (
              <LoaderCircleIcon
                aria-hidden="true"
                className="size-4 shrink-0 animate-spin text-muted-foreground motion-reduce:animate-none"
              />
            ) : null}
            <ComboboxTrigger
              aria-label="Show location suggestions"
              disabled={disabled}
              className="flex size-7 shrink-0 items-center justify-center"
            />
          </ComboboxChips>
        ) : (
          <ComboboxInput
            id={id}
            className="h-9 w-full"
            placeholder="Toronto, Canada"
            maxLength={120}
            disabled={disabled}
            autoComplete="off"
          >
            <InputGroupAddon>
              {busy ? (
                <LoaderCircleIcon
                  aria-hidden="true"
                  className="animate-spin motion-reduce:animate-none"
                />
              ) : countryCode ? (
                <CountryFlag code={countryCode} />
              ) : (
                <GlobeIcon aria-hidden="true" />
              )}
            </InputGroupAddon>
          </ComboboxInput>
        )}
        <ComboboxContent
          anchor={anchor}
          className="w-(--anchor-width) min-w-(--anchor-width)"
        >
          <ComboboxEmpty className="py-4">
            {searching ? (
              <LocationSearchStatus />
            ) : failed ? (
              "Suggestions unavailable. You can still type a location."
            ) : (
              "No matches. You can still type a location."
            )}
          </ComboboxEmpty>
          <ComboboxList
            onScroll={(event) => {
              const list = event.currentTarget;
              if (list.scrollHeight - list.scrollTop - list.clientHeight < 80)
                void loadMore();
            }}
          >
            {(location: ProfileLocation) => (
              <ComboboxItem key={location.label} value={location}>
                <CountryFlag code={location.countryCode} />
                <span className="min-w-0 truncate">{location.label}</span>
              </ComboboxItem>
            )}
          </ComboboxList>
          {loadingMore && locations.length > 0 ? (
            <div className="px-3 py-4 text-center text-sm">
              <LocationSearchStatus />
            </div>
          ) : failed && locations.length > 0 ? (
            <p
              role="status"
              className="px-3 py-2 text-center text-sm text-muted-foreground"
            >
              Couldn’t fetch more cities. Scroll to try again.
            </p>
          ) : null}
        </ComboboxContent>
      </Combobox>
    </div>
  );
}
