"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, ArrowRight, Check, CheckCheck, CircleAlert, Globe2, Loader2, Package, Palette, PencilLine, ScanLine } from "lucide-react";
import { EvglabMark } from "@/components/studio/evglab-mark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { DashboardBeer } from "@/lib/dashboard/metadata";
import { GETRANKEART_OPTIONS, produktKategorieLabel, sanitizeProduktKategorie } from "@/lib/dashboard/metadata";
import { BRAND_SETTINGS_LIMITS, clampBrandSettingsFields } from "@/lib/dashboard/settingsPayload";
import { ONBOARDING_TOUR_VERSION } from "@/lib/dashboard/onboarding";
import { brandLooksReady, emptyBrandDraft, parseBrandColors, patchOnboarding, type OnboardingBootstrap, type OnboardingBrandDraft } from "./onboarding-tour-types";

const STEPS = [
  { title: "Deine Brauerei", description: "Mit deiner Website verbinden", icon: Globe2 },
  { title: "Deine Marke", description: "Profil und Sortiment prüfen", icon: Palette },
  { title: "Dein Studio", description: "Einrichtung abschließen", icon: CheckCheck },
];
const SCAN_MESSAGES = [
  "Wir lesen deine Website und suchen nach Markensignalen.",
  "Wir suchen nach Farben, Tonalität und Bildsprache.",
  "Wir prüfen, welche Produkte wir übernehmen können.",
  "Wir bereiten dein Profil vor. Bei großen Websites kann das etwas dauern.",
];

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
  const [scanIndex, setScanIndex] = useState(0);
  const [activating, setActivating] = useState(false);
  const [error, setError] = useState("");
  const [tokens, setTokens] = useState<number | null>(bootstrap.tokensRemaining);
  const analyzedInput = useRef({ name: breweryName, url: websiteUrl });
  const brandReady = brandLooksReady(brand);

  useEffect(() => {
    void patchOnboarding({ flowVersion: 2 }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!scanning) return;
    const timer = window.setInterval(() => setScanIndex((current) => Math.min(current + 1, SCAN_MESSAGES.length - 1)), 6500);
    return () => window.clearInterval(timer);
  }, [scanning]);

  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);

  function goToStep(next: number) {
    setError("");
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
    setScanIndex(0);
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
    if (!bonusRes.ok) throw new Error("Dein Profil ist gespeichert. Der Willkommensbonus konnte noch nicht gutgeschrieben werden. Bitte versuche es erneut.");
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
  // Show the latest analysis, even when the account already contains products.
  const previewBeers = brand.suggestedBeers !== undefined
    ? brand.suggestedBeers.map((beer, i) => ({ ...beer, id: `preview-${i}` }))
    : beers;
  const headings = ["Machen wir dein Studio zu deinem.", "Das ist deine Marke.", "Bereit für dein erstes Motiv."];
  const descriptions = [
    "Verbinde deine Website. Wir bereiten daraus ein Markenprofil und dein Sortiment vor — du prüfst alles im nächsten Schritt.",
    "Prüfe, was wir erkannt haben. Du kannst die Texte direkt anpassen und dein Profil später jederzeit verfeinern.",
    "Deine Marke gibt die Richtung vor. Wir speichern jetzt dein Profil und dein Sortiment für die Arbeit im Studio.",
  ];
  const primaryLabel = busy
    ? scanning ? "Website wird analysiert …" : activating ? "Profil wird gespeichert …" : "Einen Moment …"
    : step === 0 ? "Website analysieren" : step === 1 ? "Weiter zur Übersicht" : "Studio öffnen";

  return (
    <div className="brewai-admin min-h-dvh bg-background text-foreground">
      <a href="#onboarding-main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-background focus:p-3 focus:ring-2 focus:ring-ring">Zum Inhalt</a>
      <div className="mx-auto flex min-h-dvh max-w-6xl flex-col px-5 sm:px-8 lg:px-12">
        <header className="flex min-h-24 items-center justify-between gap-4 border-b border-border/70 py-5">
          <div className="flex items-center gap-2.5">
            <EvglabMark size={28} />
            <span className="text-lg font-semibold tracking-tight">BrewAI</span>
            <span className="ml-2 hidden border-l border-border pl-4 text-sm text-muted-foreground sm:inline">Studio einrichten</span>
          </div>
          <Button variant="ghost" className="h-11 px-3 text-muted-foreground" disabled={busy} onClick={() => void runAction("skip")}>
            Später einrichten <ArrowRight className="size-4" aria-hidden="true" />
          </Button>
        </header>

        <div className="grid flex-1 content-start gap-9 py-8 md:grid-cols-[220px_minmax(0,1fr)] md:gap-10 md:py-14 lg:gap-20 lg:py-16">
          <aside className="min-w-0">
            <p className="mb-2 text-sm text-muted-foreground">Willkommen{bootstrap.profileName ? `, ${bootstrap.profileName.split(" ")[0]}` : " bei BrewAI"}.</p>
            <p className="max-w-64 text-2xl font-semibold leading-tight tracking-tight">Deine Marke.<br className="hidden md:block" /> Dein kreativer Freiraum.</p>
            <nav aria-label="Einrichtungsschritte" className="mt-7 md:mt-10">
              <ol className="grid grid-cols-3 gap-2 md:grid-cols-1 md:gap-3">
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
            <div className="mt-10 hidden border-t border-border/70 pt-5 md:block">
              <p className="text-xs leading-relaxed text-muted-foreground">Ein guter Start, kein starres Setup. Deine Angaben bleiben im Studio jederzeit editierbar.</p>
              {typeof tokens === "number" ? <p className="mt-4 text-xs text-muted-foreground"><span className="font-medium tabular-nums text-foreground">{tokens.toLocaleString("de-DE")}</span> Tokens im Konto</p> : null}
            </div>
          </aside>

          <main id="onboarding-main" className="min-w-0" aria-label="Studio einrichten">
            <div className="mb-6 flex items-center gap-3" aria-label={`Schritt ${step + 1} von 3`}>
              <span className="shrink-0 text-xs font-medium tabular-nums text-muted-foreground">Schritt 0{step + 1} / 03</span>
              <div className="flex flex-1 gap-1.5" aria-hidden="true">
                {STEPS.map((item, index) => <span key={item.title} className={cn("h-1 flex-1 rounded-full transition-colors duration-300 motion-reduce:transition-none", index <= step ? "bg-primary" : "bg-muted")} />)}
              </div>
            </div>
            <AnimatePresence mode="wait" initial={false}>
              <motion.section
                key={step}
                initial={{ opacity: 0, y: reduceMotion ? 0 : 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: reduceMotion ? 0 : -6 }}
                transition={{ duration: reduceMotion ? 0 : 0.2, ease: "easeOut" }}
                onAnimationComplete={() => {
                  if (step > 0 || document.activeElement?.tagName === "BODY") headingRef.current?.focus({ preventScroll: true });
                }}
                aria-labelledby="onboarding-heading"
              >
                <h1 id="onboarding-heading" ref={headingRef} tabIndex={-1} className="text-balance text-3xl font-semibold leading-tight tracking-tight outline-none sm:text-4xl">{headings[step]}</h1>
                <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">{descriptions[step]}</p>

                <form className="mt-7" onSubmit={(event) => { event.preventDefault(); void runAction("next"); }} aria-busy={busy}>
                  <fieldset disabled={busy} className="min-w-0 space-y-5">
                    <legend className="sr-only">{STEPS[step].title}</legend>
                    {step === 0 ? (
                      <>
                        <div className="space-y-2">
                          <Label htmlFor="onboarding-brewery">Name deiner Brauerei</Label>
                          <Input id="onboarding-brewery" name="breweryName" required maxLength={BRAND_SETTINGS_LIMITS.breweryName} autoComplete="organization" placeholder="Wie heißt deine Brauerei?" value={breweryName} onChange={(event) => setBreweryName(event.target.value)} className="h-12 px-3.5" />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="onboarding-website">Website</Label>
                          <div className="relative">
                            <Globe2 className="pointer-events-none absolute left-3.5 top-4 size-4 text-muted-foreground" aria-hidden="true" />
                            <Input id="onboarding-website" name="website" required maxLength={2000} inputMode="url" autoComplete="url" autoCapitalize="none" spellCheck={false} placeholder="deine-brauerei.de" value={websiteUrl} onChange={(event) => setWebsiteUrl(event.target.value)} className="h-12 pl-10 pr-3.5" aria-describedby="onboarding-website-help" />
                          </div>
                          <p id="onboarding-website-help" className="text-xs leading-5 text-muted-foreground">Deine öffentlich erreichbare Website genügt. Du brauchst keine Zugangsdaten.</p>
                        </div>
                        <div className="rounded-xl border border-border bg-muted/30 p-5">
                          <div className="flex items-center gap-2 text-sm font-medium"><ScanLine className={cn("size-4", scanning && "animate-pulse motion-reduce:animate-none")} aria-hidden="true" />{scanning ? "Deine Marke nimmt Form an" : "Das bereiten wir für dich vor"}</div>
                          {scanning ? (
                            <div role="status" aria-live="polite" className="mt-3 flex gap-3 text-sm leading-6 text-muted-foreground">
                              <Loader2 className="mt-1 size-4 shrink-0 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                              <p>{SCAN_MESSAGES[scanIndex]}</p>
                            </div>
                          ) : (
                            <ul className="mt-4 grid gap-3 text-sm text-muted-foreground sm:grid-cols-2">
                              <li className="flex items-center gap-2"><Palette className="size-4" aria-hidden="true" /> Farben & Tonalität</li>
                              <li className="flex items-center gap-2"><Package className="size-4" aria-hidden="true" /> Sortiment & Etiketten</li>
                            </ul>
                          )}
                          <p className="mt-4 border-t border-border/70 pt-3 text-xs leading-5 text-muted-foreground">{scanning ? "Du kannst dieses Fenster geöffnet lassen. Das Ergebnis erscheint automatisch." : "Du entscheidest im nächsten Schritt, was zu deiner Marke passt."}</p>
                        </div>
                      </>
                    ) : null}

                    {step === 1 ? (
                      <>
                        <div className="rounded-xl border border-border bg-card p-5 sm:p-6">
                          <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0"><p className="text-xs text-muted-foreground">Erkanntes Markenprofil</p><h2 className="mt-1 break-words text-lg font-semibold tracking-tight">{brand.breweryName || breweryName}</h2></div>
                            <span className="flex shrink-0 items-center gap-1.5 rounded-md bg-muted px-2 py-1 text-xs"><Check className="size-3.5" aria-hidden="true" /> Bereit zur Prüfung</span>
                          </div>
                          <p className="mt-4 whitespace-pre-line text-sm leading-6 text-muted-foreground">{brand.brandTone}</p>
                          {swatches.length ? <div className="mt-5 flex flex-wrap gap-3" aria-label="Erkannte Markenfarben">{swatches.map((color, index) => <div key={`${color}-${index}`} className="flex items-center gap-2 text-xs text-muted-foreground"><span className="size-7 rounded-md ring-1 ring-inset ring-foreground/10" style={{ backgroundColor: color }} /><span className="font-mono">{color.toUpperCase()}</span></div>)}</div> : null}
                          <details className="mt-5 border-t border-border pt-4">
                            <summary className="cursor-pointer rounded text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring">Profiltexte anpassen</summary>
                            <div className="mt-4 space-y-4">
                              {([
                                ["brandTone", "Tonalität"], ["brandColors", "Markenfarben"], ["brandDos", "Das passt zu deiner Marke"], ["brandDonts", "Das vermeiden wir"],
                              ] as const).map(([key, label]) => <div key={key} className="space-y-2"><Label htmlFor={`onboarding-${key}`}>{label}</Label><Textarea id={`onboarding-${key}`} value={brand[key]} maxLength={BRAND_SETTINGS_LIMITS[key]} onChange={(event) => updateBrand({ [key]: event.target.value })} className="min-h-20 resize-y text-sm" /></div>)}
                            </div>
                          </details>
                        </div>
                        <section aria-labelledby="onboarding-products-title">
                          <div className="mb-3 flex items-center justify-between gap-3"><h2 id="onboarding-products-title" className="text-sm font-medium">Dein Sortiment</h2><span className="text-xs tabular-nums text-muted-foreground">{previewBeers.length} {previewBeers.length === 1 ? "Produkt" : "Produkte"}</span></div>
                          {previewBeers.length ? (
                            <ul className="max-h-80 space-y-2 overflow-y-auto rounded-xl border border-border p-2" aria-label="Erkannte Produkte">
                              {previewBeers.map((beer, index) => (
                                <li key={beer.id} className="flex items-center gap-3 rounded-lg bg-muted/40 p-3">
                                  <div className="relative flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-md bg-background">
                                    {beer.etikettUrl ? <Image src={beer.etikettUrl} alt="" fill className="object-contain p-1" sizes="48px" unoptimized /> : <Package className="size-5 text-muted-foreground" aria-hidden="true" />}
                                  </div>
                                  <div className="min-w-0 flex-1"><p className="break-words text-sm font-medium">{beer.name}</p>
                                    {brand.suggestedBeers !== undefined ? (
                                      <select aria-label={`Getränkeart für ${beer.name}`} className="mt-1 min-h-9 w-full max-w-52 rounded-md border border-input bg-background px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" value={sanitizeProduktKategorie(beer.produktKategorie)} onChange={(event) => {
                                        const produktKategorie = sanitizeProduktKategorie(event.target.value);
                                        updateBrand({ suggestedBeers: brand.suggestedBeers?.map((item, itemIndex) => itemIndex === index ? { ...item, produktKategorie, bierstil: produktKategorie === "bier" ? item.bierstil : produktKategorie } : item) });
                                      }}>{GETRANKEART_OPTIONS.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select>
                                    ) : <p className="mt-1 text-xs text-muted-foreground">{produktKategorieLabel(sanitizeProduktKategorie(beer.produktKategorie))}</p>}
                                  </div>
                                </li>
                              ))}
                            </ul>
                          ) : <div className="flex gap-3 rounded-xl border border-dashed border-border p-5"><Package className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden="true" /><p className="text-sm leading-6 text-muted-foreground">Wir haben keine Produkte erkannt. Du kannst dein Sortiment später im Studio ergänzen und jetzt trotzdem fortfahren.</p></div>}
                        </section>
                      </>
                    ) : null}

                    {step === 2 ? (
                      <div className="overflow-hidden rounded-xl border border-border bg-card">
                        <div className="flex items-center gap-3 border-b border-border bg-muted/30 p-5 sm:p-6"><span className="flex size-10 items-center justify-center rounded-full border border-border bg-background"><CheckCheck className="size-5" aria-hidden="true" /></span><div><h2 className="text-sm font-medium">Alles an einem Ort</h2><p className="mt-1 text-xs text-muted-foreground">Dein Studio startet mit deiner Marke.</p></div></div>
                        <dl className="divide-y divide-border px-5 sm:px-6">
                          <div className="py-4"><dt className="text-xs text-muted-foreground">Brauerei</dt><dd className="mt-1 break-words text-sm font-medium">{brand.breweryName || breweryName}</dd></div>
                          <div className="py-4"><dt className="text-xs text-muted-foreground">Markenprofil</dt><dd className="mt-1 text-sm">Farben, Tonalität und Bildregeln vorbereitet</dd></div>
                          <div className="py-4"><dt className="text-xs text-muted-foreground">Sortiment</dt><dd className="mt-1 text-sm">{previewBeers.length ? `${previewBeers.length} ${previewBeers.length === 1 ? "Produkt" : "Produkte"} für dein Studio` : "Kannst du später ergänzen"}</dd></div>
                        </dl>
                        <div className="flex items-start gap-2 border-t border-border bg-muted/30 p-5 text-xs leading-5 text-muted-foreground sm:px-6"><PencilLine className="mt-0.5 size-4 shrink-0" aria-hidden="true" />Du kannst dein Profil und deine Produkte jederzeit im Dashboard bearbeiten.</div>
                      </div>
                    ) : null}
                  </fieldset>

                  {error ? <div ref={errorRef} tabIndex={-1} role="alert" className="mt-5 flex items-start gap-2.5 rounded-lg border border-destructive/25 bg-destructive/5 p-4 text-sm leading-6 text-destructive outline-none focus-visible:ring-2 focus-visible:ring-destructive/40"><CircleAlert className="mt-1 size-4 shrink-0" aria-hidden="true" /><p>{error}</p></div> : null}
                  <div className="mt-7 flex flex-col-reverse gap-3 border-t border-border/70 pt-5 sm:flex-row sm:items-center sm:justify-between">
                    {step > 0 ? <Button type="button" variant="ghost" className="h-11 px-3" disabled={busy} onClick={() => goToStep(step - 1)}><ArrowLeft aria-hidden="true" />Zurück</Button> : <p className="text-center text-xs text-muted-foreground sm:text-left">Keine Website? Wähle „Später einrichten“.</p>}
                    <Button type="submit" className="h-12 gap-2 px-5 sm:ml-auto" disabled={busy}>
                      {busy ? <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : null}{primaryLabel}{!busy ? <ArrowRight className="size-4 transition-transform group-hover/button:translate-x-0.5 motion-reduce:transform-none" aria-hidden="true" /> : null}
                    </Button>
                  </div>
                  {step === 2 ? <p className="mt-3 text-xs leading-5 text-muted-foreground" role="status">{busy ? "Wir schließen deine Einrichtung ab. Bitte lasse dieses Fenster geöffnet." : bootstrap.hasActivePlan ? "Danach geht es direkt zu deinem ersten Motiv." : "Danach geht es ins Dashboard. Dort kannst du deinen Tarif wählen."}</p> : null}
                </form>
              </motion.section>
            </AnimatePresence>
          </main>
        </div>
        <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-border/70 py-5 text-xs text-muted-foreground"><span>BrewAI Studio</span><span>Für deine Marke. Für deine nächsten Ideen.</span></footer>
      </div>
    </div>
  );
}
