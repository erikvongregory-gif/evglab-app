"use client";

import React, { useEffect, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";

import { LoadingButton } from "@/components/ui/loading-button";
import { cn } from "@/lib/utils";

const CheckIcon = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="3"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden
  >
    <path d="M20 6 9 17l-5-5" />
  </svg>
);

export type ShaderCanvasMode = "viewport" | "contained";

/** `ring` = ein Kreis (Pakete & Preise); `loop` = zwei Kreise wie ∞ / Schleife – gleicher Farb-/Noise-Stil. */
export type ShaderCanvasShape = "ring" | "loop";

/** Passt zum Orange-Radial (#fff → #f59e0b); Ringe ohne grauen Untergrund. */
const SHADER_BLEND_WITH_ORANGE_BG: [number, number, number] = [
  255 / 255,
  248 / 255,
  232 / 255,
];

export const CONTAINED_SHADER_BG = {
  desktopLight: SHADER_BLEND_WITH_ORANGE_BG,
  mobileDark: SHADER_BLEND_WITH_ORANGE_BG,
};

/** WebGL-Hintergrund mit animiertem Kreis (Shadertoy-Logik aus der Vorlage). */
export interface ShaderCanvasProps {
  /** `viewport` = fullscreen fixed (Demo-Seite); `contained` = füllt relativ positioniertes Elternelement */
  mode?: ShaderCanvasMode;
  /** Geometrie der Maske – nur bei `mode="contained"` relevant für Section-Hintergründe. */
  shape?: ShaderCanvasShape;
  /** RGB jeweils 0–1. Wenn gesetzt, kein automatischer Light/Dark-Toggle am &lt;html&gt; */
  backgroundRgb?: [number, number, number];
  className?: string;
}

export const ShaderCanvas = ({
  mode = "viewport",
  shape = "ring",
  backgroundRgb,
  className,
}: ShaderCanvasProps) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const glProgramRef = useRef<WebGLProgram | null>(null);
  const glBgColorLocationRef = useRef<WebGLUniformLocation | null>(null);
  const glRef = useRef<WebGLRenderingContext | null>(null);
  const [backgroundColor, setBackgroundColor] = useState<[number, number, number]>(
    backgroundRgb ?? [1.0, 1.0, 1.0],
  );

  useEffect(() => {
    if (backgroundRgb) {
      setBackgroundColor(backgroundRgb);
      return;
    }
    const root = document.documentElement;
    const updateColor = () => {
      const isDark = root.classList.contains("dark");
      setBackgroundColor(isDark ? [0, 0, 0] : [1.0, 1.0, 1.0]);
    };
    updateColor();
    const observer = new MutationObserver((mutationsList) => {
      for (const mutation of mutationsList) {
        if (
          mutation.type === "attributes" &&
          mutation.attributeName === "class"
        ) {
          updateColor();
        }
      }
    });
    observer.observe(root, { attributes: true });
    return () => observer.disconnect();
  }, [backgroundRgb]);

  useEffect(() => {
    const gl = glRef.current;
    const program = glProgramRef.current;
    const location = glBgColorLocationRef.current;
    if (gl && program && location) {
      gl.useProgram(program);
      gl.uniform3fv(location, new Float32Array(backgroundColor));
    }
  }, [backgroundColor]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext("webgl", { alpha: true, premultipliedAlpha: false });
    if (!gl) {
      console.error("WebGL not supported");
      return;
    }
    glRef.current = gl;

    const transparentRings = mode === "contained";
    if (transparentRings) {
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    }

    const vertexShaderSource =
      "attribute vec2 aPosition; void main() { gl_Position = vec4(aPosition, 0.0, 1.0); }";
    const fragmentShaderSource = `
      precision highp float;
      uniform float iTime;
      uniform vec2 iResolution;
      uniform vec3 uBackgroundColor;
      uniform float uShapeType;
      uniform float uTransparentRings;
      mat2 rotate2d(float angle){ float c=cos(angle),s=sin(angle); return mat2(c,-s,s,c); }
      float variation(vec2 v1,vec2 v2,float strength,float speed){ return sin(dot(normalize(v1),normalize(v2))*strength+iTime*speed)/100.0; }
      vec3 paintCircle(vec2 uv,vec2 center,float rad,float width){
        vec2 diff = center-uv;
        float len = length(diff);
        len += variation(diff,vec2(0.,1.),5.,2.);
        len -= variation(diff,vec2(1.,0.),5.,2.);
        float circle = smoothstep(rad-width,rad,len)-smoothstep(rad,rad+width,len);
        return vec3(circle);
      }
      void main(){
        /* Gleiche Längeneinheit für x/y → Kreise bleiben rund (kein Fix 1.5x nur für Desktop). */
        vec2 uv = (2.0 * gl_FragCoord.xy - iResolution.xy) / iResolution.y;
        float asp = iResolution.x / max(iResolution.y, 1.0);
        float wideT = clamp((asp - 0.42) / (1.15 - 0.42), 0.0, 1.0);
        float mask = 0.0;
        float hi = 0.0;
        if (uShapeType < 0.5) {
          float radius = mix(0.52, 0.68, wideT);
          vec2 center = vec2(0.0);
          float w = mix(0.048, 0.058, wideT);
          mask += paintCircle(uv,center,radius,w).r;
          mask += paintCircle(uv,center,radius-mix(0.022,0.028,wideT),mix(0.014,0.018,wideT)).r;
          mask += paintCircle(uv,center,radius+mix(0.022,0.028,wideT),mix(0.007,0.009,wideT)).r;
          hi = paintCircle(uv,center,radius,mix(0.004,0.005,wideT)).r;
        } else {
          float spread = mix(0.26, 0.48, wideT);
          float rad = mix(0.24, 0.34, wideT);
          float w = mix(0.038, 0.048, wideT);
          vec2 cL = vec2(-spread, 0.0);
          vec2 cR = vec2(spread, 0.0);
          mask += paintCircle(uv,cL,rad,w).r;
          mask += paintCircle(uv,cL,rad-mix(0.018,0.022,wideT),mix(0.010,0.012,wideT)).r;
          mask += paintCircle(uv,cL,rad+mix(0.018,0.022,wideT),mix(0.006,0.007,wideT)).r;
          mask += paintCircle(uv,cR,rad,w).r;
          mask += paintCircle(uv,cR,rad-mix(0.018,0.022,wideT),mix(0.010,0.012,wideT)).r;
          mask += paintCircle(uv,cR,rad+mix(0.018,0.022,wideT),mix(0.006,0.007,wideT)).r;
          hi = max(paintCircle(uv,cL,rad,mix(0.003,0.004,wideT)).r,paintCircle(uv,cR,rad,mix(0.003,0.004,wideT)).r);
        }
        vec2 v=rotate2d(iTime)*uv;
        vec3 foregroundColor=vec3(v.x,v.y,.7-v.y*v.x);
        vec3 colorOpaque = mix(uBackgroundColor, foregroundColor, mask);
        colorOpaque = mix(colorOpaque, vec3(1.), hi);
        vec3 rgbRing = mix(foregroundColor, vec3(1.), min(hi * 2.8, 1.0));
        float alphaRing = clamp(mask * 0.92 + hi * 2.4, 0.0, 1.0);
        vec4 fragOpaque = vec4(colorOpaque, 1.0);
        vec4 fragRing = vec4(rgbRing, alphaRing);
        gl_FragColor = mix(fragOpaque, fragRing, uTransparentRings);
      }`;

    const compileShader = (type: number, source: string) => {
      const shader = gl.createShader(type);
      if (!shader) throw new Error("Could not create shader");
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        throw new Error(gl.getShaderInfoLog(shader) || "Shader compilation error");
      }
      return shader;
    };

    const program = gl.createProgram();
    if (!program) throw new Error("Could not create program");
    const vertexShader = compileShader(gl.VERTEX_SHADER, vertexShaderSource);
    const fragmentShader = compileShader(gl.FRAGMENT_SHADER, fragmentShaderSource);
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    gl.useProgram(program);
    glProgramRef.current = program;

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW,
    );
    const aPosition = gl.getAttribLocation(program, "aPosition");
    gl.enableVertexAttribArray(aPosition);
    gl.vertexAttribPointer(aPosition, 2, gl.FLOAT, false, 0, 0);

    const iTimeLoc = gl.getUniformLocation(program, "iTime");
    const iResLoc = gl.getUniformLocation(program, "iResolution");
    const uShapeTypeLoc = gl.getUniformLocation(program, "uShapeType");
    const uTransparentRingsLoc = gl.getUniformLocation(program, "uTransparentRings");
    glBgColorLocationRef.current = gl.getUniformLocation(program, "uBackgroundColor");
    gl.uniform3fv(glBgColorLocationRef.current, new Float32Array(backgroundColor));
    const shapeLoop = shape === "loop" ? 1.0 : 0.0;
    const transparentRingsUniform = transparentRings ? 1.0 : 0.0;

    let animationFrameId: number;
    const render = (time: number) => {
      if (transparentRings) {
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
      }
      gl.uniform1f(iTimeLoc, time * 0.001);
      gl.uniform2f(iResLoc, canvas.width, canvas.height);
      if (uShapeTypeLoc) gl.uniform1f(uShapeTypeLoc, shapeLoop);
      if (uTransparentRingsLoc) gl.uniform1f(uTransparentRingsLoc, transparentRingsUniform);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      animationFrameId = requestAnimationFrame(render);
    };

    const sizeCanvas = () => {
      if (mode === "contained") {
        const parent = canvas.parentElement;
        if (!parent) return;
        const w = Math.max(1, Math.floor(parent.clientWidth));
        const h = Math.max(1, Math.floor(parent.clientHeight));
        canvas.width = w;
        canvas.height = h;
      } else {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
      }
      gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    };

    sizeCanvas();

    let ro: ResizeObserver | undefined;
    if (mode === "contained") {
      const parent = canvas.parentElement;
      if (parent) {
        ro = new ResizeObserver(() => sizeCanvas());
        ro.observe(parent);
      }
    } else {
      window.addEventListener("resize", sizeCanvas);
    }

    animationFrameId = requestAnimationFrame(render);
    return () => {
      ro?.disconnect();
      if (mode !== "contained") {
        window.removeEventListener("resize", sizeCanvas);
      }
      cancelAnimationFrame(animationFrameId);
    };
  }, [mode, shape]);

  const canvasClass =
    mode === "contained"
      ? cn(
          "pointer-events-none absolute inset-0 block h-full min-h-full w-full min-w-full bg-transparent",
          className,
        )
      : cn("fixed left-0 top-0 z-0 block h-full w-full bg-background", className);

  return <canvas ref={canvasRef} className={canvasClass} aria-hidden />;
};

export interface PricingCardProps {
  planName: string;
  /** Optionales Icon neben dem Paketnamen (Lucide, wie im restlichen UI) */
  planIcon?: LucideIcon;
  description: string;
  price: string;
  features: string[];
  buttonText: string;
  isPopular?: boolean;
  buttonVariant?: "primary" | "secondary";
  /** Vor dem Preis, Standard wie im Demo: "$" */
  currencyPrefix?: string;
  /** Kleiner Text neben dem Preis, z. B. "/mo" oder "einmalig" */
  priceSubtext?: string;
  /** Text auf dem Popular-Badge */
  popularLabel?: string;
  onCtaClick?: () => void;
  buttonLoading?: boolean;
  buttonDisabled?: boolean;
  "data-paket"?: string;
  className?: string;
  /** Kleinere Typo & Padding – z. B. Add-ons unter den Hauptpaketen. */
  compact?: boolean;
}

export const PricingCard = ({
  planName,
  planIcon: PlanIcon,
  description,
  price,
  features,
  buttonText,
  isPopular = false,
  buttonVariant = "primary",
  currencyPrefix = "$",
  priceSubtext = "/mo",
  popularLabel = "Most Popular",
  onCtaClick,
  buttonLoading = false,
  buttonDisabled = false,
  "data-paket": dataPaket,
  className,
  compact = false,
}: PricingCardProps) => {
  /* Hover: nur minimaler Lift (translateY), kein Zoom – kurz, ease-out, dezenter Schatten. */
  const cardClasses = cn(
    "relative z-[2] flex min-w-0 flex-1 flex-col rounded-[var(--ui-radius-lg)] border border-black/10 bg-white/80 shadow-[var(--ui-shadow-soft)] backdrop-blur-[14px] backdrop-blur-[0.5px]",
    "dark:border-white/10 dark:from-white/10 dark:to-white/5 dark:backdrop-brightness-[0.91]",
    "evg-clean-hover transform-gpu transition-[transform,box-shadow,border-color] ease-[var(--ui-motion-ease)]",
    compact
      ? "w-full max-w-[280px] px-5 py-6 sm:max-w-[300px]"
      : "max-w-xs px-7 py-8",
    isPopular
      ? "relative z-[2] max-md:scale-100 md:translate-y-[-4px] shadow-[var(--ui-shadow-accent)] ring-1 ring-[#e07a40]/30 dark:from-white/20 dark:to-white/10 dark:border-[#c65a20]/45 hover:z-10 hover:border-[#e07a40]/35 hover:shadow-[var(--ui-shadow-accent-hover)] dark:hover:border-white/20 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
      : "hover:z-10 hover:border-[#e07a40]/35 hover:shadow-[0_16px_34px_-20px_rgba(198,90,32,0.24)] dark:hover:border-white/20 motion-reduce:transition-none motion-reduce:hover:translate-y-0",
    className,
  );
  const buttonClasses = cn(
    "mt-auto w-full rounded-xl font-semibold font-sans transition",
    compact ? "py-2 text-[13px]" : "py-2.5 text-[14px]",
    buttonVariant === "primary"
      ? "bg-[#c65a20] text-white hover:bg-[#d46830]"
      : "border border-black/20 bg-black/10 text-zinc-900 hover:bg-black/20",
    buttonDisabled ? "cursor-not-allowed opacity-60" : "",
  );

  return (
    <div className={cardClasses}>
      {isPopular && (
        <div className="absolute -top-4 right-4 rounded-full bg-[#c65a20] px-3 py-1 text-[12px] font-semibold text-white shadow-md shadow-orange-900/25">
          {popularLabel}
        </div>
      )}
      <div
        className={cn(
          "min-w-0 mb-2 flex flex-col",
          compact
            ? "mb-1.5 min-h-[8.25rem] sm:min-h-[8.75rem]"
            : "min-h-[10.5rem] sm:min-h-[11.5rem]",
        )}
      >
        <div
          className={cn(
            "flex min-w-0 w-full gap-3",
            PlanIcon ? "flex-col sm:flex-row sm:items-start" : "",
            compact ? "gap-2 sm:gap-2.5" : "sm:gap-4",
          )}
        >
          {PlanIcon ? (
            <span
              className={cn(
                "flex shrink-0 items-center justify-center rounded-xl border border-black/10 bg-black/[0.04] text-[#c65a20] dark:border-white/10 dark:bg-white/[0.06] dark:text-[#e07a40]",
                compact ? "h-9 w-9" : "h-11 w-11",
              )}
              aria-hidden
            >
              <PlanIcon
                className={compact ? "h-4 w-4" : "h-5 w-5"}
                strokeWidth={1.75}
              />
            </span>
          ) : null}
          <h2
            className={cn(
              "min-w-0 max-w-full break-words font-display font-normal tracking-[-0.03em] text-zinc-900 hyphens-auto",
              PlanIcon && "sm:flex-1 sm:min-w-0",
              PlanIcon
                ? compact
                  ? "text-[1.35rem] leading-tight sm:text-[1.5rem]"
                  : "text-[1.75rem] leading-tight sm:text-[2rem] md:text-[2.125rem]"
                : compact
                  ? "text-[1.65rem] leading-[1.15] sm:text-[1.85rem]"
                  : "text-[48px]",
            )}
          >
            {planName}
          </h2>
        </div>
        <p
          className={cn(
            "min-w-0 break-words font-sans text-zinc-600",
            PlanIcon ? "mt-2.5 sm:mt-2" : "mt-1",
            compact ? "text-[13px] leading-snug" : "text-[16px]",
          )}
        >
          {description}
        </p>
      </div>
      <div
        className={cn(
          "flex min-w-0 flex-col items-start gap-0.5",
          compact ? "my-4" : "my-6",
        )}
      >
        <span
          className={cn(
            "min-w-0 max-w-full break-words font-display font-normal text-zinc-900",
            compact ? "text-[1.75rem] sm:text-[2rem]" : "text-[48px]",
          )}
        >
          {currencyPrefix}
          {price}
        </span>
        <span
          className={cn(
            "min-w-0 font-sans text-zinc-600",
            compact ? "text-[12px] leading-tight" : "text-[14px]",
          )}
        >
          {priceSubtext}
        </span>
      </div>
      <div
        className={cn(
          "card-divider h-px w-full bg-[linear-gradient(90deg,transparent,rgba(0,0,0,0.1)_50%,transparent)] dark:bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.09)_20%,rgba(255,255,255,0.22)_50%,rgba(255,255,255,0.09)_80%,transparent)]",
          compact ? "mb-3" : "mb-5",
        )}
      />
      <ul
        className={cn(
          "flex flex-col font-sans text-zinc-800",
          compact ? "mb-4 gap-1.5 text-[13px] leading-snug" : "mb-6 gap-2 text-[14px]",
        )}
      >
        {features.map((feature, index) => (
          <li key={index} className="flex min-w-0 items-start gap-2">
            <CheckIcon className={cn("shrink-0 text-[#e07a40]", compact ? "mt-0.5 h-3.5 w-3.5" : "h-4 w-4")} />{" "}
            <span className="min-w-0 break-words">{feature}</span>
          </li>
        ))}
      </ul>
      <LoadingButton
        className={buttonClasses}
        onClick={onCtaClick}
        loading={buttonLoading}
        disabled={buttonLoading || buttonDisabled}
        data-paket={dataPaket}
      >
        {buttonText}
      </LoadingButton>
    </div>
  );
};

interface ModernPricingPageProps {
  title: React.ReactNode;
  subtitle: React.ReactNode;
  plans: PricingCardProps[];
  showAnimatedBackground?: boolean;
}

export const ModernPricingPage = ({
  title,
  subtitle,
  plans,
  showAnimatedBackground = true,
}: ModernPricingPageProps) => {
  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-background text-foreground">
      {showAnimatedBackground ? <ShaderCanvas mode="viewport" /> : null}
      <main className="relative flex min-h-screen w-full flex-col items-center justify-center px-4 py-8">
        <div className="mx-auto mb-14 w-full max-w-5xl text-center">
          <h1 className="bg-gradient-to-r from-slate-900 via-[#c65a20] to-[#e07a40] bg-clip-text font-display text-[48px] font-normal leading-tight tracking-[-0.03em] text-transparent dark:from-white dark:via-[#e07a40] dark:to-[#f4a261] md:text-[64px]">
            {title}
          </h1>
          <p className="mx-auto mt-3 max-w-2xl font-sans text-[16px] text-foreground/80 md:text-[20px]">
            {subtitle}
          </p>
        </div>
        <div className="flex w-full max-w-4xl flex-col items-center justify-center gap-8 md:flex-row md:gap-6">
          {plans.map((plan) => (
            <PricingCard key={plan.planName} {...plan} />
          ))}
        </div>
      </main>
    </div>
  );
};
