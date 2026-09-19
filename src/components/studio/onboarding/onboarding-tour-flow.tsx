"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, ArrowRight, Check, CheckCheck, CircleAlert, Globe2, Loader2, Package, Palette, PencilLine, RotateCcw, Trash2 } from "lucide-react";
import { EvglabMark } from "@/components/studio/evglab-mark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { TaskSteps, type TaskStep } from "@/components/ui/task-steps";
import { cn } from "@/lib/utils";
import type { DashboardBeer, ProduktKategorie } from "@/lib/dashboard/metadata";
import { GETRANKEART_OPTIONS, produktKategorieLabel, sanitizeProduktKategorie } from "@/lib/dashboard/metadata";
import { BRAND_SETTINGS_LIMITS, clampBrandSettingsFields } from "@/lib/dashboard/settingsPayload";
import { ONBOARDING_TOUR_VERSION } from "@/lib/dashboard/onboarding";
import { brandLooksReady, emptyBrandDraft, parseBrandColors, patchOnboarding, type OnboardingBootstrap, type OnboardingBrandDraft } from "./onboarding-tour-types";

type SortimentRowBeer = {
  id: string;
  name: string;
  etikettUrl?: string | null;
  produktKategorie?: string | null;
  bierstil?: string | null;
};

function SortimentBeerRow({
  beer,
  canEditCategory,
  reduceMotion,
  onCategoryChange,
  onRemove,
}: {
  beer: SortimentRowBeer;
  canEditCategory: boolean;
  reduceMotion: boolean | null;
  onCategoryChange: (produktKategorie: ProduktKategorie) => void;
  onRemove: () => void;
}) {
  const bottleRef = useRef<HTMLDivElement>(null);
  const trashRef = useRef<HTMLButtonElement>(null);
  const [toss, setToss] = useState<{ x: number; y: number } | null>(null);
  const [catching, setCatching] = useState(false);

  function handleRemove() {
    if (toss) return;
    if (reduceMotion) {
      onRemove();
      return;
    }
    const bottle = bottleRef.current?.getBoundingClientRect();
    const trash = trashRef.current?.getBoundingClientRect();
    if (!bottle || !trash) {
      onRemove();
      return;
    }
    const x = trash.left + trash.width / 2 - (bottle.left + bottle.width / 2);
    const y = trash.top + trash.height / 2 - (bottle.top + bottle.height / 2);
    setToss({ x, y });
    window.setTimeout(() => setCatching(true), 220);
    window.setTimeout(() => onRemove(), 480);
  }

  return (
    <motion.li
      layout={!reduceMotion}
      initial={false}
      exit={
        reduceMotion
          ? { opacity: 0 }
          : { opacity: 0, height: 0, marginBottom: 0, paddingTop: 0, paddingBottom: 0, transition: { duration: 0.2 } }
      }
      className={cn(
        "flex items-center gap-3 rounded-lg bg-muted/40 p-3",
        toss ? "overflow-visible" : "overflow-hidden",
      )}
    >
      <div className="relative size-12 shrink-0">
        <motion.div
          ref={bottleRef}
          className="absolute inset-0 flex items-center justify-center overflow-hidden rounded-md bg-background"
          animate={
            toss
              ? { x: toss.x, y: toss.y, scale: 0.2, rotate: 48, opacity: 0 }
              : { x: 0, y: 0, scale: 1, rotate: 0, opacity: 1 }
          }
          transition={
            toss
              ? { duration: 0.45, ease: [0.4, 0.0, 0.2, 1] }
              : { duration: 0 }
          }
          style={{ zIndex: toss ? 20 : 1 }}
        >
          {beer.etikettUrl ? (
            <Image src={beer.etikettUrl} alt="" fill className="object-contain p-1" sizes="48px" unoptimized />
          ) : (
            <Package className="size-5 text-muted-foreground" aria-hidden="true" />
          )}
        </motion.div>
      </div>
      <div className={cn("min-w-0 flex-1 transition-opacity", toss && "opacity-40")}>
        <p className="break-words text-sm font-medium">{beer.name}</p>
        {canEditCategory ? (
          <select
            aria-label={`Getränkeart für ${beer.name}`}
            className="mt-1 min-h-9 w-full max-w-52 rounded-md border border-input bg-background px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            value={sanitizeProduktKategorie(beer.produktKategorie)}
            disabled={Boolean(toss)}
            onChange={(event) => onCategoryChange(sanitizeProduktKategorie(event.target.value))}
          >
            {GETRANKEART_OPTIONS.map((option) => (
              <option key={option.id} value={option.id}>{option.label}</option>
            ))}
          </select>
        ) : (
          <p className="mt-1 text-xs text-muted-foreground">{produktKategorieLabel(sanitizeProduktKategorie(beer.produktKategorie))}</p>
        )}
      </div>
      <motion.div
        animate={catching ? { scale: [1, 1.28, 0.92, 1.08, 1], rotate: [0, -8, 6, 0] } : { scale: 1, rotate: 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
      >
        <Button
          ref={trashRef}
          type="button"
          variant="ghost"
          size="icon"
          className={cn(
            "size-9 shrink-0 text-muted-foreground hover:text-destructive",
            catching && "text-destructive",
          )}
          aria-label={`${beer.name} entfernen`}
          disabled={Boolean(toss)}
          onClick={handleRemove}
        >
          <Trash2 className="size-4" aria-hidden="true" />
        </Button>
      </motion.div>
    </motion.li>
  );
}
const STEPS = [
  { title: "Deine Brauerei", description: "Website verbinden", icon: Globe2 },
  { title: "Deine Marke", description: "Profil prüfen", icon: Palette },
  { title: "Dein Studio", description: "Fertig einrichten", icon: CheckCheck },
];

/** Gleicher Ablauf wie Markenprofil „Neu einlesen“. */
const ANALYSIS_STEPS = [
  "Website wird geladen…",
  "Unterseiten werden gelesen…",
  "Sortiment wird erkannt…",
  "Texte & Tonalität werden erkannt…",
  "Typografie wird übernommen…",
  "Bilder werden ausgewertet…",
  "Markenprofil wird erstellt…",
] as const;

const ANALYSIS_HINTS = [
  "Wir öffnen deine Startseite und folgen öffentlichen Links.",
  "Menü, Shop und Über-uns liefern die besten Markensignale.",
  "Produkte und Etiketten helfen später bei Motiven und Kampagnen.",
  "Tonfall und Wortwahl fließen in deine Studio-Prompts ein.",
  "Schriftarten machen Headlines markenkonform.",
  "Referenzbilder zeigen, welche Bildsprache zu dir passt.",
  "Gleich kannst du alles prüfen und anpassen.",
] as const;

const ANALYSIS_STEP_DURATIONS_MS = [2400, 4200, 6200, 8200, 10500, 12500];

function normalizeWebsite(value: string) {
  const raw = value.trim();
  try {
    const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    if (!raw || !["http:", "https:"].includes(url.protocol) || !url.hostname.includes(".") || url.username || url.password) throw new Error();
    return url.toString();
  } catch {
    throw new Error("Bitte eine gültige Website eingeben, zum Beispiel deine-brauerei.de.");
  }
}

function hostnameLabel(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export function OnboardingTourFlow({ bootstrap }: { bootstrap: OnboardingBootstrap }) {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const actionLock = useRef(false);
  const activated = useRef(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [breweryName, setBreweryName] = useState(bootstrap.settings?.breweryName?.trim() || "");
  const [websiteUrl, setWebsiteUrl] = useState(bootstrap.settings?.brandWebsiteUrl?.trim() || "");
  const [brand, setBrand] = useState<OnboardingBrandDraft>(() => emptyBrandDraft(bootstrap.settings));
  const [beers, setBeers] = useState<DashboardBeer[]>(bootstrap.beers);
  const [scanning, setScanning] = useState(false);
  const [analysisStepIndex, setAnalysisStepIndex] = useState(0);
  const [activating, setActivating] = useState(false);
  const [error, setError] = useState("");
  const [tokens, setTokens] = useState<number | null>(bootstrap.tokensRemaining);
  const [sortimentUndo, setSortimentUndo] = useState<null | {
    source: "suggested" | "beers";
    index: number;
    name: string;
    suggestedItem?: NonNullable<OnboardingBrandDraft["suggestedBeers"]>[number];
    beerItem?: DashboardBeer;
  }>(null);
  const undoTimerRef = useRef<number | null>(null);
  const analyzedInput = useRef({ name: breweryName, url: websiteUrl });
  const [lastAnalyzedUrl, setLastAnalyzedUrl] = useState(websiteUrl);
  const brandReady = brandLooksReady(brand);

  const taskSteps: TaskStep[] = useMemo(
    () => ANALYSIS_STEPS.map((label, i) => ({ id: `scan-${i}`, label })),
    [],
  );

  const clearUndoTimer = useCallback(() => {
    if (undoTimerRef.current !== null) {
      window.clearTimeout(undoTimerRef.current);
      undoTimerRef.current = null;
    }
  }, []);

  const armSortimentUndo = useCallback(
    (next: NonNullable<typeof sortimentUndo>) => {
      clearUndoTimer();
      setSortimentUndo(next);
      undoTimerRef.current = window.setTimeout(() => setSortimentUndo(null), 8000);
    },
    [clearUndoTimer],
  );

  const undoSortimentRemove = useCallback(() => {
    if (!sortimentUndo) return;
    clearUndoTimer();
    activated.current = false;
    if (sortimentUndo.source === "suggested" && sortimentUndo.suggestedItem) {
      const { index, suggestedItem } = sortimentUndo;
      setBrand((current) => {
        const list = [...(current.suggestedBeers ?? [])];
        list.splice(Math.min(index, list.length), 0, suggestedItem);
        return { ...current, suggestedBeers: list };
      });
    } else if (sortimentUndo.source === "beers" && sortimentUndo.beerItem) {
      const { index, beerItem } = sortimentUndo;
      setBeers((current) => {
        const list = [...current];
        list.splice(Math.min(index, list.length), 0, beerItem);
        return list;
      });
    }
    setSortimentUndo(null);
  }, [clearUndoTimer, sortimentUndo]);

  useEffect(() => {
    void patchOnboarding({ flowVersion: 2 }).catch(() => {});
  }, []);

  useEffect(() => () => clearUndoTimer(), [clearUndoTimer]);

  useEffect(() => {
    if (!scanning) return;
    setAnalysisStepIndex(0);
    let cancelled = false;
    let timer: number | undefined;
    let index = 0;
    const schedule = () => {
      if (cancelled || index >= ANALYSIS_STEPS.length - 1) return;
      const delay = ANALYSIS_STEP_DURATIONS_MS[Math.min(index, ANALYSIS_STEP_DURATIONS_MS.length - 1)] ?? 5000;
      timer = window.setTimeout(() => {
        index += 1;
        setAnalysisStepIndex(index);
        schedule();
      }, delay);
    };
    schedule();
    return () => {
      cancelled = true;
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [scanning]);

  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);

  function goToStep(next: number) {
    setError("");
    if (next !== 1) {
      clearUndoTimer();
      setSortimentUndo(null);
    }
    setStep(next);
  }

  const saveBrewerySettings = useCallback(async () => {
    const name = breweryName.trim();
    if (!name) throw new Error("Bitte einen Brauereinamen eingeben.");
    const res = await fetch("/api/dashboard/settings", {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        breweryName: name.slice(0, 120),
        brandWebsiteUrl: websiteUrl.trim() ? normalizeWebsite(websiteUrl) : "",
      }),
    });
    if (!res.ok) {
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(json.error || "Speichern fehlgeschlagen.");
    }
  }, [breweryName, websiteUrl]);

  const analyzeBrand = useCallback(async () => {
    const url = normalizeWebsite(websiteUrl);
    if (!url) throw new Error("Bitte eine Website-URL eingeben.");
    if (!breweryName.trim()) throw new Error("Bitte zuerst den Brauereinamen eingeben.");

    setScanning(true);
    setAnalysisStepIndex(0);
    setError("");

    try {
      await saveBrewerySettings();
      const res = await fetch("/api/brand/analyze-url", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ websiteUrl: url }),
        cache: "no-store",
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        suggestion?: Partial<OnboardingBrandDraft>;
      };
      if (!res.ok || !data.suggestion) {
        throw new Error(data.error || "Analyse fehlgeschlagen.");
      }
      const s = data.suggestion;
      const next: OnboardingBrandDraft = {
        breweryName: (s.breweryName || breweryName || "").trim().slice(0, BRAND_SETTINGS_LIMITS.breweryName),
        brandTone: (s.brandTone || "").trim().slice(0, BRAND_SETTINGS_LIMITS.brandTone),
        brandColors: (s.brandColors || "").trim().slice(0, BRAND_SETTINGS_LIMITS.brandColors),
        brandDos: (s.brandDos || "").trim().slice(0, BRAND_SETTINGS_LIMITS.brandDos),
        brandDonts: (s.brandDonts || "").trim().slice(0, BRAND_SETTINGS_LIMITS.brandDonts),
        brandWebsiteUrl: (s.brandWebsiteUrl || url).trim(),
        brandInstagramUrl: (s.brandInstagramUrl || "").trim(),
        brandProfileSource: "url",
        brandLabelReferenceUrl: (s.brandLabelReferenceUrl || "").trim(),
        brandHeadlineFontName: (s.brandHeadlineFontName || "").trim().slice(0, BRAND_SETTINGS_LIMITS.brandHeadlineFontName),
        brandFontFileUrl: (s.brandFontFileUrl || "").trim().slice(0, 1200),
        referenceImageUrls: Array.isArray(s.referenceImageUrls) ? s.referenceImageUrls.filter(Boolean).slice(0, 10) : [],
        referenceImagePayloads: s.referenceImagePayloads,
        suggestedBeers: Array.isArray(s.suggestedBeers) ? s.suggestedBeers : undefined,
      };
      if (!brandLooksReady(next)) {
        throw new Error("Analyse lieferte kein vollständiges Markenprofil.");
      }
      setBrand(next);
      activated.current = false;
      analyzedInput.current = { name: next.breweryName || breweryName.trim(), url };
      setLastAnalyzedUrl(url);
      setWebsiteUrl(url);
      if (next.breweryName) setBreweryName(next.breweryName);
      return next;
    } finally {
      setScanning(false);
    }
  }, [breweryName, saveBrewerySettings, websiteUrl]);

  const activateProfile = useCallback(async () => {
    if (!brandLooksReady(brand)) throw new Error("Markenprofil ist noch nicht bereit.");
    setActivating(true);
    setError("");
    try {
      const clamped = clampBrandSettingsFields({
        breweryName: brand.breweryName || breweryName,
        brandTone: brand.brandTone,
        brandColors: brand.brandColors,
        brandDos: brand.brandDos,
        brandDonts: brand.brandDonts,
        brandHeadlineFontName: brand.brandHeadlineFontName ?? "",
      });
      const body: Record<string, unknown> = {
        breweryName: clamped.breweryName,
        brandTone: clamped.brandTone,
        brandColors: clamped.brandColors,
        brandDos: clamped.brandDos,
        brandDonts: clamped.brandDonts,
        brandWebsiteUrl: brand.brandWebsiteUrl || websiteUrl,
        brandInstagramUrl: brand.brandInstagramUrl,
        brandProfileSource: brand.brandProfileSource || "url",
        brandReferenceImageUrls: brand.referenceImageUrls,
        brandLabelReferenceUrl: brand.brandLabelReferenceUrl,
        brandHeadlineFontName: clamped.brandHeadlineFontName ?? brand.brandHeadlineFontName ?? "",
        brandFontFileUrl: brand.brandFontFileUrl ?? "",
      };
      if (brand.referenceImagePayloads?.length) {
        body.referenceImagePayloads = brand.referenceImagePayloads;
      }
      if (brand.suggestedBeers?.length) {
        body.suggestedBeers = brand.suggestedBeers;
      }
      const res = await fetch("/api/brand/activate-profile", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        cache: "no-store",
      });
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        myBeers?: DashboardBeer[];
      };
      if (!res.ok) {
        if (res.status === 504 || res.status === 524) {
          throw new Error("Speichern hat zu lange gedauert. Bitte erneut „Studio öffnen“ tippen.");
        }
        throw new Error(json.error || "Markenprofil konnte nicht gespeichert werden.");
      }
      activated.current = true;
      if (Array.isArray(json.myBeers) && json.myBeers.length) {
        setBeers(json.myBeers);
      } else {
        const reload = await fetch("/api/dashboard/my-beers", { cache: "no-store", credentials: "include" });
        if (reload.ok) {
          const data = (await reload.json()) as { beers?: DashboardBeer[] };
          if (data.beers?.length) setBeers(data.beers);
        }
      }
    } finally {
      setActivating(false);
    }
  }, [brand, breweryName, websiteUrl]);

  async function finish() {
    if (!activated.current) await activateProfile();
    const bonusRes = await fetch("/api/billing/onboarding-bonus", { method: "POST", credentials: "include" });
    if (!bonusRes.ok) {
      const payload = (await bonusRes.json().catch(() => null)) as { error?: string } | null;
      throw new Error(
        payload?.error ||
          "Dein Profil ist gespeichert. Der Willkommensbonus konnte noch nicht gutgeschrieben werden. Bitte versuche es erneut.",
      );
    }
    const data = (await bonusRes.json()) as { state?: { remainingTokens?: number } };
    if (typeof data.state?.remainingTokens === "number") setTokens(data.state.remainingTokens);
    await patchOnboarding({
      flowVersion: 2, completedAt: new Date().toISOString(), tourVersion: ONBOARDING_TOUR_VERSION,
      welcome: true, checklistDismissed: false, celebrated: false,
    });
    router.push(bootstrap.hasActivePlan ? "/inhalte-erstellen" : "/dashboard");
    router.refresh();
  }

  async function runAction(action: "next" | "skip") {
    if (actionLock.current) return;
    actionLock.current = true;
    setBusy(true);
    setError("");
    let navigating = false;
    try {
      if (action === "skip") {
        await patchOnboarding({
          flowVersion: 2, completedAt: new Date().toISOString(), tourVersion: ONBOARDING_TOUR_VERSION,
          welcome: true, checklistDismissed: true, celebrated: true,
        });
        navigating = true;
        router.push("/dashboard");
        router.refresh();
      } else if (step === 0) {
        if (!breweryName.trim()) throw new Error("Bitte gib den Namen deiner Brauerei ein.");
        const url = normalizeWebsite(websiteUrl);
        if (!brandReady || analyzedInput.current.name !== breweryName.trim() || analyzedInput.current.url !== url) {
          await analyzeBrand();
        }
        goToStep(1);
      } else if (step === 1) {
        if (!brandReady) throw new Error("Bitte fülle die Tonalität, Farben und Bildregeln aus, bevor du fortfährst.");
        goToStep(2);
      } else {
        await finish();
        navigating = true;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Das hat nicht geklappt. Bitte versuche es erneut.");
    } finally {
      if (!navigating) {
        actionLock.current = false;
        setBusy(false);
      }
    }
  }

  function updateBrand(patch: Partial<OnboardingBrandDraft>) {
    activated.current = false;
    setBrand((current) => ({ ...current, ...patch }));
  }

  const swatches = parseBrandColors(brand.brandColors);
  const previewBeers = brand.suggestedBeers !== undefined
    ? brand.suggestedBeers.map((beer, i) => ({ ...beer, id: `preview-${i}` }))
    : beers;
  const headings = [
    scanning ? "Wir lesen deine Marke ein." : "Verbinde deine Website.",
    "Prüfe dein Markenprofil.",
    "Bereit fürs Studio.",
  ];
  const descriptions = [
    scanning
      ? "Gleich siehst du, was wir gefunden haben — und kannst alles anpassen."
      : "Name und Website reichen. Wir bereiten Profil und Sortiment vor.",
    "Kurz prüfen, bei Bedarf anpassen — später jederzeit änderbar.",
    "Wir speichern Profil und Sortiment. Danach kannst du loslegen.",
  ];
  const primaryLabel = busy
    ? scanning ? "Wird analysiert …" : activating ? "Wird gespeichert …" : "Einen Moment …"
    : step === 0 ? "Website analysieren" : step === 1 ? "Weiter" : "Studio öffnen";
  const scanTarget = hostnameLabel(websiteUrl.trim() || lastAnalyzedUrl);

  return (
    <div className="brewai-admin min-h-dvh bg-background text-foreground">
      <a href="#onboarding-main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-background focus:p-3 focus:ring-2 focus:ring-ring">Zum Inhalt</a>
      <div className="mx-auto flex min-h-dvh max-w-6xl flex-col px-5 sm:px-8 lg:px-12">
        <header className="flex min-h-20 items-center justify-between gap-4 border-b border-border/70 py-4">
          <div className="flex items-center gap-2.5">
            <EvglabMark size={28} />
            <span className="text-lg font-semibold tracking-tight">BrewAI</span>
            <span className="ml-2 hidden border-l border-border pl-4 text-sm text-muted-foreground sm:inline">Studio einrichten</span>
          </div>
          <Button variant="ghost" className="h-11 px-3 text-muted-foreground" disabled={busy} onClick={() => void runAction("skip")}>
            Später <ArrowRight className="size-4" aria-hidden="true" />
          </Button>
        </header>

        <div className="grid flex-1 content-start gap-9 py-8 md:grid-cols-[200px_minmax(0,1fr)] md:gap-10 md:py-12 lg:gap-16">
          <aside className="min-w-0">
            <p className="mb-2 text-sm text-muted-foreground">Willkommen{bootstrap.profileName ? `, ${bootstrap.profileName.split(" ")[0]}` : ""}</p>
            <p className="max-w-56 text-xl font-semibold leading-tight tracking-tight">Dein Studio.<br className="hidden md:block" /> Deine Marke.</p>
            <nav aria-label="Einrichtungsschritte" className="mt-7 md:mt-9">
              <ol className="grid grid-cols-3 gap-2 md:grid-cols-1 md:gap-2">
                {STEPS.map((item, index) => {
                  const Icon = item.icon;
                  const complete = index < step;
                  return (
                    <li key={item.title}>
                      <button
                        type="button"
                        disabled={busy || index >= step}
                        onClick={() => goToStep(index)}
                        aria-current={step === index ? "step" : undefined}
                        className={cn("flex w-full items-center gap-3 rounded-lg py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default md:p-2", step === index ? "text-foreground" : "text-muted-foreground", complete && "hover:bg-muted")}
                      >
                        <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg border transition-colors duration-300", step === index ? "border-primary bg-primary text-primary-foreground" : complete ? "border-border bg-muted text-foreground" : "border-border bg-background")}>
                          {complete ? <Check className="size-4" aria-hidden="true" /> : <Icon className="size-4" aria-hidden="true" />}
                        </span>
                        <span className="min-w-0">
                          <span className="block text-xs font-medium sm:text-sm">{item.title}</span>
                          <span className="mt-0.5 hidden text-xs text-muted-foreground md:block">{item.description}</span>
                          {complete ? <span className="sr-only">Abgeschlossen</span> : null}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ol>
            </nav>
            {typeof tokens === "number" ? (
              <p className="mt-8 hidden text-xs text-muted-foreground md:block">
                <span className="font-medium tabular-nums text-foreground">{tokens.toLocaleString("de-DE")}</span> Tokens
              </p>
            ) : null}
          </aside>

          <main id="onboarding-main" className="min-w-0" aria-label="Studio einrichten">
            <div className="mb-5 flex items-center gap-3" aria-label={`Schritt ${step + 1} von 3`}>
              <span className="shrink-0 text-xs font-medium tabular-nums text-muted-foreground">0{step + 1} / 03</span>
              <div className="flex flex-1 gap-1.5" aria-hidden="true">
                {STEPS.map((item, index) => <span key={item.title} className={cn("h-1 flex-1 rounded-full transition-colors duration-300 motion-reduce:transition-none", index <= step ? "bg-primary" : "bg-muted")} />)}
              </div>
            </div>
            <AnimatePresence mode="wait" initial={false}>
              <motion.section
                key={scanning ? "scanning" : step}
                initial={{ opacity: 0, y: reduceMotion ? 0 : 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: reduceMotion ? 0 : -6 }}
                transition={{ duration: reduceMotion ? 0 : 0.2, ease: "easeOut" }}
                onAnimationComplete={() => {
                  if (step > 0 || document.activeElement?.tagName === "BODY") headingRef.current?.focus({ preventScroll: true });
                }}
                aria-labelledby="onboarding-heading"
              >
                <h1 id="onboarding-heading" ref={headingRef} tabIndex={-1} className="text-balance text-3xl font-semibold leading-tight tracking-tight outline-none sm:text-[2rem]">{headings[step]}</h1>
                <p className="mt-2 max-w-lg text-sm leading-6 text-muted-foreground">{descriptions[step]}</p>

                <form className="mt-6" onSubmit={(event) => { event.preventDefault(); void runAction("next"); }} aria-busy={busy}>
                  <fieldset disabled={busy && !scanning} className="min-w-0 space-y-5">
                    <legend className="sr-only">{STEPS[step].title}</legend>

                    {step === 0 && scanning ? (
                      <div
                        className="rounded-xl border border-border bg-card p-5 sm:p-6"
                        style={{
                          ["--t1" as string]: "var(--foreground)",
                          ["--t2" as string]: "var(--foreground)",
                          ["--t3" as string]: "var(--muted-foreground)",
                          ["--ok" as string]: "#2F7A4A",
                          ["--ok-dim" as string]: "rgba(47, 122, 74, 0.12)",
                          ["--err" as string]: "var(--destructive)",
                        }}
                      >
                        <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-border bg-muted/50 px-3 py-1.5 text-xs text-muted-foreground">
                          <Globe2 className="size-3.5" aria-hidden="true" />
                          <span>{scanTarget || "Website"}</span>
                        </div>
                        <TaskSteps steps={taskSteps} current={analysisStepIndex} label="Analyse-Fortschritt" />
                        <p className="mt-5 text-sm leading-6 text-muted-foreground" role="status" aria-live="polite">
                          {ANALYSIS_HINTS[Math.min(analysisStepIndex, ANALYSIS_HINTS.length - 1)]}
                        </p>
                        <p className="mt-3 text-xs text-muted-foreground">Dauert meist unter einer Minute — Fenster offen lassen.</p>
                      </div>
                    ) : null}

                    {step === 0 && !scanning ? (
                      <>
                        <div className="space-y-2">
                          <Label htmlFor="onboarding-brewery">Name deiner Brauerei</Label>
                          <Input id="onboarding-brewery" name="breweryName" required maxLength={BRAND_SETTINGS_LIMITS.breweryName} autoComplete="organization" placeholder="Wie heißt deine Brauerei?" value={breweryName} onChange={(event) => setBreweryName(event.target.value)} className="h-12 px-3.5" />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="onboarding-website">Website</Label>
                          <div className="relative">
                            <Globe2 className="pointer-events-none absolute left-3.5 top-4 size-4 text-muted-foreground" aria-hidden="true" />
                            <Input id="onboarding-website" name="website" required maxLength={2000} inputMode="url" autoComplete="url" autoCapitalize="none" spellCheck={false} placeholder="deine-brauerei.de" value={websiteUrl} onChange={(event) => setWebsiteUrl(event.target.value)} className="h-12 pl-10 pr-3.5" />
                          </div>
                          <p className="text-xs text-muted-foreground">Nur die öffentliche URL — keine Zugangsdaten nötig.</p>
                        </div>
                      </>
                    ) : null}

                    {step === 1 ? (
                      <>
                        <div className="rounded-xl border border-border bg-card p-5 sm:p-6">
                          <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0"><p className="text-xs text-muted-foreground">Erkanntes Markenprofil</p><h2 className="mt-1 break-words text-lg font-semibold tracking-tight">{brand.breweryName || breweryName}</h2></div>
                            <span className="flex shrink-0 items-center gap-1.5 rounded-md bg-muted px-2 py-1 text-xs"><Check className="size-3.5" aria-hidden="true" /> Bereit</span>
                          </div>
                          <p className="mt-4 whitespace-pre-line text-sm leading-6 text-muted-foreground">{brand.brandTone}</p>
                          {swatches.length ? <div className="mt-5 flex flex-wrap gap-3" aria-label="Erkannte Markenfarben">{swatches.map((color, index) => <div key={`${color}-${index}`} className="flex items-center gap-2 text-xs text-muted-foreground"><span className="size-7 rounded-md ring-1 ring-inset ring-foreground/10" style={{ backgroundColor: color }} /><span className="font-mono">{color.toUpperCase()}</span></div>)}</div> : null}
                          <details className="mt-5 border-t border-border pt-4">
                            <summary className="cursor-pointer rounded text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring">Texte anpassen</summary>
                            <div className="mt-4 space-y-4">
                              {([
                                ["brandTone", "Tonalität"], ["brandColors", "Markenfarben"], ["brandDos", "Das passt"], ["brandDonts", "Das vermeiden"],
                              ] as const).map(([key, label]) => <div key={key} className="space-y-2"><Label htmlFor={`onboarding-${key}`}>{label}</Label><Textarea id={`onboarding-${key}`} value={brand[key]} maxLength={BRAND_SETTINGS_LIMITS[key]} onChange={(event) => updateBrand({ [key]: event.target.value })} className="min-h-20 resize-y text-sm" /></div>)}
                            </div>
                          </details>
                        </div>
                        <section aria-labelledby="onboarding-products-title">
                          <div className="mb-3 flex items-center justify-between gap-3">
                            <h2 id="onboarding-products-title" className="text-sm font-medium">Sortiment</h2>
                            <span className="text-xs tabular-nums text-muted-foreground">{previewBeers.length}</span>
                          </div>
                          {previewBeers.length ? (
                            <ul className="max-h-80 space-y-2 overflow-y-auto rounded-xl border border-border p-2" aria-label="Erkannte Produkte">
                              <AnimatePresence initial={false}>
                                {previewBeers.map((beer) => (
                                  <SortimentBeerRow
                                    key={beer.id}
                                    beer={beer}
                                    canEditCategory={brand.suggestedBeers !== undefined}
                                    reduceMotion={reduceMotion}
                                    onCategoryChange={(produktKategorie) => {
                                      activated.current = false;
                                      setBrand((current) => ({
                                        ...current,
                                        suggestedBeers: (current.suggestedBeers ?? []).map((item) =>
                                          item.name === beer.name &&
                                          (item.etikettUrl || "") === (beer.etikettUrl || "")
                                            ? {
                                                ...item,
                                                produktKategorie,
                                                bierstil:
                                                  produktKategorie === "bier" ? item.bierstil : produktKategorie,
                                              }
                                            : item,
                                        ),
                                      }));
                                    }}
                                    onRemove={() => {
                                      activated.current = false;
                                      if (beer.id.startsWith("preview-")) {
                                        const list = brand.suggestedBeers ?? [];
                                        const idx = list.findIndex(
                                          (item) =>
                                            item.name === beer.name &&
                                            (item.etikettUrl || "") === (beer.etikettUrl || ""),
                                        );
                                        if (idx < 0) return;
                                        const removed = list[idx];
                                        setBrand((current) => {
                                          const cur = current.suggestedBeers ?? [];
                                          const i = cur.findIndex(
                                            (item) =>
                                              item.name === beer.name &&
                                              (item.etikettUrl || "") === (beer.etikettUrl || ""),
                                          );
                                          if (i < 0) return current;
                                          return {
                                            ...current,
                                            suggestedBeers: cur.filter((_, j) => j !== i),
                                          };
                                        });
                                        armSortimentUndo({
                                          source: "suggested",
                                          index: idx,
                                          name: removed.name,
                                          suggestedItem: removed,
                                        });
                                      } else {
                                        const idx = beers.findIndex((item) => item.id === beer.id);
                                        if (idx < 0) return;
                                        const removed = beers[idx];
                                        setBeers((current) => current.filter((item) => item.id !== beer.id));
                                        armSortimentUndo({
                                          source: "beers",
                                          index: idx,
                                          name: removed.name,
                                          beerItem: removed,
                                        });
                                      }
                                    }}
                                  />
                                ))}
                              </AnimatePresence>
                            </ul>
                          ) : (
                            <div className="flex gap-3 rounded-xl border border-dashed border-border p-5">
                              <Package className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                              <p className="text-sm leading-6 text-muted-foreground">Keine Produkte — kannst du später im Studio ergänzen.</p>
                            </div>
                          )}
                          <AnimatePresence>
                            {sortimentUndo ? (
                              <motion.div
                                key="sortiment-undo"
                                role="status"
                                initial={{ opacity: 0, y: 6 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: 4 }}
                                className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/50 px-3 py-2.5"
                              >
                                <p className="min-w-0 truncate text-sm text-muted-foreground">
                                  <span className="font-medium text-foreground">„{sortimentUndo.name}“</span> entfernt
                                </p>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="h-8 shrink-0 gap-1.5"
                                  onClick={undoSortimentRemove}
                                >
                                  <RotateCcw className="size-3.5" aria-hidden="true" />
                                  Rückgängig
                                </Button>
                              </motion.div>
                            ) : null}
                          </AnimatePresence>
                        </section>
                      </>
                    ) : null}

                    {step === 2 ? (
                      <div className="overflow-hidden rounded-xl border border-border bg-card">
                        <div className="flex items-center gap-3 border-b border-border bg-muted/30 p-5"><span className="flex size-10 items-center justify-center rounded-full border border-border bg-background"><CheckCheck className="size-5" aria-hidden="true" /></span><div><h2 className="text-sm font-medium">Alles bereit</h2><p className="mt-1 text-xs text-muted-foreground">Marke und Sortiment sind vorbereitet.</p></div></div>
                        <dl className="divide-y divide-border px-5">
                          <div className="py-4"><dt className="text-xs text-muted-foreground">Brauerei</dt><dd className="mt-1 break-words text-sm font-medium">{brand.breweryName || breweryName}</dd></div>
                          <div className="py-4"><dt className="text-xs text-muted-foreground">Markenprofil</dt><dd className="mt-1 text-sm">Farben, Ton & Bildregeln</dd></div>
                          <div className="py-4"><dt className="text-xs text-muted-foreground">Sortiment</dt><dd className="mt-1 text-sm">{previewBeers.length ? `${previewBeers.length} Produkte` : "Später ergänzen"}</dd></div>
                        </dl>
                        <div className="flex items-start gap-2 border-t border-border bg-muted/30 p-5 text-xs leading-5 text-muted-foreground"><PencilLine className="mt-0.5 size-4 shrink-0" aria-hidden="true" />Alles später im Dashboard editierbar.</div>
                      </div>
                    ) : null}
                  </fieldset>

                  {error ? <div ref={errorRef} tabIndex={-1} role="alert" className="mt-5 flex items-start gap-2.5 rounded-lg border border-destructive/25 bg-destructive/5 p-4 text-sm leading-6 text-destructive outline-none focus-visible:ring-2 focus-visible:ring-destructive/40"><CircleAlert className="mt-1 size-4 shrink-0" aria-hidden="true" /><p>{error}</p></div> : null}

                  {!scanning ? (
                    <div className="mt-7 flex flex-col-reverse gap-3 border-t border-border/70 pt-5 sm:flex-row sm:items-center sm:justify-between">
                      {step > 0 ? <Button type="button" variant="ghost" className="h-11 px-3" disabled={busy} onClick={() => goToStep(step - 1)}><ArrowLeft aria-hidden="true" />Zurück</Button> : <p className="text-center text-xs text-muted-foreground sm:text-left">Keine Website? Oben rechts „Später“.</p>}
                      <Button type="submit" className="h-12 gap-2 px-5 sm:ml-auto" disabled={busy}>
                        {busy ? <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : null}{primaryLabel}{!busy ? <ArrowRight className="size-4" aria-hidden="true" /> : null}
                      </Button>
                    </div>
                  ) : null}
                </form>
              </motion.section>
            </AnimatePresence>
          </main>
        </div>
      </div>
    </div>
  );
}
