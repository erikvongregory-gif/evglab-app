"use client";

import {
  forwardRef,
  useEffect,
  useRef,
  type ComponentType,
  type HTMLAttributes,
  type Ref,
} from "react";
import { cn } from "@/lib/utils";
import { BeerIcon } from "@/components/ui/animated-icons/beer";
import { CheckIcon } from "@/components/ui/animated-icons/check";
import { EarthIcon } from "@/components/ui/animated-icons/earth";
import { FlameIcon } from "@/components/ui/animated-icons/flame";
import { FrameIcon } from "@/components/ui/animated-icons/frame";
import { HeartIcon } from "@/components/ui/animated-icons/heart";
import { LayersIcon } from "@/components/ui/animated-icons/layers";
import { MapPinIcon } from "@/components/ui/animated-icons/map-pin";
import { PaletteIcon } from "@/components/ui/animated-icons/palette";
import { PartyPopperIcon } from "@/components/ui/animated-icons/party-popper";
import { RocketIcon } from "@/components/ui/animated-icons/rocket";
import { SparklesIcon } from "@/components/ui/animated-icons/sparkles";
import { SunIcon } from "@/components/ui/animated-icons/sun";
import { UserIcon } from "@/components/ui/animated-icons/user";
import { UsersIcon } from "@/components/ui/animated-icons/users";
import { XIcon } from "@/components/ui/animated-icons/x";
import { ZapIcon } from "@/components/ui/animated-icons/zap";

type IconHandle = {
  startAnimation: () => void;
  stopAnimation: () => void;
};

type AnimatedIconProps = HTMLAttributes<HTMLDivElement> & {
  size?: number;
};

type AnimatedIconComponent = ComponentType<
  AnimatedIconProps & { ref?: Ref<IconHandle> }
>;

const ICON_MAP: Record<string, AnimatedIconComponent> = {
  spark: SparklesIcon as AnimatedIconComponent,
  sparkles: SparklesIcon as AnimatedIconComponent,
  cup: BeerIcon as AnimatedIconComponent,
  beer: BeerIcon as AnimatedIconComponent,
  coffee: BeerIcon as AnimatedIconComponent,
  user: UserIcon as AnimatedIconComponent,
  users: UsersIcon as AnimatedIconComponent,
  team: UsersIcon as AnimatedIconComponent,
  image: FrameIcon as AnimatedIconComponent,
  media: FrameIcon as AnimatedIconComponent,
  frame: FrameIcon as AnimatedIconComponent,
  check: CheckIcon as AnimatedIconComponent,
  x: XIcon as AnimatedIconComponent,
  bolt: ZapIcon as AnimatedIconComponent,
  zap: ZapIcon as AnimatedIconComponent,
  rocket: RocketIcon as AnimatedIconComponent,
  globe: EarthIcon as AnimatedIconComponent,
  earth: EarthIcon as AnimatedIconComponent,
  brand: PaletteIcon as AnimatedIconComponent,
  shield: PaletteIcon as AnimatedIconComponent,
  palette: PaletteIcon as AnimatedIconComponent,
  layers: LayersIcon as AnimatedIconComponent,
  sun: SunIcon as AnimatedIconComponent,
  party: PartyPopperIcon as AnimatedIconComponent,
  flame: FlameIcon as AnimatedIconComponent,
  heart: HeartIcon as AnimatedIconComponent,
  pin: MapPinIcon as AnimatedIconComponent,
};

export function hasAnimatedStudioIcon(name: string): boolean {
  return Boolean(ICON_MAP[name]);
}

type AnimatedStudioIconProps = {
  name: string;
  size?: number;
  className?: string;
  /** Animate when a parent button/group is hovered */
  syncParentHover?: boolean;
};

/** 21st.dev lucide-animated icons with hover motion. */
export const AnimatedStudioIcon = forwardRef<HTMLSpanElement, AnimatedStudioIconProps>(
  function AnimatedStudioIcon(
    { name, size = 18, className, syncParentHover = true },
    forwardedRef,
  ) {
    const Icon = ICON_MAP[name];
    const handleRef = useRef<IconHandle | null>(null);
    const rootRef = useRef<HTMLSpanElement | null>(null);

    useEffect(() => {
      if (!syncParentHover) return;
      const root = rootRef.current;
      if (!root) return;
      const parent =
        root.closest("[data-icon-hover]") ??
        root.closest(".group") ??
        root.closest("button");
      if (!parent || parent === root) return;

      const enter = () => handleRef.current?.startAnimation();
      const leave = () => handleRef.current?.stopAnimation();
      parent.addEventListener("mouseenter", enter);
      parent.addEventListener("mouseleave", leave);
      return () => {
        parent.removeEventListener("mouseenter", enter);
        parent.removeEventListener("mouseleave", leave);
      };
    }, [syncParentHover, name]);

    if (!Icon) return null;

    return (
      <span
        ref={(node) => {
          rootRef.current = node;
          if (typeof forwardedRef === "function") forwardedRef(node);
          else if (forwardedRef) forwardedRef.current = node;
        }}
        className={cn("inline-flex shrink-0 items-center justify-center", className)}
        aria-hidden
      >
        <Icon
          ref={handleRef}
          size={size}
          className="inline-flex"
          onMouseEnter={() => handleRef.current?.startAnimation()}
          onMouseLeave={() => handleRef.current?.stopAnimation()}
        />
      </span>
    );
  },
);
