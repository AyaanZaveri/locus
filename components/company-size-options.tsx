"use client";

import { motion, useReducedMotion } from "motion/react";
import { CheckIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { COMPANY_SIZES, type UserProfile } from "@/lib/user-profile";

export function CompanySizeOptions({
  value,
  onValueChange,
  disabled,
}: {
  value: UserProfile["companySizes"];
  onValueChange: (value: UserProfile["companySizes"]) => void;
  disabled?: boolean;
}) {
  const reduceMotion = useReducedMotion();
  const transition = {
    duration: reduceMotion ? 0 : 0.22,
    ease: [0.23, 1, 0.32, 1] as const,
  };

  return (
    <div
      role="group"
      aria-label="Preferred company size"
      className="flex min-w-0 max-w-full flex-wrap gap-1.5"
    >
      {COMPANY_SIZES.map((size) => {
        const selected = value.includes(size);
        return (
          <Button
            key={size}
            type="button"
            aria-label={`${size} employees`}
            aria-pressed={selected}
            disabled={disabled}
            variant={selected ? "default" : "outline"}
            className={
              selected
                ? "max-w-full"
                : "max-w-full dark:bg-input/30 dark:hover:bg-input/50"
            }
            onClick={() =>
              onValueChange(
                selected
                  ? value.filter((item) => item !== size)
                  : [...value, size],
              )
            }
          >
            {/* Only this tiny icon slot changes width, like the job-row arrow.
                Keeping it mounted prevents mount/exit gaps and FLIP scaling
                from making the button and its text snap or stretch. */}
            <motion.span
              aria-hidden="true"
              data-selected={selected}
              className="-mr-1.5 inline-flex shrink-0 items-center overflow-hidden"
              initial={false}
              animate={{ width: selected ? 22 : 0 }}
              transition={transition}
            >
              <motion.span
                className="inline-flex shrink-0"
                initial={false}
                animate={{
                  opacity: selected ? 1 : 0,
                  filter: selected || reduceMotion ? "blur(0px)" : "blur(4px)",
                  transform:
                    selected || reduceMotion
                      ? "translateX(0px)"
                      : "translateX(-4px)",
                }}
                transition={{
                  ...transition,
                  duration: reduceMotion ? 0 : 0.18,
                }}
              >
                <CheckIcon />
              </motion.span>
            </motion.span>
            <span className="min-w-0 truncate">{size}</span>
          </Button>
        );
      })}
    </div>
  );
}
