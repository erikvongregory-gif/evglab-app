"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { DashboardBeer, DashboardTeamMember } from "@/lib/dashboard/metadata";
import type { OnboardingFlowStep } from "@/lib/dashboard/onboarding";
import { BRAND_SETTINGS_LIMITS, clampBrandSettingsFields } from "@/lib/dashboard/settingsPayload";
import { OnboardingShell } from "./onboarding-shell";
import {
  brandLooksReady,
  emptyBrandDraft,
  patchOnboarding,
  type OnboardingBootstrap,
  type OnboardingBrandDraft,
} from "./onboarding-types";
import { OnboardingAssortmentStep } from "./steps/onboarding-assortment-step";
import { OnboardingBrandStep } from "./steps/onboarding-brand-step";
import { OnboardingBreweryStep } from "./steps/onboarding-brewery-step";
import { OnboardingCompleteStep } from "./steps/onboarding-complete-step";
import { OnboardingTeamStep } from "./steps/onboarding-team-step";

const SCAN_STEPS = [
  "Website wird gelesen",
  "Markensignale werden erkannt",
  "Farben & Tonalität werden ausgewertet",
  "Markenprofil wird vorbereitet",
];

const EASE = [0.2, 0.7, 0.2, 1] as const;

function focusStepTitle() {
  window.requestAnimationFrame(() => {
    document.getElementById("onboarding-step-title")?.focus();
  });
}

export function OnboardingFlow({ bootstrap }: { bootstrap: OnboardingBootstrap }) {
  const router = useRouter();
  const reducedMotion = useReducedMotion() ?? false;
  const [step, setStep] = useState<OnboardingFlowStep>(bootstrap.initialStep);
  const [maxReached, setMaxReached] = useState<OnboardingFlowStep>(bootstrap.initialStep);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [saving, setSaving] = useState(false);
  const busyRef = useRef(false);

  const [breweryName, setBreweryName] = useState(
    bootstrap.settings?.breweryName?.trim() || "",
  );
  const [websiteUrl, setWebsiteUrl] = useState(
    bootstrap.settings?.brandWebsiteUrl?.trim() || "",
  );
  const [breweryError, setBreweryError] = useState("");

  const [brand, setBrand] = useState<OnboardingBrandDraft>(() => emptyBrandDraft(bootstrap.settings));
  const [scanning, setScanning] = useState(false);
  const [scanIndex, setScanIndex] = useState(0);
  const [brandReveal, setBrandReveal] = useState(brandLooksReady(emptyBrandDraft(bootstrap.settings)));
  const [brandError, setBrandError] = useState("");

  const [beers, setBeers] = useState<DashboardBeer[]>(bootstrap.beers);
  const [beerName, setBeerName] = useState("");
  const [beerStyle, setBeerStyle] = useState("helles");
  const [beerError, setBeerError] = useState("");

  const [team, setTeam] = useState<DashboardTeamMember[]>(bootstrap.team);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "editor" | "viewer">("editor");
  const [inviteError, setInviteError] = useState("");
  const [inviting, setInviting] = useState(false);
  const inviteLock = useRef(false);

  const [tokens, setTokens] = useState<number | null>(bootstrap.tokensRemaining);
  const [hasActivePlan, setHasActivePlan] = useState(bootstrap.hasActivePlan);
  const [completed, setCompleted] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [bonusError, setBonusError] = useState("");
  const finishLock = useRef(false);

  const goTo = useCallback(
    async (next: OnboardingFlowStep, dir: 1 | -1) => {
      setDirection(dir);
      setStep(next);
      setMaxReached((m) => (next > m ? next : m));
      await patchOnboarding({ flowVersion: 2, currentStep: next });
      focusStepTitle();
    },
    [],
  );

  const onJump = useCallback(
    (target: OnboardingFlowStep) => {
      if (saving || busyRef.current) return;
      if (target > maxReached) return;
      if (target === step) return;
      void goTo(target, target < step ? -1 : 1);
    },
    [goTo, maxReached, saving, step],
  );

  useEffect(() => {
    void patchOnboarding({ flowVersion: 2, currentStep: bootstrap.initialStep }).catch(() => {});
  }, [bootstrap.initialStep]);

  useEffect(() => {
    if (!scanning) return;
    const timers = [900, 1800, 2800].map((ms, i) =>
      window.setTimeout(() => setScanIndex(i + 1), ms),
    );
    return () => timers.forEach(clearTimeout);
  }, [scanning]);

  const saveBrewery = async () => {
    const name = breweryName.trim();
    if (!name) {
      setBreweryError("Bitte einen Brauereinamen eingeben.");
      return false;
    }
    setBreweryError("");
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
      setBreweryError(json.error || "Speichern fehlgeschlagen.");
      return false;
    }
    setBrand((b) => ({
      ...b,
      breweryName: name,
      brandWebsiteUrl: websiteUrl.trim(),
    }));
    return true;
  };

  const analyzeBrand = async () => {
    if (busyRef.current || scanning) return;
    const url = websiteUrl.trim() || brand.brandWebsiteUrl.trim();
    if (!url) {
      setBrandError("Bitte zuerst eine Website im Brauerei-Schritt hinterlegen.");
      return;
    }
    busyRef.current = true;
    setScanning(true);
    setScanIndex(0);
    setBrandError("");
    setBrandReveal(false);
    try {
      const res = await fetch("/api/brand/analyze-url", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ websiteUrl: url }),
        cache: "no-store",
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        suggestion?: Partial<OnboardingBrandDraft> & {
          referenceImageUrls?: string[];
          referenceImagePayloads?: { base64: string; mime: string }[];
          brandLabelReferenceUrl?: string;
        };
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
      };
      if (!brandLooksReady(next)) {
        throw new Error("Analyse lieferte kein vollständiges Markenprofil.");
      }
      setBrand(next);
      if (next.breweryName) setBreweryName(next.breweryName);
      window.setTimeout(() => setBrandReveal(true), 40);
    } catch (err) {
      setBrandError(err instanceof Error ? err.message : "Analyse fehlgeschlagen.");
    } finally {
      setScanning(false);
      busyRef.current = false;
    }
  };

  const saveBrand = async () => {
    if (!brandLooksReady(brand)) {
      setBrandError("Bitte Markenprofil analysieren oder vervollständigen.");
      return false;
    }
    setBrandError("");
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
    const res = await fetch("/api/brand/activate-profile", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    if (!res.ok) {
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      setBrandError(json.error || "Markenprofil konnte nicht gespeichert werden.");
      return false;
    }
    return true;
  };

  const persistBeers = async (next: DashboardBeer[]) => {
    const res = await fetch("/api/dashboard/my-beers", {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        beers: next.map((b) => ({
          id: b.id,
          name: b.name,
          bierstil: b.bierstil,
          flaschenTyp: b.flaschenTyp || "nrw_500",
          flaschenfarbe: b.flaschenfarbe || "braun",
          etikettUrl: b.etikettUrl || "",
          createdAt: b.createdAt || new Date().toISOString(),
        })),
      }),
    });
    if (!res.ok) {
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(json.error || "Sortiment konnte nicht gespeichert werden.");
    }
    const data = (await res.json()) as { beers?: DashboardBeer[] };
    setBeers(data.beers ?? next);
  };

  const addBeer = async () => {
    const name = beerName.trim();
    if (!name) {
      setBeerError("Bitte einen Sortennamen eingeben.");
      return;
    }
    setBeerError("");
    const next: DashboardBeer[] = [
      ...beers,
      {
        id: `beer-${crypto.randomUUID()}`,
        name: name.slice(0, 80),
        bierstil: (beerStyle.trim() || "helles").slice(0, 60),
        flaschenTyp: "nrw_500",
        flaschenfarbe: "braun",
        etikettUrl: "",
        createdAt: new Date().toISOString(),
      },
    ];
    try {
      await persistBeers(next);
      setBeerName("");
    } catch (err) {
      setBeerError(err instanceof Error ? err.message : "Speichern fehlgeschlagen.");
    }
  };

  const removeBeer = async (id: string) => {
    try {
      await persistBeers(beers.filter((b) => b.id !== id));
    } catch (err) {
      setBeerError(err instanceof Error ? err.message : "Löschen fehlgeschlagen.");
    }
  };

  const inviteMember = async () => {
    const email = inviteEmail.trim();
    if (!email || inviteLock.current) return;
    inviteLock.current = true;
    setInviting(true);
    setInviteError("");
    try {
      const res = await fetch("/api/dashboard/team", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role: inviteRole }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        members?: DashboardTeamMember[];
      };
      if (!res.ok) throw new Error(json.error || "Einladung fehlgeschlagen.");
      if (Array.isArray(json.members)) setTeam(json.members);
      else {
        const reload = await fetch("/api/dashboard/team", { cache: "no-store", credentials: "include" });
        if (reload.ok) {
          const data = (await reload.json()) as { members?: DashboardTeamMember[] };
          setTeam(data.members ?? []);
        }
      }
      setInviteEmail("");
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : "Einladung fehlgeschlagen.");
    } finally {
      setInviting(false);
      inviteLock.current = false;
    }
  };

  const finishFlow = async () => {
    if (completed || finishLock.current) return;
    finishLock.current = true;
    setFinishing(true);
    setBonusError("");
    // Bonus muss bestätigt sein (ok / already claimed / nicht berechtigt),
    // bevor completedAt geschrieben wird — sonst verliert ein berechtigter
    // User bei transientem Fehler den Retry-Pfad.
    try {
      const bonusRes = await fetch("/api/billing/onboarding-bonus", {
        method: "POST",
        credentials: "include",
      });
      if (!bonusRes.ok) {
        setBonusError(
          bonusRes.status >= 500
            ? "Token-Bonus konnte vorübergehend nicht bestätigt werden. Bitte erneut versuchen."
            : "Token-Bonus konnte nicht bestätigt werden. Bitte erneut versuchen.",
        );
        finishLock.current = false;
        setFinishing(false);
        return;
      }
      const data = (await bonusRes.json()) as {
        state?: { remainingTokens?: number; plan?: string | null };
      };
      if (typeof data.state?.remainingTokens === "number") {
        setTokens(data.state.remainingTokens);
      }
      if (data.state?.plan) setHasActivePlan(true);
    } catch {
      setBonusError("Verbindung unterbrochen. Token-Bonus bitte erneut anfordern.");
      finishLock.current = false;
      setFinishing(false);
      return;
    }

    try {
      await patchOnboarding({
        flowVersion: 2,
        currentStep: 5,
        completedAt: new Date().toISOString(),
        welcome: true,
        checklistDismissed: true,
        celebrated: true,
      });
      setCompleted(true);
    } catch {
      setBonusError("Abschluss konnte nicht gespeichert werden. Bitte erneut versuchen.");
      finishLock.current = false;
    } finally {
      setFinishing(false);
    }
  };

  const onNext = async () => {
    if (saving || busyRef.current || inviting || inviteLock.current) return;
    busyRef.current = true;
    setSaving(true);
    try {
      if (step === 1) {
        if (!(await saveBrewery())) return;
        await goTo(2, 1);
        return;
      }
      if (step === 2) {
        if (!(await saveBrand())) return;
        await goTo(3, 1);
        return;
      }
      if (step === 3) {
        await goTo(4, 1);
        return;
      }
      if (step === 4) {
        if (inviteEmail.trim()) await inviteMember();
        await goTo(5, 1);
        await finishFlow();
        return;
      }
    } finally {
      setSaving(false);
      busyRef.current = false;
    }
  };

  const onBack = () => {
    if (saving || step === 1) return;
    void goTo((step - 1) as OnboardingFlowStep, -1);
  };

  const onLater = async () => {
    if (saving || busyRef.current || inviting || inviteLock.current) return;
    busyRef.current = true;
    setSaving(true);
    try {
      await goTo(5, 1);
      await finishFlow();
    } finally {
      setSaving(false);
      busyRef.current = false;
    }
  };

  // Resume: Nutzer landet direkt auf Schritt 5 → Abschluss nachholen
  useEffect(() => {
    if (bootstrap.initialStep !== 5) return;
    const t = window.setTimeout(() => {
      void finishFlow();
    }, 0);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- nur Initial-Resume
  }, []);

  const variants = {
    enter: (dir: number) =>
      reducedMotion
        ? { opacity: 0 }
        : { opacity: 0, x: dir > 0 ? 14 : -14, y: dir > 0 ? 4 : 0 },
    center: { opacity: 1, x: 0, y: 0 },
    exit: (dir: number) =>
      reducedMotion ? { opacity: 0 } : { opacity: 0, x: dir > 0 ? -10 : 10 },
  };

  const footer =
    step < 5 ? (
      <div className="evg-onb-footer">
        <button
          type="button"
          className="evg-onb-btn evg-onb-btn--ghost"
          disabled={step === 1 || saving}
          onClick={onBack}
        >
          Zurück
        </button>
        <div style={{ flex: 1 }} />
        <button type="button" className="evg-onb-btn evg-onb-btn--text" disabled={saving || inviting} onClick={() => void onLater()}>
          Später einrichten
        </button>
        <button
          type="button"
          className="evg-onb-btn evg-onb-btn--primary"
          disabled={saving || scanning || inviting}
          onClick={() => void onNext()}
        >
          {saving || inviting ? "Speichert …" : step === 4 ? "Einladen und weiter" : "Weiter"}
        </button>
      </div>
    ) : null;

  return (
    <OnboardingShell
      step={step}
      maxReached={maxReached}
      reducedMotion={reducedMotion}
      profileName={bootstrap.profileName}
      onJump={onJump}
      footer={footer}
    >
      <AnimatePresence mode="wait" initial={false} custom={direction}>
        <motion.div
          key={`step-${step}`}
          custom={direction}
          variants={variants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{
            duration: reducedMotion ? 0.08 : direction > 0 ? 0.24 : 0.22,
            ease: EASE,
          }}
        >
          {step === 1 ? (
            <OnboardingBreweryStep
              breweryName={breweryName}
              websiteUrl={websiteUrl}
              error={breweryError}
              onChangeName={setBreweryName}
              onChangeWebsite={setWebsiteUrl}
            />
          ) : null}
          {step === 2 ? (
            <OnboardingBrandStep
              websiteUrl={websiteUrl || brand.brandWebsiteUrl}
              draft={brand}
              scanning={scanning}
              scanIndex={scanIndex}
              scanSteps={SCAN_STEPS}
              reveal={brandReveal}
              error={brandError}
              onAnalyze={() => void analyzeBrand()}
              onChangeTone={(v) => setBrand((b) => ({ ...b, brandTone: v }))}
              onChangeColors={(v) => setBrand((b) => ({ ...b, brandColors: v }))}
            />
          ) : null}
          {step === 3 ? (
            <OnboardingAssortmentStep
              beers={beers}
              draftName={beerName}
              draftStyle={beerStyle}
              error={beerError}
              reducedMotion={reducedMotion}
              onChangeName={setBeerName}
              onChangeStyle={setBeerStyle}
              onAdd={() => void addBeer()}
              onRemove={(id) => void removeBeer(id)}
            />
          ) : null}
          {step === 4 ? (
            <OnboardingTeamStep
              members={team}
              userEmail={bootstrap.userEmail}
              inviteEmail={inviteEmail}
              inviteRole={inviteRole}
              error={inviteError}
              inviting={inviting}
              onChangeEmail={setInviteEmail}
              onChangeRole={setInviteRole}
              onInvite={() => void inviteMember()}
            />
          ) : null}
          {step === 5 ? (
            <OnboardingCompleteStep
              profileName={bootstrap.profileName}
              breweryName={breweryName || brand.breweryName}
              brandReady={brandLooksReady(brand) || Boolean(bootstrap.settings?.brandTone)}
              beerCount={beers.length}
              teamCount={team.filter((m) => m.role !== "owner").length}
              tokens={tokens}
              hasActivePlan={hasActivePlan}
              finishing={finishing}
              completed={completed}
              bonusError={bonusError}
              onRetryBonus={() => void finishFlow()}
              onCreate={() => router.push(hasActivePlan ? "/inhalte-erstellen" : "/dashboard?tab=pricing")}
              onDashboard={() => router.push("/dashboard")}
            />
          ) : null}
        </motion.div>
      </AnimatePresence>
    </OnboardingShell>
  );
}
