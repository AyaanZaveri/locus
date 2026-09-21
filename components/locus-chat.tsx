"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowUpIcon,
  LensConcaveIcon,
  SparklesIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import {
  InputGroup,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";

/**
 * Presentational chat launcher. A future AI SDK integration can own the input
 * state and submit behavior without changing this shell.
 */
export function LocusChat() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "j") {
        event.preventDefault();
        setIsOpen((open) => !open);
      }

      if (event.key === "Escape") setIsOpen(false);
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center px-4">
      <div className="pointer-events-auto flex w-full max-w-xl flex-col items-center">
        <AnimatePresence initial={false}>
          {isOpen ? (
            <motion.section
              aria-label="Ask Locus"
              animate={{ opacity: 1, scale: 1, y: 0 }}
              className="mb-3 w-full rounded-xl! bg-background p-1 text-popover-foreground ring-1 ring-border"
              exit={{ opacity: 0, scale: 0.96, y: 10 }}
              initial={{ opacity: 0, scale: 0.96, y: 10 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
            >
              <form onSubmit={(event) => event.preventDefault()}>
                <InputGroup className="h-10! rounded-lg! border-transparent bg-transparent shadow-none! ring-0 focus-within:border-transparent focus-within:ring-0 has-disabled:bg-transparent has-disabled:opacity-100 has-[[data-slot=input-group-control]:focus-visible]:border-transparent! has-[[data-slot=input-group-control]:focus-visible]:ring-0! dark:bg-transparent dark:has-disabled:bg-transparent">
                  <LensConcaveIcon
                    aria-hidden="true"
                    className="ml-2 size-4 shrink-0 stroke-[1.5] text-muted-foreground"
                  />
                  <InputGroupInput
                    aria-label="Message Locus"
                    autoFocus
                    className="text-base sm:text-sm"
                    placeholder="Ask about a company, person, or role…"
                  />
                  <InputGroupButton
                    aria-label="Send message"
                    className="mr-1"
                    disabled
                    size="icon-sm"
                    type="submit"
                  >
                    <ArrowUpIcon />
                  </InputGroupButton>
                </InputGroup>
              </form>
            </motion.section>
          ) : null}
        </AnimatePresence>

        <motion.div animate={{ scale: isOpen ? 1.04 : 1 }} transition={{ duration: 0.18 }}>
          <Button
            aria-expanded={isOpen}
            aria-keyshortcuts="Meta+J Control+J"
            className="h-9 rounded-full border bg-background! px-3.5 shadow-lg shadow-emerald-500/5 hover:bg-muted aria-expanded:bg-background! aria-expanded:text-foreground"
            onClick={() => setIsOpen((open) => !open)}
            type="button"
            variant="outline"
          >
            <LensConcaveIcon aria-hidden="true" className="size-4 stroke-[1.5]" />
            <span>Locus Focus</span>
            <KbdGroup className="ml-1 hidden sm:inline-flex">
              <Kbd>⌘</Kbd>
              <Kbd>J</Kbd>
            </KbdGroup>
          </Button>
        </motion.div>
      </div>
    </div>
  );
}
