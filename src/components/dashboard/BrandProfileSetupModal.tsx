"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { BrandReviewPanel } from "@/components/dashboard/BrandReviewPanel";
import { StudioButton } from "@/components/studio/ui";
import { StudioIcon } from "@/components/studio/icons";
import { fetchWithRetry, isTransientFetchError } from "@/lib/http/fetchWithRetry";
import { BRAND_SETTINGS_LIMITS, clampBrandSettingsFields } from "@/lib/dashboard/settingsPayload";
import { cn } from "@/lib/utils";

export type BrandProfileSource = "url" | "instagram" | "manual" | "skip";

export type BrandReferenceImagePayload = {
  base64: string;
  mime: string;
};

export type BrandScanSuggestion = {
  breweryName: string;
  brandTone: string;
  brandColors: string;
  brandDos: string;
  brandDonts: string;
  referenceImageUrls: string[];
  referenceImagePayloads?: BrandReferenceImagePayload[];
  brandInstagramUrl: string;
  brandWebsiteUrl: string;
  brandProfileSource: BrandProfileSource;
};

type Slot = {
  file: File | null;
  preview: string | null;
};

type ModalStep = "input" | "analyzing" | "review";
type InputTab = "url" | "instagram" | "manual";

type InstagramStatus = {
  configured: boolean;
  connected: boolean;
  username?: string;
  profileUrl?: string;
  expired?: boolean;
};

const EMPTY_SLOTS: Slot[] = Array.from({ length: 5 }, () => ({ file: null, preview: null }));

const ANALYSIS_STEPS = [
  "Website wird geladen…",
  "Texte werden erkannt…",
  "Bilder werden ausgewertet…",
  "Markenprofil wird erstellt…",
];

const INSTAGRAM_ANALYSIS_STEPS = [
  "Instagram-Posts werden geladen…",
  "Bilder werden heruntergeladen…",
  "Bildsprache wird ausgewertet…",
  "Markenprofil wird erstellt…",
];

type BrandProfileSetupModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  onSaved: (suggestion: BrandScanSuggestion) => Promise<void>;
};

function emptyReview(): BrandScanSuggestion {
  return {
    breweryName: "",
    brandTone: "",
    brandColors: "",
    brandDos: "",
    brandDonts: "",
    referenceImageUrls: [],
    brandInstagramUrl: "",
    brandWebsiteUrl: "",
    brandProfileSource: "url",
  };
}

function hasUsableReferenceUrls(urls: string[]): boolean {
  return urls.some((raw) => {
    try {
      const parsed = new URL(raw.trim());
      return parsed.protocol === "http:" || parsed.protocol === "https:";
    } catch {
      return false;
    }
  });
}

function buildActivateRequestBody(suggestion: BrandScanSuggestion): Record<string, unknown> {
  const { referenceImagePayloads, ...rest } = suggestion;
  const clamped = clampBrandSettingsFields({
    breweryName: rest.breweryName,
    brandTone: rest.brandTone,
    brandColors: rest.brandColors,
    brandDos: rest.brandDos,
    brandDonts: rest.brandDonts,
    brandInstagramUrl: rest.brandInstagramUrl,
    brandWebsiteUrl: rest.brandWebsiteUrl,
  });

  return {
    breweryName: clamped.breweryName ?? rest.breweryName.trim().slice(0, BRAND_SETTINGS_LIMITS.breweryName),
    brandTone: clamped.brandTone ?? rest.brandTone.trim().slice(0, BRAND_SETTINGS_LIMITS.brandTone),
    brandColors: clamped.brandColors ?? rest.brandColors.trim().slice(0, BRAND_SETTINGS_LIMITS.brandColors),
    brandDos: clamped.brandDos ?? rest.brandDos.trim().slice(0, BRAND_SETTINGS_LIMITS.brandDos),
    brandDonts: clamped.brandDonts ?? rest.brandDonts.trim().slice(0, BRAND_SETTINGS_LIMITS.brandDonts),
    brandInstagramUrl: rest.brandInstagramUrl,
    brandWebsiteUrl: rest.brandWebsiteUrl,
    brandProfileSource:
      rest.brandProfileSource === "manual"
        ? "manual"
        : rest.brandProfileSource === "instagram"
          ? "instagram"
          : "url",
    brandReferenceImageUrls: rest.referenceImageUrls,
    referenceImagePayloads:
      hasUsableReferenceUrls(rest.referenceImageUrls) || !referenceImagePayloads?.length
        ? undefined
        : referenceImagePayloads,
  };
}

async function verifyBrandProfileSaved(
  expected: Omit<BrandScanSuggestion, "referenceImagePayloads">,
): Promise<BrandScanSuggestion | null> {
  try {
    const params = new URLSearchParams({ breweryName: expected.breweryName.trim() });
    const res = await fetch(`/api/brand/profile-status?${params.toString()}`, {
      cache: "no-store",
      credentials: "include",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      saved?: boolean;
      settings?: {
        brandReferenceImageUrls?: string[];
      };
    };
    if (!data.saved) return null;

    return {
      ...expected,
      referenceImageUrls:
        Array.isArray(data.settings?.brandReferenceImageUrls) && data.settings.brandReferenceImageUrls.length > 0
          ? data.settings.brandReferenceImageUrls
          : expected.referenceImageUrls,
    };
  } catch {
    return null;
  }
}

function refreshAuthSessionInBackground(): void {
  void fetch("/api/auth/repair-session", { method: "POST", credentials: "include", cache: "no-store" }).catch(
    () => undefined,
  );
}

async function postActivateBrandProfile(suggestion: BrandScanSuggestion): Promise<BrandScanSuggestion> {
  const { referenceImagePayloads: _payloads, ...rest } = suggestion;
  const requestBody = buildActivateRequestBody(suggestion);

  const parseSuccess = async (res: Response): Promise<BrandScanSuggestion> => {
    let data: { error?: string; referenceImageUrls?: string[] };
    try {
      data = (await res.json()) as { error?: string; referenceImageUrls?: string[] };
    } catch {
      const verified = await verifyBrandProfileSaved(rest);
      if (verified) {
        refreshAuthSessionInBackground();
        return verified;
      }
      throw new Error(res.ok ? "Ungueltige Server-Antwort." : `Speichern fehlgeschlagen (HTTP ${res.status}).`);
    }

    if (!res.ok) {
      const verified = await verifyBrandProfileSaved(rest);
      if (verified) {
        refreshAuthSessionInBackground();
        return verified;
      }
      throw new Error(data.error ?? "Markenprofil konnte nicht gespeichert werden.");
    }

    refreshAuthSessionInBackground();
    const persistedUrls = Array.isArray(data.referenceImageUrls) ? data.referenceImageUrls.filter(Boolean) : [];
    return {
      ...rest,
      referenceImageUrls: persistedUrls.length > 0 ? persistedUrls : rest.referenceImageUrls,
    };
  };

  try {
    const res = await fetch("/api/brand/activate-profile", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "include",
      cache: "no-store",
      body: JSON.stringify(requestBody),
    });
    return await parseSuccess(res);
  } catch (error) {
    if (isTransientFetchError(error)) {
      await new Promise((resolve) => window.setTimeout(resolve, 1200));
      const verified = await verifyBrandProfileSaved(rest);
      if (verified) {
        refreshAuthSessionInBackground();
        return verified;
      }
    }
    throw error;
  }
}

function formatAnalysisError(error: unknown, phase: "analyze" | "save" = "analyze"): string {
  if (error instanceof TypeError && /failed to fetch|networkerror|load failed/i.test(error.message)) {
    if (phase === "save") {
      return "Profil konnte nicht gespeichert werden (Verbindungsabbruch). Bitte erneut versuchen.";
    }
    return "Die Verbindung wurde unterbrochen — die Analyse kann bis zu 2 Min. dauern. Bitte erneut versuchen und das Fenster offen lassen.";
  }
  if (error instanceof Error) return error.message;
  return phase === "save" ? "Speichern fehlgeschlagen." : "Analyse fehlgeschlagen.";
}

async function postBrandAnalyzeUrl(url: string): Promise<Response> {
  return fetchWithRetry(
    "/api/brand/analyze-url",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "include",
      cache: "no-store",
      body: JSON.stringify({ websiteUrl: url }),
    },
    { retries: 2, baseDelayMs: 1500 },
  );
}

export function BrandProfileSetupModal({ open, onOpenChange, title, onSaved }: BrandProfileSetupModalProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [inputTab, setInputTab] = useState<InputTab>("url");
  const [step, setStep] = useState<ModalStep>("input");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [slots, setSlots] = useState<Slot[]>(EMPTY_SLOTS);
  const [instagramUrl, setInstagramUrl] = useState("");
  const [instagramStatus, setInstagramStatus] = useState<InstagramStatus>({ configured: false, connected: false });
  const [instagramNotice, setInstagramNotice] = useState("");
  const [instagramStatusLoading, setInstagramStatusLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [analysisStepIndex, setAnalysisStepIndex] = useState(0);
  const [review, setReview] = useState<BrandScanSuggestion>(emptyReview);
  const [sourceMeta, setSourceMeta] = useState<{ confidence?: string; pageTitle?: string } | null>(null);

  const filledCount = slots.filter((s) => s.file).length;
  const modalTitle = title ?? "Marke einlesen";
  const analysisSteps = inputTab === "instagram" ? INSTAGRAM_ANALYSIS_STEPS : ANALYSIS_STEPS;
  const instagramNeedsConnect = !instagramStatus.connected || instagramStatus.expired;

  const loadInstagramStatus = useCallback(async () => {
    setInstagramStatusLoading(true);
    try {
      const res = await fetch("/api/brand/instagram/status", { cache: "no-store", credentials: "include" });
      if (!res.ok) return;
      const data = (await res.json()) as InstagramStatus & { ok?: boolean };
      setInstagramStatus({
        configured: Boolean(data.configured),
        connected: Boolean(data.connected),
        username: typeof data.username === "string" ? data.username : undefined,
        profileUrl: typeof data.profileUrl === "string" ? data.profileUrl : undefined,
        expired: Boolean(data.expired),
      });
    } catch {
      /* ignore */
    } finally {
      setInstagramStatusLoading(false);
    }
  }, []);

  const clearInstagramQueryParams = useCallback(() => {
    const p = new URLSearchParams(searchParams.toString());
    p.delete("instagram");
    p.delete("instagramError");
    p.delete("brandInput");
    const qs = p.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [pathname, router, searchParams]);

  const resetForm = useCallback(() => {
    setInputTab("url");
    setStep("input");
    setWebsiteUrl("");
    setSlots(EMPTY_SLOTS.map(() => ({ file: null, preview: null })));
    setInstagramUrl("");
    setInstagramNotice("");
    setError("");
    setAnalysisStepIndex(0);
    setReview(emptyReview());
    setSourceMeta(null);
  }, []);

  const handleOpenChange = (next: boolean) => {
    if (busy) return;
    if (!next) resetForm();
    onOpenChange(next);
  };

  useEffect(() => {
    if (step !== "analyzing") return;
    setAnalysisStepIndex(0);
    const interval = window.setInterval(() => {
      setAnalysisStepIndex((prev) => (prev < analysisSteps.length - 1 ? prev + 1 : prev));
    }, 2200);
    return () => window.clearInterval(interval);
  }, [step, analysisSteps.length]);

  useEffect(() => {
    if (!open) return;
    if (searchParams.get("brandInput") === "instagram") {
      setInputTab("instagram");
    }
    const igResult = searchParams.get("instagram");
    if (!igResult) return;

    if (igResult === "connected") {
      setInputTab("instagram");
      setInstagramNotice("Instagram erfolgreich verbunden. Du kannst jetzt deine Posts analysieren.");
      setError("");
      void loadInstagramStatus();
    } else if (igResult === "denied") {
      setInputTab("instagram");
      setError("Instagram-Verbindung abgebrochen.");
    } else if (igResult === "config") {
      setInputTab("instagram");
      setError("Instagram-OAuth ist auf dem Server noch nicht konfiguriert.");
    } else if (igResult === "state") {
      setInputTab("instagram");
      setError("Instagram-Verbindung ungueltig (Sitzung abgelaufen). Bitte erneut verbinden.");
    } else if (igResult === "error") {
      setInputTab("instagram");
      const detail = searchParams.get("instagramError")?.trim();
      setError(detail || "Instagram-Verbindung fehlgeschlagen.");
    }
    clearInstagramQueryParams();
  }, [open, searchParams, loadInstagramStatus, clearInstagramQueryParams]);

  useEffect(() => {
    if (!open || inputTab !== "instagram") return;
    void loadInstagramStatus();
  }, [open, inputTab, loadInstagramStatus]);

  const setSlotFile = (index: number, file: File | null) => {
    setSlots((prev) => {
      const next = [...prev];
      const old = next[index];
      if (old?.preview) URL.revokeObjectURL(old.preview);
      if (!file) {
        next[index] = { file: null, preview: null };
        return next;
      }
      const preview = URL.createObjectURL(file);
      next[index] = { file, preview };
      return next;
    });
  };

  const applySuggestion = (s: BrandScanSuggestion) => {
    setReview(s);
    setStep("review");
  };

  const activateBrandProfile = async (suggestion: BrandScanSuggestion) => {
    const saved = await postActivateBrandProfile(suggestion);
    try {
      await onSaved(saved);
    } catch (syncError) {
      console.warn("[brand-profile] UI-Sync nach Speichern fehlgeschlagen:", syncError);
    }
    resetForm();
    onOpenChange(false);
  };

  const runUrlAnalysis = async () => {
    const url = websiteUrl.trim();
    if (!url) {
      setError("Bitte die Website deiner Marke eingeben.");
      return;
    }
    if (/instagram\.com/i.test(url)) {
      setInputTab("instagram");
      setError("Bitte verbinde dein Instagram-Konto im Tab „Instagram“.");
      return;
    }

    setBusy(true);
    setError("");
    setStep("analyzing");
    try {
      const res = await postBrandAnalyzeUrl(url);
      let data: {
        error?: string;
        suggestion?: Partial<BrandScanSuggestion>;
        sourceMeta?: { confidence?: string; pageTitle?: string };
      };
      try {
        data = (await res.json()) as typeof data;
      } catch {
        throw new Error(res.ok ? "Ungueltige Server-Antwort." : `Analyse fehlgeschlagen (HTTP ${res.status}).`);
      }
      if (!res.ok) throw new Error(data.error ?? `Analyse fehlgeschlagen (HTTP ${res.status}).`);

      const s = data.suggestion;
      if (!s?.breweryName || !s?.brandTone || !s?.brandColors || !s?.brandDos || !s?.brandDonts) {
        throw new Error("Ungueltige Server-Antwort.");
      }

      const suggestion: BrandScanSuggestion = {
        breweryName: s.breweryName,
        brandTone: s.brandTone,
        brandColors: s.brandColors,
        brandDos: s.brandDos,
        brandDonts: s.brandDonts,
        referenceImageUrls: Array.isArray(s.referenceImageUrls) ? s.referenceImageUrls : [],
        referenceImagePayloads: Array.isArray(s.referenceImagePayloads) ? s.referenceImagePayloads : undefined,
        brandInstagramUrl: "",
        brandWebsiteUrl: typeof s.brandWebsiteUrl === "string" ? s.brandWebsiteUrl : url,
        brandProfileSource: "url",
      };
      setSourceMeta(data.sourceMeta ?? null);
      applySuggestion(suggestion);
    } catch (e) {
      setStep("input");
      setError(formatAnalysisError(e, "analyze"));
    } finally {
      setBusy(false);
    }
  };

  const runManualScan = async () => {
    if (filledCount !== 5) {
      setError("Bitte genau 5 Screenshots deiner Instagram-Posts auswaehlen.");
      return;
    }
    setBusy(true);
    setError("");
    setStep("analyzing");
    try {
      const fd = new FormData();
      for (const slot of slots) {
        if (slot.file) fd.append("image", slot.file);
      }
      if (instagramUrl.trim()) fd.append("instagramUrl", instagramUrl.trim());

      const res = await fetch("/api/brand/scan-instagram-posts", {
        method: "POST",
        body: fd,
        credentials: "include",
      });
      let data: { error?: string; suggestion?: Partial<BrandScanSuggestion> };
      try {
        data = (await res.json()) as typeof data;
      } catch {
        throw new Error(res.ok ? "Ungueltige Server-Antwort." : "Auswertung fehlgeschlagen.");
      }
      if (!res.ok) throw new Error(data.error ?? "Auswertung fehlgeschlagen.");

      const s = data.suggestion;
      if (!s?.breweryName || !s?.brandTone || !s?.brandColors || !s?.brandDos || !s?.brandDonts) {
        throw new Error("Ungueltige Server-Antwort.");
      }

      applySuggestion({
        breweryName: s.breweryName,
        brandTone: s.brandTone,
        brandColors: s.brandColors,
        brandDos: s.brandDos,
        brandDonts: s.brandDonts,
        referenceImageUrls: Array.isArray(s.referenceImageUrls) ? s.referenceImageUrls : [],
        brandInstagramUrl: typeof s.brandInstagramUrl === "string" ? s.brandInstagramUrl : instagramUrl.trim(),
        brandWebsiteUrl: "",
        brandProfileSource: "manual",
      });
      setSourceMeta(null);
    } catch (e) {
      setStep("input");
      setError(formatAnalysisError(e, "analyze"));
    } finally {
      setBusy(false);
    }
  };

  const connectInstagram = () => {
    const returnTo = `${pathname}?tab=brand&openBrand=1&brandInput=instagram`;
    window.location.href = `/api/brand/instagram/connect?returnTo=${encodeURIComponent(returnTo)}`;
  };

  const disconnectInstagram = async () => {
    setBusy(true);
    setError("");
    setInstagramNotice("");
    try {
      const res = await fetch("/api/brand/instagram/disconnect", {
        method: "POST",
        credentials: "include",
        cache: "no-store",
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Trennen fehlgeschlagen.");
      setInstagramStatus({ configured: instagramStatus.configured, connected: false });
      setInstagramNotice("Instagram-Verbindung getrennt.");
    } catch (e) {
      setError(formatAnalysisError(e, "analyze"));
    } finally {
      setBusy(false);
    }
  };

  const runInstagramScan = async () => {
    if (!instagramStatus.connected || instagramStatus.expired) {
      setError("Bitte Instagram zuerst verbinden.");
      return;
    }
    setBusy(true);
    setError("");
    setInstagramNotice("");
    setStep("analyzing");
    try {
      const res = await fetchWithRetry(
        "/api/brand/instagram/scan",
        { method: "POST", credentials: "include", cache: "no-store" },
        { retries: 1, baseDelayMs: 1500 },
      );
      let data: {
        error?: string;
        suggestion?: Partial<BrandScanSuggestion>;
        sourceMeta?: { confidence?: string; pageTitle?: string };
      };
      try {
        data = (await res.json()) as typeof data;
      } catch {
        throw new Error(res.ok ? "Ungueltige Server-Antwort." : `Analyse fehlgeschlagen (HTTP ${res.status}).`);
      }
      if (!res.ok) throw new Error(data.error ?? `Analyse fehlgeschlagen (HTTP ${res.status}).`);

      const s = data.suggestion;
      if (!s?.breweryName || !s?.brandTone || !s?.brandColors || !s?.brandDos || !s?.brandDonts) {
        throw new Error("Ungueltige Server-Antwort.");
      }

      const suggestion: BrandScanSuggestion = {
        breweryName: s.breweryName,
        brandTone: s.brandTone,
        brandColors: s.brandColors,
        brandDos: s.brandDos,
        brandDonts: s.brandDonts,
        referenceImageUrls: Array.isArray(s.referenceImageUrls) ? s.referenceImageUrls : [],
        brandInstagramUrl: typeof s.brandInstagramUrl === "string" ? s.brandInstagramUrl : instagramStatus.profileUrl ?? "",
        brandWebsiteUrl: "",
        brandProfileSource: "instagram",
      };
      setSourceMeta(data.sourceMeta ?? null);
      applySuggestion(suggestion);
    } catch (e) {
      setStep("input");
      setError(formatAnalysisError(e, "analyze"));
    } finally {
      setBusy(false);
    }
  };

  const saveReview = async () => {
    if (
      !review.breweryName.trim() ||
      !review.brandTone.trim() ||
      !review.brandColors.trim() ||
      !review.brandDos.trim() ||
      !review.brandDonts.trim()
    ) {
      setError("Bitte alle Markenprofil-Felder ausfuellen.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await activateBrandProfile(review);
    } catch (e) {
      setError(formatAnalysisError(e, "save"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className={cn(
          "evg-studio studio-modal-mobile fixed left-1/2 top-1/2 z-[130] max-h-[min(92vh,720px)] w-[min(100%,560px)] -translate-x-1/2 -translate-y-1/2 gap-0 overflow-hidden border-[var(--line-strong)] bg-[var(--bg-2)] p-0 text-[var(--tx-0)] shadow-[var(--sh-pop)] sm:max-w-[560px] [&>button.group]:hidden",
          step === "review" && "flex flex-col",
        )}
        onPointerDownOutside={(e) => {
          if (busy) e.preventDefault();
        }}
        onEscapeKeyDown={(e) => {
          if (busy) e.preventDefault();
        }}
      >
        <DialogTitle className="sr-only">
          {step === "review" ? "Profil prüfen" : step === "analyzing" ? "Marke wird analysiert" : modalTitle}
        </DialogTitle>
        <DialogDescription className="sr-only">
          {step === "review"
            ? "Passe den KI-Vorschlag an, bevor du dein Markenprofil aktivierst."
            : step === "analyzing"
              ? analysisSteps[analysisStepIndex]
              : "Gib die Website deiner Marke ein oder verbinde Instagram — EvGlab erkennt Tonalität, Farben und Bildsprache."}
        </DialogDescription>

        <DialogClose asChild>
          <button
            type="button"
            className="studio-modal-close"
            aria-label="Schließen"
            disabled={busy}
            onClick={(event) => {
              if (busy) {
                event.preventDefault();
                return;
              }
              handleOpenChange(false);
            }}
          >
            <StudioIcon name="x" size={16} />
          </button>
        </DialogClose>

        {step === "review" ? (
          <>
            <BrandReviewPanel
              review={review}
              sourceMeta={sourceMeta}
              busy={busy}
              error={error}
              onChange={(patch) => setReview((prev) => ({ ...prev, ...patch }))}
              onBack={() => {
                setStep("input");
                setError("");
              }}
              onActivate={() => void saveReview()}
            />
          </>
        ) : (
        <div className="relative max-h-[min(92vh,720px)] overflow-y-auto px-6 pb-6 pt-6">

          {step === "input" ? (
            <>
              <div className="studio-modal-eyebrow">
                <span className="dot" aria-hidden="true" />
                Markenprofil
              </div>
              <h2 className="studio-modal-title">{modalTitle}</h2>
              <p className="studio-modal-sub">
                Website einlesen oder Instagram verbinden — EvGlab erkennt Tonalität, Farben und Bildsprache für konsistente Motive.
              </p>

              <div className="studio-modal-tabs" role="tablist">
                <button
                  type="button"
                  role="tab"
                  aria-selected={inputTab === "url"}
                  className={cn("studio-modal-tab", inputTab === "url" && "on")}
                  onClick={() => setInputTab("url")}
                >
                  <StudioIcon name="link" size={15} />
                  Website
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={inputTab === "instagram"}
                  className={cn("studio-modal-tab", inputTab === "instagram" && "on")}
                  onClick={() => setInputTab("instagram")}
                >
                  <StudioIcon name="media" size={15} />
                  Instagram
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={inputTab === "manual"}
                  className={cn("studio-modal-tab", inputTab === "manual" && "on")}
                  onClick={() => setInputTab("manual")}
                >
                  <StudioIcon name="pencil" size={15} />
                  Screenshots
                </button>
              </div>

              {inputTab === "url" ? (
                <div style={{ marginTop: 20 }}>
                  <span className="studio-field-label">Website deiner Marke</span>
                  <div className="studio-field-with-icon" style={{ marginTop: 8 }}>
                    <span className="studio-field-icon">
                      <StudioIcon name="globe" size={16} />
                    </span>
                    <input
                      className="studio-field"
                      value={websiteUrl}
                      onChange={(e) => setWebsiteUrl(e.target.value)}
                      disabled={busy}
                      placeholder="https://www.beispiel.de"
                      aria-label="Website deiner Marke"
                    />
                  </div>
                  <p className="studio-faint" style={{ marginTop: 10, fontSize: 11.5, lineHeight: 1.45 }}>
                    Analysiert öffentliche Texte und Bilder deiner Website.
                  </p>
                </div>
              ) : inputTab === "instagram" ? (
                <div style={{ marginTop: 20 }}>
                  {!instagramStatus.configured ? (
                    <>
                      <p className="studio-faint" style={{ fontSize: 12.5, lineHeight: 1.5 }}>
                        Instagram-Verbindung ist auf diesem Server noch nicht eingerichtet (META_APP_ID / META_APP_SECRET).
                      </p>
                    </>
                  ) : instagramStatusLoading ? (
                    <p className="studio-faint" style={{ fontSize: 12.5 }}>Verbindungsstatus wird geladen…</p>
                  ) : instagramStatus.connected && !instagramStatus.expired ? (
                    <>
                      <div className="studio-card" style={{ padding: "14px 16px" }}>
                        <p style={{ fontSize: 13, fontWeight: 600 }}>
                          @{instagramStatus.username ?? "instagram"}
                        </p>
                        <p className="studio-faint" style={{ marginTop: 6, fontSize: 11.5, lineHeight: 1.45 }}>
                          Verbunden — EvGlab liest deine letzten Posts über die Meta Graph API aus.
                        </p>
                      </div>
                      <button
                        type="button"
                        className="studio-faint"
                        style={{ marginTop: 12, fontSize: 11.5, textDecoration: "underline" }}
                        disabled={busy}
                        onClick={() => void disconnectInstagram()}
                      >
                        Verbindung trennen
                      </button>
                    </>
                  ) : (
                    <>
                      <p className="studio-faint" style={{ fontSize: 12.5, lineHeight: 1.5 }}>
                        Verbinde dein Instagram Business- oder Creator-Konto (an eine Facebook-Seite gekoppelt). Danach
                        analysieren wir automatisch deine letzten Posts.
                      </p>
                      {instagramStatus.expired ? (
                        <p style={{ marginTop: 10, fontSize: 12, color: "var(--warn)" }}>
                          Deine Verbindung ist abgelaufen — bitte erneut verbinden.
                        </p>
                      ) : null}
                    </>
                  )}
                  {instagramNotice ? (
                    <p style={{ marginTop: 12, fontSize: 12.5, color: "var(--ok, #3d9a6a)" }}>{instagramNotice}</p>
                  ) : null}
                </div>
              ) : (
                <div style={{ marginTop: 20 }}>
                  <span className="studio-field-label">5 Instagram-Posts (Pflicht)</span>
                  <div className="studio-modal-ref-grid" style={{ marginTop: 10, display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8 }}>
                    {slots.map((slot, i) => (
                      <label
                        key={i}
                        className="studio-card"
                        style={{
                          aspectRatio: "1",
                          display: "grid",
                          placeItems: "center",
                          cursor: "pointer",
                          overflow: "hidden",
                          borderStyle: slot.file ? "solid" : "dashed",
                        }}
                      >
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          className="sr-only"
                          disabled={busy}
                          onChange={(e) => {
                            const f = e.target.files?.[0] ?? null;
                            e.target.value = "";
                            setSlotFile(i, f);
                          }}
                        />
                        {slot.preview ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={slot.preview} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        ) : (
                          <span className="studio-faint" style={{ fontSize: 10 }}>
                            {i + 1}
                          </span>
                        )}
                      </label>
                    ))}
                  </div>
                  <p className="studio-faint" style={{ marginTop: 8, fontSize: 11 }}>
                    {filledCount} / 5 Bilder
                  </p>
                  <div style={{ marginTop: 14 }}>
                    <span className="studio-field-label">Instagram-Profil (optional)</span>
                    <input
                      className="studio-field"
                      style={{ marginTop: 8 }}
                      value={instagramUrl}
                      onChange={(e) => setInstagramUrl(e.target.value)}
                      disabled={busy}
                      placeholder="https://www.instagram.com/deinemarke/"
                    />
                  </div>
                </div>
              )}
            </>
          ) : null}

          {step === "analyzing" ? (
            <div style={{ padding: "48px 12px", textAlign: "center" }}>
              <Loader2 className="mx-auto size-10 animate-spin" style={{ color: "var(--acc)" }} />
              <p style={{ marginTop: 16, fontSize: 14, fontWeight: 600 }}>{analysisSteps[analysisStepIndex]}</p>
              <p className="studio-faint" style={{ marginTop: 8, fontSize: 12 }}>
                Das kann bis zu 2 Minuten dauern — bitte Fenster offen lassen.
              </p>
            </div>
          ) : null}

          {error ? <p style={{ marginTop: 12, fontSize: 13, color: "var(--warn)" }}>{error}</p> : null}
        </div>
        )}

        {step !== "analyzing" && step !== "review" ? (
          <div className="studio-modal-foot">
            <StudioButton type="button" variant="ghost" size="sm" disabled={busy} onClick={() => handleOpenChange(false)}>
              Abbrechen
            </StudioButton>
            <StudioButton
              type="button"
              variant="primary"
              size="sm"
              disabled={
                busy ||
                (inputTab === "manual" && filledCount !== 5) ||
                (inputTab === "url" && !websiteUrl.trim()) ||
                (inputTab === "instagram" && (!instagramStatus.configured || instagramStatusLoading))
              }
              onClick={() => {
                if (inputTab === "url") void runUrlAnalysis();
                else if (inputTab === "instagram") {
                  if (instagramNeedsConnect) connectInstagram();
                  else void runInstagramScan();
                } else void runManualScan();
              }}
            >
              {busy ? (
                "KI analysiert…"
              ) : inputTab === "url" ? (
                <>
                  <StudioIcon name="spark" size={15} />
                  Website analysieren
                </>
              ) : inputTab === "instagram" ? (
                instagramNeedsConnect ? (
                  <>
                    <StudioIcon name="media" size={15} />
                    Instagram verbinden
                  </>
                ) : (
                  <>
                    <StudioIcon name="spark" size={15} />
                    Posts analysieren
                  </>
                )
              ) : (
                "Auswerten"
              )}
            </StudioButton>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
