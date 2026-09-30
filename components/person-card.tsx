"use client";

import { useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import type { CompanyProfile } from "@/lib/company-profile";

type Person = CompanyProfile["people"][number];

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("");
}

export function PersonCard({ person }: { person: Person }) {
  const cardRef = useRef<HTMLDivElement>(null);
  const searchParams = useSearchParams();
  const requestedUrl = searchParams.get("personUrl");
  const isRequestedPerson = requestedUrl
    ? requestedUrl === (person.linkedin ?? person.sourceUrl)
    : searchParams.get("person") === person.name;

  useEffect(() => {
    if (!isRequestedPerson) return;

    const frame = window.requestAnimationFrame(() => {
      cardRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [isRequestedPerson]);

  return (
    <div
      className={`flex items-center gap-3 rounded-lg border border-border bg-background p-3 ${
        isRequestedPerson
          ? "motion-safe:animate-[person-arrival_0.8s_ease-in-out_2]"
          : ""
      }`}
      ref={cardRef}
    >
      <Avatar className="size-10">
        {person.image ? (
          <AvatarImage
            alt={person.name}
            className="ring-1 ring-border/50 shadow-xs"
            src={person.image}
          />
        ) : null}
        <AvatarFallback>{initials(person.name)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{person.name}</p>
        <p className="truncate text-xs font-medium text-muted-foreground">
          {person.role}
        </p>
      </div>
      <div className="ml-auto flex shrink-0 items-center gap-1">
        {person.linkedin ? (
          <Button
            aria-label={`${person.name} on LinkedIn`}
            nativeButton={false}
            render={<a href={person.linkedin} rel="noreferrer" target="_blank" />}
            size="icon-sm"
            variant="ghost"
          >
            <span
              aria-hidden="true"
              className="block size-3.5 shrink-0 bg-muted-foreground"
              style={{
                mask: "url('/icons/linkedin.svg') center / contain no-repeat",
                WebkitMask:
                  "url('/icons/linkedin.svg') center / contain no-repeat",
              }}
            />
          </Button>
        ) : null}
        {person.x ? (
          <Button
            aria-label={`${person.name} on X`}
            nativeButton={false}
            render={<a href={person.x} rel="noreferrer" target="_blank" />}
            size="icon-sm"
            variant="ghost"
          >
            <span
              aria-hidden="true"
              className="block size-3.5 shrink-0 bg-muted-foreground"
              style={{
                mask: "url('/icons/x.svg') center / contain no-repeat",
                WebkitMask: "url('/icons/x.svg') center / contain no-repeat",
              }}
            />
          </Button>
        ) : null}
      </div>
    </div>
  );
}
