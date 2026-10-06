"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";
import {
  chooseSoulTextMode,
  SOUL_TEXT_COLORS,
  type RGB,
  type SoulTextMode,
} from "@/lib/soul-text-contrast";

const cssColor = (color: RGB) => `rgb(${color.join(" ")})`;

export function SoulWordmark() {
  const ref = useRef<HTMLSpanElement>(null);
  const reduceMotion = useReducedMotion();
  const [mode, setMode] = useState<SoulTextMode | null>(null);
  const [animateChanges, setAnimateChanges] = useState(false);

  // Paint the first sampled color directly; only later changes should fade.
  const hasSample = mode !== null;
  useEffect(() => {
    if (!hasSample) return;
    let secondFrame = 0;
    const firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(() => setAnimateChanges(true));
    });
    return () => {
      cancelAnimationFrame(firstFrame);
      cancelAnimationFrame(secondFrame);
    };
  }, [hasSample]);

  useEffect(() => {
    const element = ref.current;
    const banner = element?.parentElement;
    if (!element || !banner) return;
    // Downsample ONLY the wordmark's backdrop into 48 pixels. Read no page,
    // avatar or profile data; no full-canvas readback or per-frame React updates.
    const probe = document.createElement("canvas");
    probe.width = 16;
    probe.height = 3;
    const context = probe.getContext("2d", { willReadFrequently: true });
    if (!context) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let visible = true;
    let stopped = false;
    let previous: SoulTextMode = "blend";

    function sample() {
      const canvas = banner!.querySelector(
        ".soul-cover canvas",
      ) as HTMLCanvasElement | null;
      if (!canvas || !canvas.width || !canvas.height) {
        setAnimateChanges(false);
        setMode(null);
        return false;
      }
      const area = element!.getBoundingClientRect();
      const bounds = canvas.getBoundingClientRect();
      if (!area.width || !area.height || !bounds.width || !bounds.height)
        return false;
      try {
        context!.clearRect(0, 0, 16, 3);
        context!.drawImage(
          canvas,
          ((area.left - bounds.left) * canvas.width) / bounds.width,
          ((area.top - bounds.top) * canvas.height) / bounds.height,
          (area.width * canvas.width) / bounds.width,
          (area.height * canvas.height) / bounds.height,
          0,
          0,
          16,
          3,
        );
        const pixels = context!.getImageData(0, 0, 16, 3).data;
        // A newly mounted/lost WebGL buffer may be transparent. Never mistake
        // that for a black backdrop and make a contrast decision from it.
        if (pixels.some((_, index) => index % 4 === 3 && pixels[index] < 250))
          return false;
        const backgrounds: RGB[] = [];
        for (let index = 0; index < pixels.length; index += 4) {
          backgrounds.push([
            pixels[index],
            pixels[index + 1],
            pixels[index + 2],
          ]);
        }
        const next = chooseSoulTextMode(backgrounds, previous);
        previous = next;
        setMode(next);
        return true;
      } catch {
        // Sampling is enhancement-only. Keep readable solid pale mint if the
        // browser disallows readback, rather than retaining invisible blending.
        setMode("light");
        stopped = true;
        return true;
      }
    }

    function refresh() {
      clearTimeout(timer);
      if (stopped || !visible || document.hidden) return;
      if (
        banner!
          .querySelector(".soul-cover")
          ?.getAttribute("data-shader-status") === "unavailable"
      ) {
        setAnimateChanges(false);
        setMode(null);
        return;
      }
      const sampled = sample();
      if (!reduceMotion || !sampled) timer = setTimeout(refresh, 250);
    }
    const intersection = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      refresh();
    });
    intersection.observe(element);
    const resize = new ResizeObserver(refresh);
    resize.observe(banner);
    const mutation = new MutationObserver(refresh);
    mutation.observe(banner.querySelector(".soul-cover") ?? banner, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["data-shader-status"],
    });
    document.addEventListener("visibilitychange", refresh);
    refresh();
    return () => {
      stopped = true;
      clearTimeout(timer);
      intersection.disconnect();
      resize.disconnect();
      mutation.disconnect();
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [reduceMotion]);

  return (
    <span
      ref={ref}
      aria-hidden="true"
      data-soul-text-mode={mode ?? "loading"}
      className="absolute right-4 bottom-3 select-none font-mono text-4xl font-medium tracking-wide text-muted-foreground sm:right-5 sm:bottom-4"
    >
      <span
        className={mode ? "mix-blend-difference" : undefined}
        style={mode ? { color: cssColor(SOUL_TEXT_COLORS.light) } : undefined}
      >
        SOUL
      </span>
      {mode ? (
        <span
          className="pointer-events-none absolute inset-0 mix-blend-color"
          style={{ color: cssColor(SOUL_TEXT_COLORS.tint) }}
        >
          SOUL
        </span>
      ) : null}
      {(["dark", "light"] as const).map((tone) => (
        <span
          key={tone}
          className={
            animateChanges
              ? "pointer-events-none absolute inset-0 transition-opacity duration-1500 ease-in-out motion-reduce:duration-100"
              : "pointer-events-none absolute inset-0"
          }
          style={{
            color: cssColor(SOUL_TEXT_COLORS[tone]),
            opacity: mode === tone ? 1 : 0,
          }}
        >
          SOUL
        </span>
      ))}
    </span>
  );
}
