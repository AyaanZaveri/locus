"use client";

import { useRef, useState } from "react";
import { getJobDepartmentIcon } from "@/components/job-department-icon";
import {
  Combobox,
  ComboboxInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxList,
  ComboboxItem,
  ComboboxChips,
  ComboboxChip,
  ComboboxChipsInput,
  ComboboxValue,
  ComboboxTrigger,
} from "@/components/ui/combobox";
import { InputGroupAddon } from "@/components/ui/input-group";
import {
  getProfileRoleDepartment,
  searchProfileRoles,
  PROFILE_ROLES,
} from "@/lib/profile-roles";

function RoleIcon({ role }: { role: string }) {
  const Icon = getJobDepartmentIcon(getProfileRoleDepartment(role));
  return (
    <Icon
      aria-hidden="true"
      className="size-4 shrink-0 text-muted-foreground"
    />
  );
}

export function ProfileRoleInput({
  id,
  value,
  onChange,
  selectedValues,
  onSelectedValuesChange,
  disabled,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  selectedValues?: string[];
  onSelectedValuesChange?: (values: string[]) => void;
  disabled?: boolean;
}) {
  const multiple = selectedValues !== undefined;
  const [query, setQuery] = useState("");
  const input = multiple ? query : value;
  const anchor = useRef<HTMLDivElement>(null);
  const items = searchProfileRoles(input, selectedValues);

  return (
    <div ref={anchor} className="w-full min-w-0">
      <Combobox
        multiple={multiple}
        items={items}
        filter={null}
        disabled={disabled}
        inputValue={input}
        value={multiple ? selectedValues : value || null}
        onInputValueChange={(next, details) => {
          if (details.reason !== "input-change") return;
          if (multiple) setQuery(next);
          else onChange(next);
        }}
        onValueChange={(next) => {
          if (Array.isArray(next)) {
            if (next.length > 50) return;
            const seen = new Set<string>();
            onSelectedValuesChange?.(
              next.filter((role) => {
                const key = role.toLowerCase();
                if (seen.has(key)) return false;
                seen.add(key);
                return true;
              }),
            );
            setQuery("");
          } else if (next) onChange(next);
        }}
      >
        {multiple ? (
          <ComboboxChips className="min-h-9 w-full bg-control py-0.5">
            <ComboboxValue>
              {selectedValues.map((role) => (
                <ComboboxChip
                  key={role}
                  aria-label={role}
                  className="h-7 max-w-full cursor-default select-none gap-1.5 rounded-md [&_[data-slot=combobox-chip-remove]_svg]:size-4! [&_[data-slot=combobox-chip-remove]:active]:scale-90"
                >
                  <RoleIcon role={role} />
                  <span className="min-w-0 truncate">{role}</span>
                </ComboboxChip>
              ))}
            </ComboboxValue>
            <ComboboxChipsInput
              id={id}
              maxLength={120}
              disabled={disabled}
              autoComplete="off"
              className={
                selectedValues.length ? "min-w-28 py-1 pl-1" : "min-w-28 py-1"
              }
              placeholder={
                selectedValues.length ? "Add role…" : "Search roles…"
              }
            />
            <ComboboxTrigger
              aria-label="Show role suggestions"
              disabled={disabled}
              className="flex size-7 shrink-0 items-center justify-center"
            />
          </ComboboxChips>
        ) : (
          <ComboboxInput
            id={id}
            className="h-9 w-full"
            maxLength={120}
            disabled={disabled}
            autoComplete="off"
            placeholder="Software engineer"
          >
            <InputGroupAddon>
              <RoleIcon role={value} />
            </InputGroupAddon>
          </ComboboxInput>
        )}
        <ComboboxContent
          anchor={anchor}
          className="w-(--anchor-width) min-w-(--anchor-width)"
        >
          <ComboboxEmpty className="py-4">No matching roles.</ComboboxEmpty>
          <ComboboxList>
            {(role: string) => {
              const isCustom =
                input.trim() === role &&
                !PROFILE_ROLES.some(
                  (item) => item.label.toLowerCase() === role.toLowerCase(),
                ) &&
                !selectedValues?.includes(role);
              return (
                <ComboboxItem
                  key={role}
                  value={role}
                  className={
                    isCustom ? "pr-2 [&>span:last-child]:hidden" : undefined
                  }
                >
                  <RoleIcon role={role} />
                  <span className="min-w-0 truncate">{role}</span>
                  {isCustom ? (
                    <span className="ml-auto text-xs text-muted-foreground">
                      Custom
                    </span>
                  ) : null}
                </ComboboxItem>
              );
            }}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
    </div>
  );
}
