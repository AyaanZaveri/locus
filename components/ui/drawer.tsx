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
  ...props
}: DrawerPrimitive.Popup.Props) {
  return (
    <DrawerPortal>
      <DrawerOverlay />
      <DrawerPrimitive.Viewport className="fixed inset-0 z-50 flex items-stretch justify-start pt-2 pr-2 pb-2 pl-2">
        <DrawerPrimitive.Popup
          data-slot="drawer-content"
          className={cn(
            "flex h-[calc(100svh-1rem)] w-[min(var(--drawer-width),calc(100vw-2rem))] flex-col overflow-y-auto overscroll-contain rounded-xl ring-1 ring-border bg-background text-foreground shadow-none! opacity-[0.9999] outline-none touch-auto [transform:translateX(var(--drawer-swipe-movement-x))] transition-[transform,opacity] duration-[450ms] ease-[cubic-bezier(0.32,0.72,0,1)] data-swiping:select-none data-ending-style:[transform:translateX(calc(-100%_-_0.75rem))] data-ending-style:opacity-[0.9998] data-ending-style:duration-[calc(var(--drawer-swipe-strength)*400ms)] data-starting-style:[transform:translateX(calc(-100%_-_0.75rem))] data-starting-style:opacity-[0.9998]",
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
