"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { Sparkles } from "lucide-react";
import { loadFull } from "tsparticles";
import type { ISourceOptions } from "@tsparticles/engine";
import Particles, { initParticlesEngine } from "@tsparticles/react";
import { cn } from "@/lib/utils";

type GenerateButtonParticlesProps = {
  text: string;
  disabled?: boolean;
  loading?: boolean;
  onClick?: () => void;
};

const baseOptions: ISourceOptions = {
  key: "star",
  name: "Star",
  particles: {
    number: { value: 20, density: { enable: false } },
    color: {
      value: ["#7c3aed", "#bae6fd", "#a78bfa", "#93c5fd", "#0284c7", "#fafafa", "#38bdf8"],
    },
    shape: { type: "star", options: { star: { sides: 4 } } },
    opacity: { value: 0.8 },
    size: { value: { min: 1, max: 4 } },
    rotate: {
      value: { min: 0, max: 360 },
      enable: true,
      direction: "clockwise",
      animation: { enable: true, speed: 10, sync: false },
    },
    links: { enable: false },
    reduceDuplicates: true,
    move: { enable: true, center: { x: 120, y: 45 } },
  },
  interactivity: { events: {} },
  smooth: true,
  fpsLimit: 120,
  background: { color: "transparent", size: "cover" },
  fullScreen: { enable: false },
  detectRetina: true,
  absorbers: [
    {
      enable: true,
      opacity: 0,
      size: { value: 1, density: 1, limit: { radius: 5, mass: 5 } },
      position: { x: 110, y: 45 },
    },
  ],
  emitters: [
    {
      autoPlay: true,
      fill: true,
      life: { wait: true },
      rate: { quantity: 5, delay: 0.5 },
      position: { x: 110, y: 45 },
    },
  ],
};

export function GenerateButtonParticles({ text, disabled, loading, onClick }: GenerateButtonParticlesProps) {
  const [particleState, setParticleState] = useState<"loaded" | "ready">();
  const [isHovering, setIsHovering] = useState(false);
  const particlesId = useId();

  useEffect(() => {
    void initParticlesEngine(async (engine) => {
      await loadFull(engine);
    }).then(() => setParticleState("loaded"));
  }, []);

  const options = useMemo(() => {
    return {
      ...baseOptions,
      autoPlay: isHovering && !disabled && !loading,
    } as ISourceOptions;
  }, [disabled, isHovering, loading]);

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      className={cn(
        "group relative h-9 rounded-full bg-gradient-to-r from-blue-300/30 via-blue-500/30 via-40% to-purple-500/30 p-1 text-white transition-transform",
        disabled ? "cursor-not-allowed opacity-50" : "hover:scale-105 active:scale-[0.98]",
      )}
    >
      <span className="relative z-10 flex h-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-blue-300 via-blue-500 via-40% to-purple-500 px-4 text-xs font-semibold text-white">
        <Sparkles className="size-4 fill-white" />
        <span>{loading ? "Generiert..." : text}</span>
      </span>
      {!!particleState && (
        <Particles
          id={particlesId}
          className={cn("pointer-events-none absolute -bottom-4 -left-4 -right-4 -top-4 z-0 opacity-0 transition-opacity", {
            "group-hover:opacity-100": particleState === "ready" && !disabled && !loading,
          })}
          particlesLoaded={async () => setParticleState("ready")}
          options={options}
        />
      )}
    </button>
  );
}
