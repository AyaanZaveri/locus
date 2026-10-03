"use client";

import { Menu } from "@base-ui/react/menu";
import { Drawer as DrawerPrimitive } from "@base-ui/react/drawer";
import { useState, useSyncExternalStore } from "react";
import {
  CheckIcon,
  ChevronRightIcon,
  LensConcaveIcon,
  BadgeInfoIcon,
  InfoIcon,
  XIcon,
} from "lucide-react";
import { InputGroupButton } from "@/components/ui/input-group";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer";
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

// Match the existing drawers' sm breakpoint: below it, sheets slide up.
const mobileQuery = "(max-width: 639px)";
function subscribeMobile(listener: () => void) {
  const query = window.matchMedia(mobileQuery);
  query.addEventListener("change", listener);
  return () => query.removeEventListener("change", listener);
}
const mobileSnapshot = () => window.matchMedia(mobileQuery).matches;
const serverSnapshot = () => false;

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
  const isMobile = useSyncExternalStore(
    subscribeMobile,
    mobileSnapshot,
    serverSnapshot,
  );
  const [drawerOpen, setDrawerOpen] = useState(false);
  if (isMobile) {
    return (
      <Drawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        swipeDirection="down"
      >
        <DrawerPrimitive.Trigger
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
          <LensConcaveIcon
            aria-hidden="true"
            className="size-5 -translate-x-0.5 stroke-[1.5]"
          />
        </DrawerPrimitive.Trigger>
        <DrawerContent
          side="bottom"
          portalAttributes={{ "data-locus-focus-click-zone": "" }}
          data-locus-focus-click-zone=""
          className="h-auto max-h-[88dvh] bg-background/95 text-foreground ring-0 shadow-[0_18px_56px_oklch(0_0_0_/_0.14)] backdrop-blur-2xl dark:bg-background/85"
        >
          <div
            aria-hidden="true"
            className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-muted-foreground/25"
          />
          <header className="flex shrink-0 items-start gap-4 px-5 pt-6 pb-4">
            <div className="min-w-0 flex-1">
              <DrawerTitle className="text-xl leading-7 font-semibold tracking-tight">
                Choose model
              </DrawerTitle>
              <DrawerDescription className="sr-only">
                Select the model for Locus Focus.
              </DrawerDescription>
            </div>
            <Button
              aria-label="Close model picker"
              size="icon"
              variant="ghost"
              onClick={() => setDrawerOpen(false)}
            >
              <XIcon aria-hidden="true" />
            </Button>
          </header>
          <fieldset className="flex min-h-0 flex-col gap-1 overflow-y-auto overscroll-contain px-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <legend className="sr-only">Model</legend>
            {LOCUS_MODELS.map((model) => (
              <label
                key={model.id}
                className="relative flex min-h-14 cursor-pointer items-center gap-3 rounded-lg px-3 py-2 select-none hover:bg-muted has-checked:bg-muted has-focus-visible:ring-2 has-focus-visible:ring-ring"
              >
                <input
                  type="radio"
                  name="locus-focus-model"
                  value={model.id}
                  checked={modelId === model.id}
                  disabled={disabled}
                  className="sr-only"
                  onChange={() => {
                    onChange(model.id);
                    setDrawerOpen(false);
                  }}
                />
                <Logo src={model.logo} />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">
                    {model.label}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {model.lab}
                  </span>
                  {model.id === "muse-spark-1.3-contributor" ? (
                    <span className="mt-1 flex items-start gap-1.5 text-xs text-muted-foreground">
                      <InfoIcon
                        aria-hidden="true"
                        className="mt-0.5 size-3 shrink-0"
                      />
                      <span>Meta trains on your prompts and responses.</span>
                    </span>
                  ) : null}
                </span>
                {modelId === model.id ? (
                  <CheckIcon aria-hidden="true" className="size-4 shrink-0" />
                ) : null}
              </label>
            ))}
          </fieldset>
        </DrawerContent>
      </Drawer>
    );
  }
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
        <LensConcaveIcon
          aria-hidden="true"
          className="size-5 -translate-x-0.5 stroke-[1.5]"
        />
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
                          <p className="flex max-w-56 items-start gap-1.5 px-2 py-1 text-xs text-muted-foreground">
                            <InfoIcon
                              aria-hidden="true"
                              className="mt-0.5 size-3 shrink-0"
                            />
                            <span>
                              Meta trains on your prompts and responses.
                            </span>
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
