"use client";

import { useId, useState, type ReactNode } from "react";
import { Drawer as DrawerPrimitive } from "@base-ui/react/drawer";
import { CheckIcon, ChevronDownIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
} from "@/components/ui/drawer";

type Option = { value: string; label: string; icon: ReactNode };
type Group = { label?: string; options: Option[] };

export function CompanyJobFilterDrawer({
  title,
  groups,
  values,
  multiple = false,
  onChange,
  children,
}: {
  title: string;
  groups: Group[];
  values: string[];
  multiple?: boolean;
  onChange: (values: string[]) => void;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const name = useId();
  function select(value: string) {
    onChange(
      multiple
        ? values.includes(value)
          ? values.filter((current) => current !== value)
          : [...values, value]
        : [value],
    );
    if (!multiple) setOpen(false);
  }

  return (
    <Drawer open={open} onOpenChange={setOpen} swipeDirection="down">
      <DrawerPrimitive.Trigger
        aria-label={`Filter ${title.toLowerCase()}`}
        render={
          <Button
            variant="outline"
            className="w-full min-w-0 justify-between gap-1.5 text-left"
          />
        }
      >
        {children}
        <ChevronDownIcon aria-hidden="true" className="text-muted-foreground" />
      </DrawerPrimitive.Trigger>
      <DrawerContent
        side="bottom"
        contentClassName="min-h-0 flex-1"
        className="h-auto max-h-[88dvh] overflow-hidden bg-background/95 text-foreground ring-0 shadow-[0_18px_56px_oklch(0_0_0_/_0.14)] backdrop-blur-2xl dark:bg-background/85"
      >
        <div
          aria-hidden="true"
          className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-muted-foreground/25"
        />
        <header className="flex shrink-0 items-start gap-4 px-5 pt-4 pb-2">
          <DrawerTitle className="min-w-0 flex-1 text-xl leading-7 font-semibold tracking-tight">
            {title}
          </DrawerTitle>
          <DrawerDescription className="sr-only">
            {multiple
              ? `Select one or more ${title.toLowerCase()} to filter jobs.`
              : "Select a location to filter jobs."}
          </DrawerDescription>
          <Button
            aria-label={`Close ${title.toLowerCase()} filter`}
            size="icon"
            variant="ghost"
            onClick={() => setOpen(false)}
          >
            <XIcon aria-hidden="true" />
          </Button>
        </header>
        <fieldset className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-4">
          <legend className="sr-only">{title}</legend>
          {groups.map((group, index) => (
            <div key={group.label ?? index} className="flex flex-col gap-1">
              {group.label ? (
                <h3 className="px-3 pt-3 pb-1 text-xs font-medium text-muted-foreground">
                  {group.label}
                </h3>
              ) : null}
              {group.options.map((option) => {
                const selected = values.includes(option.value);
                return (
                  <label
                    key={option.value}
                    className="relative flex min-h-9 cursor-pointer items-center gap-3 rounded-lg px-3 py-1 text-sm font-medium select-none hover:bg-muted has-checked:bg-muted has-focus-visible:ring-2 has-focus-visible:ring-ring"
                  >
                    <input
                      className="sr-only"
                      type={multiple ? "checkbox" : "radio"}
                      name={name}
                      value={option.value}
                      checked={selected}
                      onChange={() => select(option.value)}
                    />
                    <span
                      aria-hidden="true"
                      className={`flex size-4.5 shrink-0 items-center justify-center [&>svg]:size-4.5 [&>img]:size-4.5 [&>img]:-translate-y-px ${option.value === "all" || option.value === "remote" ? "[&>svg]:-translate-y-px" : ""}`}
                    >
                      {option.icon}
                    </span>
                    <span className="min-w-0 flex-1 break-words">
                      {option.label}
                    </span>
                    {selected ? (
                      <CheckIcon
                        aria-hidden="true"
                        className="size-4 shrink-0"
                      />
                    ) : null}
                  </label>
                );
              })}
            </div>
          ))}
        </fieldset>
      </DrawerContent>
    </Drawer>
  );
}
