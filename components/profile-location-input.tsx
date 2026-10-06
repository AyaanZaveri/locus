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
  value,
  onChange,
  disabled,
  initialCountryCode,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  initialCountryCode?: string | null;
}) {
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
        items={locations}
        filter={null}
        inputValue={value}
        value={selected?.label === value ? selected : null}
        disabled={disabled}
        onOpenChange={setOpen}
        itemToStringLabel={(location: ProfileLocation) => location.label}
        itemToStringValue={(location: ProfileLocation) => location.label}
        onInputValueChange={(input, details) => {
          if (details.reason === "input-change") onChange(input);
        }}
        onValueChange={(location) => {
          setSelected(location);
          if (location) onChange(location.label);
        }}
      >
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
        <ComboboxContent
          anchor={anchor}
          className="w-(--anchor-width) min-w-(--anchor-width)"
        >
          <ComboboxEmpty>
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
            <div className="px-3 py-2 text-center text-sm">
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
