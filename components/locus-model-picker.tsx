"use client";

import { Menu } from "@base-ui/react/menu";
import {
  CheckIcon,
  ChevronRightIcon,
  LensConcaveIcon,
  BadgeInfoIcon,
} from "lucide-react";
import { InputGroupButton } from "@/components/ui/input-group";
import {
  LOCUS_MODELS,
  isLocusModelId,
  type LocusModelId,
} from "@/lib/locus-models";

// Match Steel Chat's provider-grouped, frosted model menu.
const surface =
  "min-w-48 origin-(--transform-origin) rounded-md bg-popover/85 p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10 backdrop-blur-xl backdrop-saturate-150 outline-none transition-[opacity,scale] duration-100 data-starting-style:scale-95 data-starting-style:opacity-0 data-ending-style:scale-95 data-ending-style:opacity-0 motion-reduce:transition-none";
const row =
  "relative flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none select-none data-highlighted:bg-accent data-highlighted:text-accent-foreground";

function Logo({ src }: { src: string }) {
  return (
    <span
      aria-hidden="true"
      className="size-4 shrink-0 rounded-sm bg-current"
      style={{
        maskImage: `url(${src})`,
        WebkitMaskImage: `url(${src})`,
        maskPosition: "center",
        maskRepeat: "no-repeat",
        maskSize: "contain",
        transform: src === "/logos/xiaomi.svg" ? "scale(1.24)" : undefined,
      }}
    />
  );
}

export function LocusModelPicker({
  modelId,
  onChange,
  disabled,
}: {
  modelId: LocusModelId;
  onChange: (id: LocusModelId) => void;
  disabled: boolean;
}) {
  const selected = LOCUS_MODELS.find((model) => model.id === modelId)!;
  return (
    <Menu.Root>
      <Menu.Trigger
        disabled={disabled}
        render={
          <InputGroupButton
            size="icon-sm"
            className="ml-1 size-9 text-muted-foreground active:scale-[0.98]"
          />
        }
        aria-label={`Choose model. Current model: ${selected.label}`}
        title={`Model: ${selected.label}`}
      >
        <LensConcaveIcon aria-hidden="true" className="size-5 stroke-[1.5]" />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner
          data-locus-focus-click-zone=""
          side="top"
          align="start"
          sideOffset={10}
          className="isolate z-50 outline-none"
        >
          <Menu.Popup className={surface} aria-label="Models by provider">
            <Menu.Group>
              {LOCUS_MODELS.map((model) => (
                <Menu.SubmenuRoot key={model.lab}>
                  <Menu.SubmenuTrigger className={row}>
                    <Logo src={model.logo} />
                    {model.lab}
                    <ChevronRightIcon
                      aria-hidden="true"
                      className="ml-auto size-4"
                    />
                  </Menu.SubmenuTrigger>
                  <Menu.Portal>
                    <Menu.Positioner
                      data-locus-focus-click-zone=""
                      side="right"
                      align="start"
                      alignOffset={-3}
                      sideOffset={0}
                      className="isolate z-50 outline-none"
                    >
                      <Menu.Popup className={`${surface} min-w-56 shadow-lg`}>
                        <Menu.RadioGroup
                          value={modelId}
                          onValueChange={(value) => {
                            if (isLocusModelId(value)) onChange(value);
                          }}
                        >
                          <Menu.RadioItem
                            value={model.id}
                            className={`${row} pr-8`}
                          >
                            <Logo src={model.logo} />
                            {model.label}
                            {model.id === "muse-spark-1.3-contributor" ? (
                              <BadgeInfoIcon
                                className="size-3.5"
                                aria-label="Contributor model: Meta trains on your prompts and responses"
                              />
                            ) : null}
                            <Menu.RadioItemIndicator className="absolute right-2">
                              <CheckIcon
                                aria-hidden="true"
                                className="size-4"
                              />
                            </Menu.RadioItemIndicator>
                          </Menu.RadioItem>
                        </Menu.RadioGroup>
                        {model.id === "muse-spark-1.3-contributor" ? (
                          <p className="max-w-56 px-2 py-1 text-xs text-muted-foreground">
                            Meta trains on your prompts and responses.
                          </p>
                        ) : null}
                      </Menu.Popup>
                    </Menu.Positioner>
                  </Menu.Portal>
                </Menu.SubmenuRoot>
              ))}
            </Menu.Group>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
