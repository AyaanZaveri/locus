"use client";

import * as React from "react";
import { Drawer as DrawerPrimitive } from "@base-ui/react/drawer";
import { cn } from "cn";

function Drawer({ ...props }: DrawerPrimitive.Root.Props) {
  return <DrawerPrimitive.Root data-slot="drawer" {...props} />;
}

function DrawerPortal({ ...props }: DrawerPrimitive.Portal.Props) {
  return <DrawerPrimitive.Portal data-slot="drawer-portal" {...props} />;
}

function DrawerOverlay({
  className,
  ...props
}: DrawerPrimitive.Backdrop.Props) {
  return (
    <DrawerPrimitive.Backdrop
      data-slot="drawer-overlay"
      className={cn(
        "fixed inset-0 z-50 bg-black/10 transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0 supports-backdrop-filter:backdrop-blur-xs",
        className,
      )}
      {...props}
    />
  );
}

function DrawerContent({
  className,
  children,
  side = "left",
  portalAttributes,
  ...props
}: DrawerPrimitive.Popup.Props & {
  side?: "bottom" | "left";
  portalAttributes?: Record<`data-${string}`, string>;
}) {
  const isBottomSheet = side === "bottom";

  return (
    <DrawerPortal>
      <DrawerOverlay {...portalAttributes} />
      <DrawerPrimitive.Viewport
        {...portalAttributes}
        className={cn(
          "fixed inset-0 z-50 flex p-2",
          isBottomSheet
            ? "items-end justify-center sm:items-stretch sm:justify-start"
            : "items-stretch justify-start",
        )}
      >
        <DrawerPrimitive.Popup
          data-side={side}
          data-slot="drawer-content"
          className={cn(
            "flex flex-col overflow-y-auto overscroll-contain rounded-xl ring-1 ring-border bg-background text-foreground shadow-none! opacity-[0.9999] outline-none touch-auto transition-[transform,opacity] duration-[450ms] ease-[cubic-bezier(0.32,0.72,0,1)] data-swiping:select-none",
            isBottomSheet
              ? "h-[min(88svh,48rem)] w-full [transform:translateY(var(--drawer-swipe-movement-y))] data-ending-style:[transform:translateY(calc(100%_+_0.75rem))] data-ending-style:opacity-[0.9998] data-ending-style:duration-[calc(var(--drawer-swipe-strength)*400ms)] data-starting-style:[transform:translateY(calc(100%_+_0.75rem))] data-starting-style:opacity-[0.9998] sm:h-[calc(100svh-1rem)] sm:w-[min(var(--drawer-width),calc(100vw-2rem))] sm:[transform:translateX(var(--drawer-swipe-movement-x))] sm:data-ending-style:[transform:translateX(calc(-100%_-_0.75rem))] sm:data-starting-style:[transform:translateX(calc(-100%_-_0.75rem))]"
              : "h-[calc(100svh-1rem)] w-[min(var(--drawer-width),calc(100vw-2rem))] [transform:translateX(var(--drawer-swipe-movement-x))] data-ending-style:[transform:translateX(calc(-100%_-_0.75rem))] data-ending-style:opacity-[0.9998] data-ending-style:duration-[calc(var(--drawer-swipe-strength)*400ms)] data-starting-style:[transform:translateX(calc(-100%_-_0.75rem))] data-starting-style:opacity-[0.9998]",
            className,
          )}
          {...props}
        >
          <DrawerPrimitive.Content className="flex min-h-full w-full flex-col">
            {children}
          </DrawerPrimitive.Content>
        </DrawerPrimitive.Popup>
      </DrawerPrimitive.Viewport>
    </DrawerPortal>
  );
}

function DrawerTitle({ ...props }: DrawerPrimitive.Title.Props) {
  return <DrawerPrimitive.Title data-slot="drawer-title" {...props} />;
}

function DrawerDescription({ ...props }: DrawerPrimitive.Description.Props) {
  return (
    <DrawerPrimitive.Description data-slot="drawer-description" {...props} />
  );
}

export { Drawer, DrawerContent, DrawerDescription, DrawerTitle };
