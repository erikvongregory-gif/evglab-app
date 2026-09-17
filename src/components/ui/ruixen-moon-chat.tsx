"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { StudioIcon } from "@/components/studio/icons";
import { MagneticText } from "@/components/ui/morphing-cursor";
import { cn } from "@/lib/utils";
import { beerStyleLabel } from "@/app/(dashboard)/inhalte-erstellen/lib/beer-styles";
import {
  OCCASION_TEMPLATES,
  sortTemplatesForDate,
  type OccasionTemplate,
} from "@/app/(dashboard)/inhalte-erstellen/lib/occasion-templates";
import {
  produktKategorieLabel,
  sanitizeProduktKategorie,
  type DashboardBeer,
  type DashboardCharacter,
} from "@/lib/dashboard/metadata";
import { estimateStudioImageTokenCost } from "@/lib/billing/generationTokenCost";
import { startStudioGeneration, mediaLibraryHref } from "@/lib/inhalte-erstellen/start-studio-generation";
import {
  CHARACTER_ASPECTS,
  effectiveAspectRatio,
  type Aspect,
} from "@/lib/inhalte-erstellen/studio-config";

const MOON_BG = "url('/studio/moon-bg.webp')";
const MOON_BG_SRC = "/studio/moon-bg.webp";

const PLACEHOLDER_ETIKETT = "https://example.com/placeholder.png";

const ASPECT_OPTIONS: { value: Aspect; hint: string }[] = [
  { value: "1:1", hint: "Quadrat" },
  { value: "4:5", hint: "Feed" },
  { value: "3:4", hint: "Portrait" },
  { value: "9:16", hint: "Story / Reel" },
  { value: "4:3", hint: "Quer" },
  { value: "16:9", hint: "Landscape" },
];

const VALID_SZENEN = new Set<string>([
  "biergarten_sommer",
  "wirtshaus_innen",
  "kueche_zuhause",
  "wiese_picknick",
  "strand_sonnenuntergang",
  "alpenpanorama",
  "stadtbalkon_abend",
  "brauereihof",
  "fussball_public_viewing",
]);

interface AutoResizeProps {
  minHeight: number;
  maxHeight?: number;
}

function useAutoResizeTextarea({ minHeight, maxHeight }: AutoResizeProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const adjustHeight = useCallback(
    (reset?: boolean) => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      if (reset) {
        textarea.style.height = `${minHeight}px`;
        return;
      }

      textarea.style.height = `${minHeight}px`;
      const newHeight = Math.max(
        minHeight,
        Math.min(textarea.scrollHeight, maxHeight ?? Infinity),
      );
      textarea.style.height = `${newHeight}px`;
    },
    [minHeight, maxHeight],
  );

  useEffect(() => {
    if (textareaRef.current) textareaRef.current.style.height = `${minHeight}px`;
  }, [minHeight]);

  return { textareaRef, adjustHeight };
}

function beerInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function beerMeta(beer: DashboardBeer) {
  const kategorie = sanitizeProduktKategorie(beer.produktKategorie);
  if (kategorie === "bier") return beerStyleLabel(beer.bierstil);
  return produktKategorieLabel(kategorie);
}

export default function RuixenMoonChat() {
  const [message, setMessage] = useState("");
  const [activePresetId, setActivePresetId] = useState<string | null>(null);
  const [aspectRatio, setAspectRatio] = useState<Aspect>("4:5");
  const [formatPickerOpen, setFormatPickerOpen] = useState(false);
  const [beers, setBeers] = useState<DashboardBeer[]>([]);
  const [selectedBeer, setSelectedBeer] = useState<DashboardBeer | null>(null);
  const [beerPickerOpen, setBeerPickerOpen] = useState(false);
  const [beersLoading, setBeersLoading] = useState(true);
  const [beersError, setBeersError] = useState<string | null>(null);
  const [characters, setCharacters] = useState<DashboardCharacter[]>([]);
  const [selectedCharacter, setSelectedCharacter] = useState<DashboardCharacter | null>(null);
  const [characterPickerOpen, setCharacterPickerOpen] = useState(false);
  const [charactersLoading, setCharactersLoading] = useState(true);
  const [charactersError, setCharactersError] = useState<string | null>(null);
  const [genBusy, setGenBusy] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const router = useRouter();
  const { textareaRef, adjustHeight } = useAutoResizeTextarea({
    minHeight: 48,
    maxHeight: 150,
  });

  const quickPresets = sortTemplatesForDate(OCCASION_TEMPLATES, new Date())
    .slice(0, 8)
    .map(({ template }) => template);

  const activePreset =
    OCCASION_TEMPLATES.find((template) => template.id === activePresetId) ?? null;

  const applyPreset = useCallback(
    (template: OccasionTemplate) => {
      setActivePresetId(template.id);
      setMessage(template.motifLine);
      setAspectRatio(
        effectiveAspectRatio(template.preset.aspectRatio, Boolean(selectedCharacter)),
      );
      adjustHeight();
      requestAnimationFrame(() => adjustHeight());
    },
    [adjustHeight, selectedCharacter],
  );

  const selectCharacter = useCallback((character: DashboardCharacter | null) => {
    setSelectedCharacter(character);
    setCharacterPickerOpen(false);
    if (character) {
      setAspectRatio((prev) => effectiveAspectRatio(prev, true));
    }
  }, []);

  const selectAspect = useCallback(
    (next: Aspect) => {
      setAspectRatio(effectiveAspectRatio(next, Boolean(selectedCharacter)));
      setFormatPickerOpen(false);
    },
    [selectedCharacter],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setBeersLoading(true);
      setCharactersLoading(true);
      setBeersError(null);
      setCharactersError(null);

      const [beersOutcome, charactersOutcome] = await Promise.allSettled([
        fetch("/api/dashboard/my-beers", { cache: "no-store", credentials: "include" }).then(
          async (response) => {
            if (!response.ok) throw new Error("beers");
            return (await response.json()) as { beers?: DashboardBeer[] };
          },
        ),
        fetch("/api/dashboard/my-characters", {
          cache: "no-store",
          credentials: "include",
        }).then(async (response) => {
          if (!response.ok) throw new Error("characters");
          return (await response.json()) as { characters?: DashboardCharacter[] };
        }),
      ]);

      if (cancelled) return;

      if (beersOutcome.status === "fulfilled") {
        setBeers(Array.isArray(beersOutcome.value.beers) ? beersOutcome.value.beers : []);
      } else {
        setBeers([]);
        setBeersError("Sortiment nicht ladbar.");
      }

      if (charactersOutcome.status === "fulfilled") {
        setCharacters(
          Array.isArray(charactersOutcome.value.characters)
            ? charactersOutcome.value.characters
            : [],
        );
      } else {
        setCharacters([]);
        setCharactersError("Charaktere nicht ladbar.");
      }

      setBeersLoading(false);
      setCharactersLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedThumb = selectedBeer?.etikettUrl?.trim() || "";
  const selectedCharacterThumb = selectedCharacter?.referenceImageUrls?.[0]?.trim() || "";
  const characterRefCount =
    selectedCharacter?.referenceImageUrls?.filter((url) => url?.trim()).length ?? 0;
  const usesProductPhoto = Boolean(selectedThumb);
  const generationTokenCost = estimateStudioImageTokenCost({
    usesProductPhoto,
    extraReferenceCount: characterRefCount,
    etikettModus: usesProductPhoto ? "marke" : "generisch",
    variantCount: 1,
    requestedQuality: "medium",
  });

  const canGenerate = Boolean(message.trim()) && !genBusy;

  const handleGenerate = useCallback(async () => {
    const prompt = message.trim();
    if (!prompt || genBusy) return;

    if (selectedCharacter && !selectedThumb) {
      setGenError("Charakter braucht eine Sorte mit Flaschenfoto.");
      return;
    }

    setGenError(null);
    setGenBusy(true);

    const preset = activePreset?.preset;
    const szeneRaw = preset?.szene ?? "biergarten_sommer";
    const szene = VALID_SZENEN.has(szeneRaw) ? szeneRaw : "biergarten_sommer";

    const intentParts = [prompt, preset?.promptNote].filter(Boolean);
    const payload = {
      etikettBild: selectedThumb || PLACEHOLDER_ETIKETT,
      flaschenTyp: selectedBeer?.flaschenTyp || "nrw_500",
      flaschenfarbe: selectedBeer?.flaschenfarbe || "braun",
      bierstil: selectedBeer?.bierstil || "helles",
      szene,
      tageszeit: preset?.tageszeit ?? "goldene_stunde",
      stimmungTrend: preset?.stimmungTrend,
      personenModus: preset?.personenModus,
      gruppenAnzahl: preset?.gruppenAnzahl,
      gruppenTyp: preset?.gruppenTyp,
      gruppenDynamik: preset?.gruppenDynamik,
      shotType: preset?.shotType,
      behaelter: preset?.behaelter,
      aspectRatio,
      etikettModus: usesProductPhoto ? ("marke" as const) : ("generisch" as const),
      stiltreue: usesProductPhoto ? ("hoch" as const) : ("frei" as const),
      keepLabel: usesProductPhoto,
      hyperreal: true,
      beerName: selectedBeer?.name?.trim() || undefined,
      zusatzWunsch: intentParts.join(". ").slice(0, 800),
      characterName: selectedCharacter?.name?.trim() || undefined,
      characterRole: selectedCharacter?.role?.trim() || undefined,
      characterReferenceImages: selectedCharacter
        ? selectedCharacter.referenceImageUrls.filter((url) => url?.trim()).slice(0, 3)
        : undefined,
      quality: "medium" as const,
      variantCount: 1,
    };

    try {
      const outcome = await startStudioGeneration({
        url: "/api/inhalte-erstellen/create-task",
        payload,
      });
      if (outcome.action !== "open_media") {
        throw new Error(outcome.error);
      }

      // Sofort in die Mediathek — Reveal/Polling läuft dort.
      router.push(mediaLibraryHref(outcome.jobId));
    } catch (err) {
      setGenBusy(false);
      setGenError(err instanceof Error ? err.message : "Generierung fehlgeschlagen.");
    }
  }, [
    activePreset,
    aspectRatio,
    genBusy,
    message,
    router,
    selectedBeer,
    selectedCharacter,
    selectedThumb,
    usesProductPhoto,
  ]);

  return (
    <div className="relative isolate flex h-full min-h-0 w-full flex-1 flex-col items-center bg-background dark:bg-black">
      {/* Preload decode — same asset as CSS bg so the moon is ready with first paint */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={MOON_BG_SRC}
        alt=""
        aria-hidden
        fetchPriority="high"
        decoding="sync"
        className="pointer-events-none absolute -z-10 h-px w-px opacity-0"
      />
      {/* Dark moon — BrewAI Accent #C7691E / Logo-Braun */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 hidden overflow-hidden dark:block"
      >
        <div
          className="absolute left-1/2 top-[55%] h-[140%] w-[145%] -translate-x-1/2 -translate-y-1/2 bg-cover bg-center bg-no-repeat"
          style={{
            backgroundImage: MOON_BG,
            filter: "hue-rotate(145deg) saturate(1.15)",
            opacity: 0.85,
          }}
        />
      </div>
      {/* Light moon — Blend isoliert im Chat, nicht über die Shell */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 overflow-hidden dark:hidden"
      >
        <div
          className="absolute left-1/2 top-[55%] h-[140%] w-[145%] -translate-x-1/2 -translate-y-1/2 bg-cover bg-center bg-no-repeat"
          style={{
            backgroundImage: MOON_BG,
            filter: "invert(1) hue-rotate(318deg) saturate(1.2) contrast(1.02)",
            mixBlendMode: "multiply",
            opacity: 0.78,
            WebkitMaskImage:
              "linear-gradient(to right, transparent 0%, #000 8%, #000 92%, transparent 100%)",
            maskImage:
              "linear-gradient(to right, transparent 0%, #000 8%, #000 92%, transparent 100%)",
          }}
        />
      </div>

      <div className="relative z-10 flex h-full min-h-0 w-full flex-1 flex-col items-center">
        <div className="flex min-h-0 w-full flex-1 flex-col items-center justify-center px-4">
          <div className="text-center">
            <h1 className="sr-only">BrewAI</h1>
            <MagneticText
              text="BrewAI"
              hoverText="BrewAI"
              textClassName="text-4xl font-semibold tracking-normal drop-shadow-sm"
            />
            <p className="mt-2 text-neutral-600 dark:text-neutral-200">
              Ideen brauen. Bilder zapfen.
            </p>
          </div>
        </div>

        <div className="mb-[10vh] flex w-full max-w-3xl shrink-0 flex-col gap-3 px-4">
          {genError ? (
            <p className="text-center text-sm text-destructive" role="alert">
              {genError}
            </p>
          ) : null}
          {genBusy ? (
            <p className="text-center text-sm text-muted-foreground" aria-live="polite">
              Weiter zur Mediathek …
            </p>
          ) : null}

          <div
            className={cn(
              "brew-composer",
              genBusy && "is-busy",
            )}
          >
            <div className="brew-composer__glow" aria-hidden />
            <div className="brew-composer__ring" aria-hidden />
            <div
              className={cn(
                "brew-composer__surface rounded-2xl border",
                "border-border bg-background shadow-sm",
                "dark:border-sidebar-border dark:bg-sidebar",
              )}
            >
            <Textarea
              ref={textareaRef}
              value={message}
              onChange={(e) => {
                setMessage(e.target.value);
                setActivePresetId(null);
                adjustHeight();
              }}
              placeholder="Beschreibe dein Bild…"
              className={cn(
                "min-h-[48px] w-full resize-none border-none bg-transparent px-4 py-3 text-sm shadow-none",
                "text-foreground placeholder:text-muted-foreground",
                "dark:bg-transparent dark:text-white dark:placeholder:text-neutral-400",
                "focus-visible:border-transparent focus-visible:ring-0 focus-visible:ring-offset-0",
              )}
              style={{ overflow: "hidden" }}
            />

            <div className="flex items-center justify-between gap-2 p-3">
              <div className="flex min-w-0 items-center gap-1">
              <Popover open={beerPickerOpen} onOpenChange={setBeerPickerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    aria-label="Sorte wählen"
                    className={cn(
                      "h-9 gap-2 bg-transparent px-2 text-foreground hover:bg-transparent",
                      "dark:bg-transparent dark:text-white dark:hover:bg-transparent",
                      selectedBeer && "font-medium",
                    )}
                  >
                    {selectedThumb ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={selectedThumb}
                        alt=""
                        className="h-5 w-5 rounded-full object-cover"
                      />
                    ) : (
                      <StudioIcon name="cup" size={16} />
                    )}
                    {selectedBeer ? (
                      <span className="max-w-[9rem] truncate text-xs font-medium">
                        {selectedBeer.name}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground dark:text-neutral-400">
                        Sorte
                      </span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  align="start"
                  side="top"
                  className="w-80 gap-0 p-1.5"
                >
                  <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                    Sortiment wählen
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    {beersLoading ? (
                      <p className="px-2 py-3 text-xs text-muted-foreground">
                        Sortiment wird geladen…
                      </p>
                    ) : beersError ? (
                      <p className="px-2 py-3 text-xs text-destructive">{beersError}</p>
                    ) : beers.length === 0 ? (
                      <p className="px-2 py-3 text-xs text-muted-foreground">
                        Noch keine Sorten angelegt. Lege sie unter Markenprofil /
                        Meine Biere an.
                      </p>
                    ) : (
                      <div className="flex flex-col gap-0.5">
                        <button
                          type="button"
                          className={cn(
                            "flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left transition-colors",
                            "hover:bg-muted",
                            !selectedBeer && "bg-muted",
                          )}
                          onClick={() => {
                            setSelectedBeer(null);
                            setBeerPickerOpen(false);
                          }}
                        >
                          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-muted-foreground">
                            <StudioIcon name="cup" size={14} />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium">
                              Keine Sorte
                            </span>
                            <span className="block truncate text-xs text-muted-foreground">
                              Allgemein / ohne Produktbezug
                            </span>
                          </span>
                          {!selectedBeer ? (
                            <StudioIcon name="check" size={14} />
                          ) : null}
                        </button>

                        {beers.map((beer) => {
                          const active = selectedBeer?.id === beer.id;
                          const thumb = beer.etikettUrl?.trim() || "";
                          return (
                            <button
                              key={beer.id}
                              type="button"
                              className={cn(
                                "flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left transition-colors",
                                "hover:bg-muted",
                                active && "bg-muted",
                              )}
                              onClick={() => {
                                setSelectedBeer(beer);
                                setBeerPickerOpen(false);
                              }}
                            >
                              <span className="relative h-8 w-8 shrink-0 overflow-hidden rounded-full bg-muted">
                                {thumb ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={thumb}
                                    alt=""
                                    className="h-full w-full object-cover"
                                  />
                                ) : (
                                  <span className="flex h-full w-full items-center justify-center text-[10px] font-semibold text-muted-foreground">
                                    {beerInitials(beer.name)}
                                  </span>
                                )}
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-sm font-medium">
                                  {beer.name}
                                </span>
                                <span className="block truncate text-xs text-muted-foreground">
                                  {beerMeta(beer)}
                                </span>
                              </span>
                              {active ? <StudioIcon name="check" size={14} /> : null}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </PopoverContent>
              </Popover>

              <Popover open={characterPickerOpen} onOpenChange={setCharacterPickerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    aria-label="Charakter wählen"
                    className={cn(
                      "h-9 gap-2 bg-transparent px-2 text-foreground hover:bg-transparent",
                      "dark:bg-transparent dark:text-white dark:hover:bg-transparent",
                      selectedCharacter && "font-medium",
                    )}
                  >
                    {selectedCharacterThumb ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={selectedCharacterThumb}
                        alt=""
                        className="h-5 w-5 rounded-full object-cover"
                      />
                    ) : (
                      <StudioIcon name="user" size={16} />
                    )}
                    {selectedCharacter ? (
                      <span className="max-w-[9rem] truncate text-xs font-medium">
                        {selectedCharacter.name}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground dark:text-neutral-400">
                        Charakter
                      </span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  align="start"
                  side="top"
                  className="w-80 gap-0 p-1.5"
                >
                  <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                    Charakter wählen
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    {charactersLoading ? (
                      <p className="px-2 py-3 text-xs text-muted-foreground">
                        Charaktere werden geladen…
                      </p>
                    ) : charactersError ? (
                      <p className="px-2 py-3 text-xs text-destructive">{charactersError}</p>
                    ) : characters.length === 0 ? (
                      <p className="px-2 py-3 text-xs text-muted-foreground">
                        Noch keine Charaktere angelegt. Lege sie unter Markenprofil an.
                      </p>
                    ) : (
                      <div className="flex flex-col gap-0.5">
                        <button
                          type="button"
                          className={cn(
                            "flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left transition-colors",
                            "hover:bg-muted",
                            !selectedCharacter && "bg-muted",
                          )}
                          onClick={() => selectCharacter(null)}
                        >
                          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-muted-foreground">
                            <StudioIcon name="user" size={14} />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium">
                              Kein Charakter
                            </span>
                            <span className="block truncate text-xs text-muted-foreground">
                              Ohne Personenbezug
                            </span>
                          </span>
                          {!selectedCharacter ? (
                            <StudioIcon name="check" size={14} />
                          ) : null}
                        </button>

                        {characters.map((character) => {
                          const active = selectedCharacter?.id === character.id;
                          const thumb = character.referenceImageUrls?.[0]?.trim() || "";
                          return (
                            <button
                              key={character.id}
                              type="button"
                              className={cn(
                                "flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left transition-colors",
                                "hover:bg-muted",
                                active && "bg-muted",
                              )}
                              onClick={() => selectCharacter(character)}
                            >
                              <span className="relative h-8 w-8 shrink-0 overflow-hidden rounded-full bg-muted">
                                {thumb ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={thumb}
                                    alt=""
                                    className="h-full w-full object-cover"
                                  />
                                ) : (
                                  <span className="flex h-full w-full items-center justify-center text-[10px] font-semibold text-muted-foreground">
                                    {beerInitials(character.name)}
                                  </span>
                                )}
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-sm font-medium">
                                  {character.name}
                                </span>
                                <span className="block truncate text-xs text-muted-foreground">
                                  {character.role?.trim() || "Charakter"}
                                </span>
                              </span>
                              {active ? <StudioIcon name="check" size={14} /> : null}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </PopoverContent>
              </Popover>

              <Popover open={formatPickerOpen} onOpenChange={setFormatPickerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    aria-label="Format wählen"
                    className={cn(
                      "h-9 gap-2 bg-transparent px-2 text-foreground hover:bg-transparent",
                      "dark:bg-transparent dark:text-white dark:hover:bg-transparent",
                      "font-medium",
                    )}
                  >
                    <StudioIcon name="image" size={16} />
                    <span className="text-xs font-medium">{aspectRatio}</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  align="start"
                  className="w-56 p-2"
                  onOpenAutoFocus={(event) => event.preventDefault()}
                >
                  <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                    Bildformat
                  </div>
                  {selectedCharacter ? (
                    <p className="mb-1 px-2 text-[11px] text-muted-foreground">
                      Mit Charakter nur Hochformat (4:5, 3:4, 9:16).
                    </p>
                  ) : null}
                  <div className="flex flex-col gap-0.5">
                    {ASPECT_OPTIONS.map(({ value, hint }) => {
                      const allowed =
                        !selectedCharacter ||
                        (CHARACTER_ASPECTS as readonly string[]).includes(value);
                      const active = aspectRatio === value;
                      return (
                        <button
                          key={value}
                          type="button"
                          disabled={!allowed}
                          onClick={() => selectAspect(value)}
                          className={cn(
                            "flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40",
                            active && "bg-muted",
                          )}
                        >
                          <span className="w-12 font-medium tabular-nums">{value}</span>
                          <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                            {hint}
                          </span>
                          {active ? <StudioIcon name="check" size={14} /> : null}
                        </button>
                      );
                    })}
                  </div>
                </PopoverContent>
              </Popover>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  disabled={!canGenerate}
                  onClick={() => void handleGenerate()}
                  className={cn(
                    "flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-medium transition-colors",
                    "bg-[#C7691E] text-white hover:bg-[#D4782A]",
                    "disabled:cursor-not-allowed disabled:opacity-60 disabled:bg-[#C7691E] disabled:text-white",
                  )}
                >
                  {genBusy ? "Weiter …" : "Generieren"}
                  <span className="font-normal opacity-90">
                    · {generationTokenCost.toLocaleString("de-DE")} Tokens
                  </span>
                </Button>
              </div>
            </div>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            {quickPresets.map((template) => (
              <QuickAction
                key={template.id}
                icon={<StudioIcon name={template.icon} size={14} />}
                label={template.title}
                active={activePresetId === template.id}
                onClick={() => applyPreset(template)}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

interface QuickActionProps {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  onClick?: () => void;
}

function QuickAction({ icon, label, active, onClick }: QuickActionProps) {
  return (
    <Button
      type="button"
      variant="outline"
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 rounded-full",
        "border-border bg-background/80 text-foreground hover:bg-muted",
        "dark:border-neutral-700 dark:bg-black/50 dark:text-neutral-300 dark:hover:bg-neutral-700 dark:hover:text-white",
        active &&
          "border-[#C7691E]/50 bg-[#C7691E]/10 text-[#A85518] hover:bg-[#C7691E]/15 dark:border-[#C7691E]/40 dark:bg-[#C7691E]/15 dark:text-[#D4782A]",
      )}
    >
      {icon}
      <span className="text-xs">{label}</span>
    </Button>
  );
}
