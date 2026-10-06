"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";
import { getSoulCoverComposition } from "@/lib/soul-cover";

const MeshGradient = dynamic(
  () =>
    import("@paper-design/shaders-react").then((module) => module.MeshGradient),
  { ssr: false },
);

export function SoulCover({ seed }: { seed: number }) {
  const reduceMotion = useReducedMotion();
  const surface = useRef<HTMLDivElement>(null);
  const [webGLAvailable, setWebGLAvailable] = useState(false);
  const composition = getSoulCoverComposition(seed);

  useEffect(() => {
    // The server-rendered gradient stays underneath the shader. Devices without
    // WebGL (or with a lost context) keep that artwork instead of a blank cover.
    const probe = document.createElement("canvas");
    try {
      const context = probe.getContext("webgl2");
      if (context) {
        context.getExtension("WEBGL_lose_context")?.loseContext();
        setWebGLAvailable(true);
      }
    } catch {
      /* Static artwork is the fallback. */
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
      className="soul-cover pointer-events-none absolute inset-0 overflow-clip rounded-[inherit]"
      aria-hidden="true"
    >
      <div className="soul-cover-fallback absolute inset-0" />
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
        />
      ) : null}
    </div>
  );
}
