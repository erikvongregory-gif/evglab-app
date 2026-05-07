import { cn } from "@/lib/utils";

type Props = {
  className?: string;
  /** Sichtbarer Name fürs `alt` (z. B. neben Text). Standard: dekorativ leer. */
  title?: string;
};

/** Hopfen-Hugo-Maskottchen (`/hopfenhugo.svg`) — ohne zusätzliche UI-Box, nur das Asset. */
export function HopfenHugoIcon({ className, title }: Props) {
  return (
    <img
      src="/hopfenhugo.svg"
      alt={title ?? ""}
      width={256}
      height={256}
      decoding="async"
      className={cn("shrink-0 object-contain select-none", className)}
      aria-hidden={title ? undefined : true}
      title={title}
    />
  );
}
