"use client";

import { Expand, ImageOff, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

function ReferenceImage({ src, label, full = false }: { src: string; label: string; full?: boolean }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <span className="flex min-h-32 flex-col items-center justify-center gap-2 p-4 text-sm text-muted-foreground"><ImageOff aria-hidden="true" />Bild nicht verfügbar</span>;
  // External/private reference URLs must retain their original query parameters.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={label} loading={full ? "eager" : "lazy"} onError={() => setFailed(true)} className={full ? "max-h-[70dvh] w-full object-contain" : "h-full w-full object-contain p-2 transition-transform duration-300 group-hover:scale-[1.025] motion-reduce:transform-none motion-reduce:transition-none"} />;
}

export function BrandReferenceGallery({ urls }: { urls: string[] }) {
  const images = [...new Set(urls.map((url) => url.trim()).filter(Boolean))];
  if (!images.length) return null;
  return (
    <section className="my-8 space-y-4" aria-label="Referenzbilder">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div><h2 className="text-lg font-semibold tracking-tight">Referenzbilder</h2><p className="mt-1 text-sm text-muted-foreground">Diese Motive geben deiner Bildsprache eine Richtung.</p></div>
        <span className="text-xs tabular-nums text-muted-foreground">{images.length} {images.length === 1 ? "Bild" : "Bilder"}</span>
      </div>
      <div className="grid grid-cols-1 gap-4 min-[400px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {images.map((src, index) => (
          <Dialog key={src}>
            <DialogTrigger asChild>
              <button type="button" className="group min-w-0 overflow-hidden rounded-xl border border-border bg-card text-left outline-none transition-shadow hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring" aria-label={`Referenzbild ${index + 1} vergrößern`}>
                <span className="relative block aspect-[4/3] overflow-hidden bg-muted/40"><ReferenceImage src={src} label={`Referenzbild ${index + 1}`} /><span className="absolute bottom-2 right-2 rounded-md border border-border bg-background/90 p-1.5 text-foreground"><Expand className="size-3.5" aria-hidden="true" /></span></span>
                <span className="block border-t border-border px-3 py-2.5 text-xs text-muted-foreground">Referenz {String(index + 1).padStart(2, "0")}</span>
              </button>
            </DialogTrigger>
            <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-4xl" showCloseButton={false}>
              <div className="flex items-center justify-between gap-4"><DialogTitle>Referenzbild {index + 1}</DialogTitle><DialogClose asChild><Button variant="ghost" size="icon" aria-label="Großansicht schließen"><X aria-hidden="true" /></Button></DialogClose></div>
              <DialogDescription className="sr-only">Vollständiges Referenzbild ohne Beschnitt.</DialogDescription>
              <ReferenceImage src={src} label={`Referenzbild ${index + 1} in voller Größe`} full />
            </DialogContent>
          </Dialog>
        ))}
      </div>
    </section>
  );
}
