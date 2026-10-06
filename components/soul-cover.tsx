"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";
import { getSoulCoverComposition } from "@/lib/soul-cover";
import { Skeleton } from "@/components/ui/skeleton";

const MeshGradient = dynamic(
  () =>
    import("@paper-design/shaders-react").then((module) => module.MeshGradient),
  { ssr: false },
);

export function SoulCover({ seed }: { seed: number }) {
  const reduceMotion = useReducedMotion();
  const surface = useRef<HTMLDivElement>(null);
  const [webGLAvailable, setWebGLAvailable] = useState<boolean | null>(null);
  const composition = getSoulCoverComposition(seed);

  useEffect(() => {
    // Keep a neutral loading surface until the shader mounts. Unavailable or
    // lost WebGL gets a static gray fallback, not an endless loading animation.
    const probe = document.createElement("canvas");
    try {
      const context = probe.getContext("webgl2");
      if (context) {
        context.getExtension("WEBGL_lose_context")?.loseContext();
        setWebGLAvailable(true);
      } else setWebGLAvailable(false);
    } catch {
      setWebGLAvailable(false);
    }
    const element = surface.current;
    const onContextLost = () => setWebGLAvailable(false);
    element?.addEventListener("webglcontextlost", onContextLost, true);
    return () =>
      element?.removeEventListener("webglcontextlost", onContextLost, true);
  }, []);

  return (
    <div
      ref={surface}
      className="soul-cover group/soul-cover pointer-events-none absolute inset-0 overflow-clip rounded-[inherit] bg-muted"
      aria-hidden="true"
      data-shader-status={
        webGLAvailable === null
          ? "loading"
          : webGLAvailable
            ? "available"
            : "unavailable"
      }
    >
      <Skeleton
        className={`absolute inset-0 rounded-[inherit] motion-reduce:animate-none group-has-[canvas]/soul-cover:hidden ${webGLAvailable === false ? "animate-none" : ""}`}
      />
      {webGLAvailable ? (
        <MeshGradient
          className="absolute inset-0"
          width="100%"
          height="100%"
          fit="cover"
          scale={0.65}
          colors={["#073b4c", "#00bdaa", "#b7f7a8", "#009966"]}
          distortion={1}
          swirl={0.35}
          grainMixer={0.16}
          grainOverlay={0.07}
          speed={reduceMotion ? 0 : 0.3}
          frame={composition.frame}
          rotation={composition.rotation}
          offsetX={composition.offsetX}
          offsetY={composition.offsetY}
          minPixelRatio={1}
          maxPixelCount={750000}
          // Retain the frame for low-rate readback, including reduced motion.
          webGlContextAttributes={{ preserveDrawingBuffer: true }}
        />
      ) : null}
    </div>
  );
}
