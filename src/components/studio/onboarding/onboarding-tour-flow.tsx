"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EvglabMark } from "@/components/studio/evglab-mark";
import { Tour, useTour, type TourStep } from "@/components/ui/product-tour";
import type { DashboardBeer } from "@/lib/dashboard/metadata";
import { BRAND_SETTINGS_LIMITS, clampBrandSettingsFields } from "@/lib/dashboard/settingsPayload";
import { ONBOARDING_TOUR_VERSION } from "@/lib/dashboard/onboarding";
import {
  brandLooksReady,
  emptyBrandDraft,
  parseBrandColors,
  patchOnboarding,
  type OnboardingBootstrap,
  type OnboardingBrandDraft,
} from "./onboarding-tour-types";

const SCAN_STEPS = [
  "Website wird gelesen",
  "Markensignale werden erkannt",
  "Sortiment wird erkannt",
  "Markenprofil wird vorbereitet",
];

export function OnboardingTourFlow({ bootstrap }: { bootstrap: OnboardingBootstrap }) {
  const router = useRouter();
  const tour = useTour();
  const finishLock = useRef(false);

  const [breweryName, setBreweryName] = useState(
    bootstrap.settings?.breweryName?.trim() || "",
  );
  const [websiteUrl, setWebsiteUrl] = useState(
    bootstrap.settings?.brandWebsiteUrl?.trim() || "",
  );
  const [brand, setBrand] = useState<OnboardingBrandDraft>(() => emptyBrandDraft(bootstrap.settings));
  const [beers, setBeers] = useState<DashboardBeer[]>(bootstrap.beers);
  const [scanning, setScanning] = useState(false);
  const [scanIndex, setScanIndex] = useState(0);
  const [activating, setActivating] = useState(false);
  const [error, setError] = useState("");
  const [tokens, setTokens] = useState<number | null>(bootstrap.tokensRemaining);

  const brandReady = brandLooksReady(brand);
  const suggestedCount = brand.suggestedBeers?.length ?? beers.length;

  useEffect(() => {
    const t = window.setTimeout(() => tour.start(), 500);
    return () => window.clearTimeout(t);
  }, [tour.start]);

  useEffect(() => {
    void patchOnboarding({ flowVersion: 2 }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!scanning) return;
    const timers = SCAN_STEPS.map((_, i) =>
      window.setTimeout(() => setScanIndex(i + 1), 700 + i * 900),
    );
    return () => timers.forEach(clearTimeout);
  }, [scanning]);

  const saveBrewerySettings = useCallback(async () => {
    const name = breweryName.trim();
    if (!name) throw new Error("Bitte einen Brauereinamen eingeben.");
    const res = await fetch("/api/dashboard/settings", {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        breweryName: name.slice(0, 120),
        brandWebsiteUrl: websiteUrl.trim(),
      }),
    });
    if (!res.ok) {
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(json.error || "Speichern fehlgeschlagen.");
    }
  }, [breweryName, websiteUrl]);

  const analyzeBrand = useCallback(async () => {
    const url = websiteUrl.trim();
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
        referenceImageUrls: Array.isArray(s.referenceImageUrls) ? s.referenceImageUrls.filter(Boolean).slice(0, 10) : [],
        referenceImagePayloads: s.referenceImagePayloads,
        suggestedBeers: Array.isArray(s.suggestedBeers) ? s.suggestedBeers : undefined,
      };
      if (!brandLooksReady(next)) {
        throw new Error("Analyse lieferte kein vollständiges Markenprofil.");
      }
      setBrand(next);
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
      if (!res.ok) throw new Error(json.error || "Markenprofil konnte nicht gespeichert werden.");
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

  const completeOnboarding = useCallback(async () => {
    if (finishLock.current) return;
    finishLock.current = true;
    setError("");
    try {
      const bonusRes = await fetch("/api/billing/onboarding-bonus", {
        method: "POST",
        credentials: "include",
      });
      if (bonusRes.ok) {
        const data = (await bonusRes.json()) as { state?: { remainingTokens?: number } };
        if (typeof data.state?.remainingTokens === "number") {
          setTokens(data.state.remainingTokens);
        }
      }
      await patchOnboarding({
        flowVersion: 2,
        completedAt: new Date().toISOString(),
        tourVersion: ONBOARDING_TOUR_VERSION,
        welcome: true,
        checklistDismissed: false,
        celebrated: false,
      });
      tour.setOpen(false);
      router.push(bootstrap.hasActivePlan ? "/inhalte-erstellen" : "/dashboard");
      router.refresh();
    } catch (err) {
      finishLock.current = false;
      setError(err instanceof Error ? err.message : "Abschluss fehlgeschlagen.");
    }
  }, [bootstrap.hasActivePlan, router, tour]);

  const steps = useMemo((): TourStep[] => {
    const base: TourStep[] = [
      {
        title: "Willkommen bei BrewAI",
        content: (
          <>
            In weniger als einer Minute richten wir dein Studio ein — Marke, Sortiment und erste Motive.
            Du kannst jederzeit mit Esc abbrechen und später im Dashboard weitermachen.
          </>
        ),
        placement: "center",
      },
      {
        target: "#onboarding-brewery",
        title: "Deine Brauerei",
        content: "Wie heißt deine Brauerei? Der Name erscheint in Motiven und im Markenprofil.",
        placement: "bottom",
      },
      {
        target: "#onboarding-website",
        title: "Website verbinden",
        content:
          "Wir lesen deine Website aus — Farben, Tonalität und Biersorten werden automatisch erkannt.",
        placement: "bottom",
      },
      {
        target: "#onboarding-scan",
        title: "Markenprofil analysieren",
        content: scanning
          ? "Analyse läuft — Sortiment und Etikett-Fotos werden gleich mit angelegt."
          : "Starte die Analyse. Biersorten aus deinem Sortiment werden automatisch angelegt.",
        placement: "bottom",
      },
    ];

    if (!brandReady) return base;

    return [
      ...base,
      {
        target: "#onboarding-brand",
        title: "Dein Markenprofil",
        content: "Farben und Tonalität aus deiner Website — du kannst alles später im Markenprofil anpassen.",
        placement: "right",
      },
      {
        target: "#onboarding-beers",
        title: "Sortiment erkannt",
        content:
          suggestedCount > 0
            ? `${suggestedCount} Biersorte${suggestedCount === 1 ? "" : "n"} mit Etikett-Foto wurden vorbereitet.`
            : "Noch keine Sorten erkannt — du legst sie später im Dashboard an.",
        placement: "top",
      },
      {
        target: "#onboarding-finish",
        title: "Studio starten",
        content: "Alles wird gespeichert. Danach kannst du direkt dein erstes Motiv erstellen.",
        placement: "top",
      },
    ];
  }, [brandReady, scanning, suggestedCount]);

  const scanStepIndex = 3;
  const finishStepIndex = steps.length - 1;

  const handleTourNext = useCallback(async () => {
    setError("");
    const idx = tour.index;

    if (idx === 1 && !breweryName.trim()) {
      setError("Bitte Brauereinamen eingeben.");
      return;
    }
    if (idx === 2 && !websiteUrl.trim()) {
      setError("Bitte Website-URL eingeben.");
      return;
    }

    if (idx === scanStepIndex) {
      if (brandReady) {
        tour.setIndex(scanStepIndex + 1);
        return;
      }
      try {
        await analyzeBrand();
        tour.setIndex(scanStepIndex + 1);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Analyse fehlgeschlagen.");
      }
      return;
    }

    if (idx === finishStepIndex) {
      try {
        if (!brandReady) {
          await analyzeBrand();
        }
        await activateProfile();
        await completeOnboarding();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Speichern fehlgeschlagen.");
        finishLock.current = false;
      }
      return;
    }

    tour.setIndex(Math.min(idx + 1, finishStepIndex));
  }, [
    activateProfile,
    analyzeBrand,
    brandReady,
    breweryName,
    completeOnboarding,
    finishStepIndex,
    scanStepIndex,
    tour,
    websiteUrl,
  ]);

  const handleSkip = useCallback(async () => {
    try {
      await patchOnboarding({
        flowVersion: 2,
        completedAt: new Date().toISOString(),
        tourVersion: ONBOARDING_TOUR_VERSION,
        welcome: true,
        checklistDismissed: true,
        celebrated: true,
      });
    } catch {
      /* trotzdem weiter */
    }
    tour.setOpen(false);
    router.push("/dashboard");
  }, [router, tour]);

  const swatches = parseBrandColors(brand.brandColors);
  const previewBeers =
    beers.length > 0
      ? beers
      : (brand.suggestedBeers ?? []).map((b, i) => ({
          id: `preview-${i}`,
          name: b.name,
          bierstil: b.bierstil,
          flaschenTyp: b.flaschenTyp,
          flaschenfarbe: b.flaschenfarbe,
          glasTyp: b.glasTyp,
          etikettUrl: b.etikettUrl,
          createdAt: "",
        }));

  const primaryDisabled = scanning || activating;
  const primaryLabel =
    tour.index === scanStepIndex && !brandReady
      ? scanning
        ? "Analysiert …"
        : "Analysieren"
      : tour.index === finishStepIndex
        ? activating
          ? "Speichert …"
          : "Studio öffnen"
        : undefined;

  return (
    <div className="dark min-h-dvh bg-zinc-950 text-zinc-100">
      <div className="mx-auto flex min-h-dvh max-w-3xl flex-col px-4 py-8 sm:px-6">
        <header className="mb-8 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/15 ring-1 ring-amber-500/30">
            <EvglabMark className="h-5 w-5 text-amber-400" />
          </div>
          <div>
            <p className="text-[13px] font-semibold tracking-tight">BrewAI Studio</p>
            <p className="text-[12px] text-zinc-500">Einrichtung für {bootstrap.profileName || "dein Team"}</p>
          </div>
          {typeof tokens === "number" ? (
            <span className="ml-auto rounded-full border border-zinc-800 bg-zinc-900 px-2.5 py-1 text-[11px] tabular-nums text-zinc-400">
              {tokens.toLocaleString("de-DE")} Tokens
            </span>
          ) : null}
        </header>

        <main
          id="onboarding-card"
          className="flex flex-1 flex-col rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5 shadow-2xl shadow-black/30 sm:p-7"
        >
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-zinc-500">Markenprofil</p>
          <h1 className="mt-2 text-xl font-semibold tracking-tight sm:text-2xl">Dein Studio in einer Minute</h1>
          <p className="mt-2 max-w-xl text-[13px] leading-relaxed text-zinc-400">
            Website eingeben, analysieren — Markenprofil und Biersorten werden automatisch aus deiner Website übernommen.
          </p>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <label id="onboarding-brewery" className="block">
              <span className="mb-1.5 block text-[11px] font-medium uppercase tracking-wide text-zinc-500">
                Brauereiname
              </span>
              <input
                className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-[14px] text-zinc-100 outline-none ring-amber-500/0 transition focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/20"
                value={breweryName}
                onChange={(e) => setBreweryName(e.target.value)}
                placeholder="z. B. Augustiner-Bräu"
                autoComplete="organization"
              />
            </label>

            <label id="onboarding-website" className="block">
              <span className="mb-1.5 block text-[11px] font-medium uppercase tracking-wide text-zinc-500">
                Website
              </span>
              <input
                className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-[14px] text-zinc-100 outline-none transition focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/20"
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
                placeholder="https://www.deine-brauerei.de"
                inputMode="url"
                autoComplete="url"
              />
            </label>
          </div>

          <div id="onboarding-scan" className="mt-4">
            <button
              type="button"
              disabled={scanning || activating}
              onClick={() => void analyzeBrand().catch((err) => setError(err instanceof Error ? err.message : "Analyse fehlgeschlagen."))}
              className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-[13px] font-medium text-zinc-950 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {scanning ? "Analysiert …" : brandReady ? "Erneut analysieren" : "Website analysieren"}
            </button>
            {scanning ? (
              <ul className="mt-3 space-y-1 text-[12px] text-zinc-500" aria-live="polite">
                {SCAN_STEPS.map((label, i) => (
                  <li key={label} className={scanIndex > i ? "text-zinc-300" : undefined}>
                    {scanIndex > i ? "✓ " : "· "}
                    {label}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          {brandReady ? (
            <div id="onboarding-brand" className="mt-6 rounded-xl border border-zinc-800 bg-zinc-950/80 p-4">
              <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">Erkanntes Markenprofil</p>
              <p className="mt-2 text-[13px] font-medium text-zinc-200">{brand.breweryName || breweryName}</p>
              <p className="mt-1 text-[12px] leading-relaxed text-zinc-400">{brand.brandTone}</p>
              {swatches.length ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {swatches.map((c) => (
                    <span
                      key={c}
                      className="inline-flex items-center gap-1.5 rounded-full border border-zinc-800 bg-zinc-900 px-2 py-1 text-[11px] text-zinc-400"
                    >
                      <span className="h-3 w-3 rounded-full ring-1 ring-white/10" style={{ background: c }} />
                      {c.toUpperCase()}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}

          {brandReady ? (
            <div id="onboarding-beers" className="mt-4">
              <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-zinc-500">
                Biersorten {previewBeers.length ? `(${previewBeers.length})` : ""}
              </p>
              {previewBeers.length ? (
                <ul className="grid max-h-64 grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3">
                  {previewBeers.map((beer) => (
                    <li
                      key={beer.id}
                      className="flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-950/60 px-2.5 py-2"
                    >
                      <div className="relative h-10 w-8 shrink-0 overflow-hidden rounded-md bg-zinc-800">
                        {beer.etikettUrl ? (
                          <Image
                            src={beer.etikettUrl}
                            alt=""
                            fill
                            className="object-cover"
                            sizes="32px"
                            unoptimized
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-[9px] text-zinc-600">
                            —
                          </div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-[12px] font-medium text-zinc-200">{beer.name}</p>
                        <p className="truncate text-[10px] text-zinc-500">{beer.bierstil}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="rounded-xl border border-dashed border-zinc-800 px-3 py-4 text-[12px] text-zinc-500">
                  Keine Sorten auf der Website gefunden — du kannst sie später im Dashboard anlegen.
                </p>
              )}
            </div>
          ) : null}

          <div id="onboarding-finish" className="mt-auto pt-6">
            {error ? (
              <p className="mb-3 text-[12px] text-red-400" role="alert">
                {error}
              </p>
            ) : null}
            <p className="text-[12px] text-zinc-500">
              Mit „Studio öffnen“ werden Markenprofil und Sortiment gespeichert. Alles bleibt im Dashboard editierbar.
            </p>
          </div>
        </main>
      </div>

      <Tour
        steps={steps}
        open={tour.open}
        onOpenChange={tour.setOpen}
        index={tour.index}
        onIndexChange={tour.setIndex}
        dark
        primaryDisabled={primaryDisabled}
        primaryLabel={primaryLabel}
        onSkip={() => void handleSkip()}
        onPrimaryClick={() => void handleTourNext()}
      />
    </div>
  );
}
