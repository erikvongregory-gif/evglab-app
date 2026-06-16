"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { Copy, Download, Loader2, RotateCcw } from "lucide-react";
import { ClaudeChatInput, type InputChoiceOption } from "@/components/ui/claude-style-ai-input";
import { StudioButton, StudioPageHeader } from "@/components/studio/ui";
import {
  estimateGenerationProgress,
  VIDEO_GENERATION_PROGRESS_MAX_WAIT_MS,
} from "@/lib/kie/generationProgress";
import { calculateSeedanceVideoTokenCost } from "@/lib/billing/generationTokenCost";
import { SEEDANCE_VIDEO_TOKEN_HINT } from "@/lib/billing/planCatalog";
import { durationForPreset } from "@/lib/kie/seedanceTaskInput";
import { buildPromptSegments, composeVideoPrompt } from "@/lib/video-studio/composePrompt";
import {
  choicesForStep,
  getStepMeta,
  nextStep,
  type HookTypeId,
  type SettingTypeId,
  type VideoPresetId,
  type VideoStudioBrief,
  type VideoStudioStepId,
} from "@/lib/video-studio/options";

type CreateVideosViewProps = {
  breweryName?: string;
};

function applyChoice(brief: VideoStudioBrief, step: VideoStudioStepId, choice: InputChoiceOption): VideoStudioBrief {
  switch (step) {
    case "preset":
      return { ...brief, presetId: choice.id as VideoPresetId };
    case "hook_type":
      return { ...brief, hookTypeId: choice.id as HookTypeId };
    case "hook":
      return { ...brief, hookId: choice.id };
    case "setting_type":
      return { ...brief, settingTypeId: choice.id as SettingTypeId };
    case "setting":
      return { ...brief, settingId: choice.id };
    case "speaker":
      return { ...brief, speakerId: choice.id as VideoStudioBrief["speakerId"] };
    case "aspect":
      return { ...brief, aspectRatioId: choice.id as VideoStudioBrief["aspectRatioId"], platformId: "seedance_2" };
    default:
      return brief;
  }
}

function buildMediaProxyUrl(sourceUrl: string, taskId: string, download = false): string {
  const params = new URLSearchParams({
    url: sourceUrl,
    taskId,
  });
  if (download) params.set("download", "1");
  return `/api/kie/media?${params.toString()}`;
}

async function pollSeedanceTask(
  taskId: string,
  signal: AbortSignal,
  onProgress?: (progress: number) => void,
  onStatus?: (message: string) => void,
): Promise<string> {
  const deadlineMs = Date.now() + VIDEO_GENERATION_PROGRESS_MAX_WAIT_MS;
  let consecutiveTransientErrors = 0;
  const maxTransientInARow = 8;
  const startedAt = Date.now();

  while (Date.now() < deadlineMs) {
    if (signal.aborted) throw new Error("Generierung abgebrochen.");

    const elapsedSec = Math.round((Date.now() - startedAt) / 1000);
    const waitMs = elapsedSec < 60 ? 3000 : elapsedSec < 240 ? 5000 : 8000;
    await new Promise((resolve) => setTimeout(resolve, waitMs));
    if (signal.aborted) throw new Error("Generierung abgebrochen.");

    let res: Response;
    try {
      res = await fetch(`/api/kie/nano-banana/task-status?taskId=${encodeURIComponent(taskId)}`, {
        cache: "no-store",
        signal,
      });
    } catch {
      if (signal.aborted) throw new Error("Generierung abgebrochen.");
      consecutiveTransientErrors += 1;
      if (consecutiveTransientErrors >= maxTransientInARow) throw new Error("Statusabfrage fehlgeschlagen (Netzwerk).");
      continue;
    }

    if (res.status === 429 || res.status === 502 || res.status === 503 || res.status === 504) {
      consecutiveTransientErrors += 1;
      if (consecutiveTransientErrors >= maxTransientInARow) {
        throw new Error(`Statusabfrage wiederholt fehlgeschlagen (HTTP ${res.status}).`);
      }
      continue;
    }

    const data = (await res.json()) as {
      state?: string;
      videoUrl?: string | null;
      mediaUrl?: string | null;
      imageUrl?: string | null;
      error?: string;
      progress?: number | null;
    };

    if (!res.ok) throw new Error(data.error ?? "Statusabfrage fehlgeschlagen.");
    consecutiveTransientErrors = 0;

    const elapsedMs = Date.now() - startedAt;
    onProgress?.(estimateGenerationProgress(elapsedMs, data.progress, VIDEO_GENERATION_PROGRESS_MAX_WAIT_MS));

    const state = (data.state ?? "").toLowerCase();
    const resultUrl = data.videoUrl || data.mediaUrl || data.imageUrl;
    if (["success", "succeeded", "completed", "done"].includes(state) && resultUrl) {
      onProgress?.(100);
      return resultUrl;
    }
    if (["failed", "error", "cancelled", "canceled"].includes(state)) {
      throw new Error("Seedance 2 konnte das Video nicht generieren.");
    }

    if (elapsedSec > 120) {
      onStatus?.(`Seedance 2 arbeitet noch (~${Math.floor(elapsedSec / 60)} Min.) — typisch ca. 5 Minuten …`);
    } else if (elapsedSec > 45) {
      onStatus?.(`Seedance 2 generiert (~${elapsedSec}s) …`);
    } else {
      onStatus?.("Video-Generierung gestartet …");
    }
  }

  throw new Error("Video-Generierung dauert ungewöhnlich lange — bitte später erneut versuchen.");
}

export function CreateVideosView({ breweryName }: CreateVideosViewProps) {
  const [step, setStep] = useState<VideoStudioStepId>("brief");
  const [brief, setBrief] = useState<VideoStudioBrief>({ initialBrief: "" });
  const [inputValue, setInputValue] = useState("");
  const [copied, setCopied] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [generationStatus, setGenerationStatus] = useState("");
  const [generationError, setGenerationError] = useState("");
  const [videoTaskId, setVideoTaskId] = useState<string | null>(null);
  const [videoSourceUrl, setVideoSourceUrl] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const stepMeta = getStepMeta(step);
  const choiceOptions = stepMeta.inputMode === "choice" ? choicesForStep(step, brief) : undefined;
  const composed = useMemo(() => composeVideoPrompt(brief), [brief]);
  const segments = useMemo(() => buildPromptSegments(brief), [brief]);
  const estimatedTokenCost = useMemo(
    () =>
      calculateSeedanceVideoTokenCost({
        resolution: "720p",
        duration: durationForPreset(brief.presetId),
        generateAudio: false,
      }),
    [brief.presetId],
  );
  const videoPreviewUrl =
    videoSourceUrl && videoTaskId ? buildMediaProxyUrl(videoSourceUrl, videoTaskId) : null;
  const videoDownloadUrl =
    videoSourceUrl && videoTaskId ? buildMediaProxyUrl(videoSourceUrl, videoTaskId, true) : null;

  const advance = useCallback((nextBrief: VideoStudioBrief) => {
    const following = nextStep(step);
    setBrief(nextBrief);
    setInputValue("");
    if (following) setStep(following);
  }, [step]);

  const handleSend = useCallback(
    (message: string) => {
      const trimmed = message.trim();
      if (!trimmed) return;
      if (step === "brief") {
        advance({ ...brief, initialBrief: trimmed });
        return;
      }
      if (step === "product") {
        advance({ ...brief, productLabel: trimmed });
      }
    },
    [advance, brief, step],
  );

  const handleChoice = useCallback(
    (choice: InputChoiceOption) => {
      advance(applyChoice(brief, step, choice));
    },
    [advance, brief, step],
  );

  const handleReset = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setStep("brief");
    setBrief({ initialBrief: "" });
    setInputValue("");
    setCopied(false);
    setGenerating(false);
    setGenerationProgress(0);
    setGenerationStatus("");
    setGenerationError("");
    setVideoTaskId(null);
    setVideoSourceUrl(null);
  };

  const handleCopy = async () => {
    if (!composed?.englishPrompt) return;
    await navigator.clipboard.writeText(composed.englishPrompt);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  const handleGenerateVideo = async () => {
    if (!composed?.englishPrompt || generating) return;
    setGenerating(true);
    setGenerationError("");
    setGenerationProgress(8);
    setGenerationStatus("Prompt wird an Seedance 2 gesendet …");
    setVideoSourceUrl(null);
    setVideoTaskId(null);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/kie/seedance/create-task", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: composed.englishPrompt,
          aspectRatio: brief.aspectRatioId,
          presetId: brief.presetId,
          duration: durationForPreset(brief.presetId),
          resolution: "720p",
          generateAudio: false,
        }),
        signal: controller.signal,
      });
      const data = (await res.json()) as {
        error?: string;
        taskId?: string;
        billing?: { remainingTokens?: number; consumed?: number };
      };
      if (!res.ok || !data.taskId) {
        throw new Error(data.error ?? "Video-Task konnte nicht erstellt werden.");
      }

      if (typeof data.billing?.remainingTokens === "number") {
        window.dispatchEvent(new CustomEvent("evglab-billing-updated"));
      }

      setVideoTaskId(data.taskId);
      setGenerationStatus("Seedance 2 generiert dein Video — das kann einige Minuten dauern …");

      const sourceUrl = await pollSeedanceTask(
        data.taskId,
        controller.signal,
        setGenerationProgress,
        setGenerationStatus,
      );
      setVideoSourceUrl(sourceUrl);
      setGenerationStatus("Video fertig.");
    } catch (error) {
      setGenerationError(error instanceof Error ? error.message : "Video-Generierung fehlgeschlagen.");
    } finally {
      setGenerating(false);
      abortRef.current = null;
    }
  };

  const greeting = breweryName ? `Was für ein Video braucht ${breweryName}?` : "Was für ein Video brauchst du?";

  return (
    <>
      <StudioPageHeader
        eyebrow="Videos Erstellen"
        title={
          <>
            Story-driven <em>Reels & Shorts</em>
          </>
        }
        subtitle="Beschreibe deine Idee — danach generiert Seedance 2 dein Video."
      />

      <div className="evg-video-create" style={{ marginTop: 28, maxWidth: 760 }}>
        {step !== "brief" && segments.length > 0 ? (
          <div className="evg-video-create__summary" aria-live="polite">
            <p className="evg-video-create__summary-label">Dein Video entsteht …</p>
            <p className="evg-video-create__summary-text">
              {segments.map((seg, i) => (
                <span key={`${seg.text}-${i}`}>
                  {i > 0 ? " · " : ""}
                  <span className={seg.highlight ? "evg-video-create__summary-highlight" : undefined}>{seg.text}</span>
                </span>
              ))}
            </p>
          </div>
        ) : (
          <p className="evg-video-create__greeting">{greeting}</p>
        )}

        {step === "result" && composed ? (
          <div className="evg-video-create__result">
            <div className="evg-video-create__result-head">
              <h2 className="evg-video-create__result-title">Video-Prompt · Seedance 2</h2>
              <div className="evg-video-create__result-actions">
                <button type="button" className="evg-video-create__icon-btn" onClick={handleCopy}>
                  <Copy size={16} />
                  {copied ? "Kopiert" : "Prompt kopieren"}
                </button>
                <button type="button" className="evg-video-create__icon-btn" onClick={handleReset}>
                  <RotateCcw size={16} />
                  Neu starten
                </button>
              </div>
            </div>
            <ul className="evg-video-create__config">
              {composed.configurationLines.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
            <pre className="evg-video-create__prompt">{composed.englishPrompt}</pre>
            <p className="evg-video-create__hint">{composed.audioHint}</p>

            <div className="evg-video-create__generate">
              <p className="evg-video-create__hint" style={{ marginTop: 0 }}>
                Kosten: <strong>{estimatedTokenCost.toLocaleString("de-DE")} Tokens</strong> pro Generierung ·{" "}
                {SEEDANCE_VIDEO_TOKEN_HINT}
              </p>
              <StudioButton
                type="button"
                variant="primary"
                disabled={generating}
                onClick={() => void handleGenerateVideo()}
              >
                {generating ? (
                  <>
                    <Loader2 size={16} className="evg-video-create__spin" />
                    Seedance 2 generiert …
                  </>
                ) : (
                  "Video generieren (Seedance 2)"
                )}
              </StudioButton>
              {generating ? (
                <div className="evg-video-create__progress" aria-live="polite">
                  <div className="evg-video-create__progress-bar">
                    <span style={{ width: `${generationProgress}%` }} />
                  </div>
                  <p className="evg-video-create__progress-label">
                    {generationStatus || `${generationProgress}%`}
                  </p>
                </div>
              ) : null}
              {generationError ? <p className="evg-video-create__error">{generationError}</p> : null}
            </div>

            {videoPreviewUrl ? (
              <div className="evg-video-create__video-wrap">
                <video className="evg-video-create__video" controls playsInline src={videoPreviewUrl} />
                {videoDownloadUrl ? (
                  <a className="evg-video-create__download" href={videoDownloadUrl}>
                    <Download size={16} />
                    Video herunterladen
                  </a>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : (
          <ClaudeChatInput
            value={inputValue}
            onValueChange={setInputValue}
            stepLabel={stepMeta.label}
            stepDescription={stepMeta.description}
            choiceOptions={choiceOptions}
            onChoiceSelect={handleChoice}
            placeholder={
              step === "brief"
                ? "z. B. „Authentisches UGC-Reel für unser Helles — Biergarten-Stimmung, TikTok-ready“"
                : step === "product"
                  ? "z. B. Helles — Lüne Bräu Original"
                  : "Optional ergänzen …"
            }
            onSendMessage={(message) => handleSend(message)}
            showAttachButton={false}
            showModelSelector={false}
            showOptionsButton={false}
          />
        )}

        {step !== "brief" && step !== "result" ? (
          <button type="button" className="evg-video-create__back" onClick={handleReset}>
            Von vorne beginnen
          </button>
        ) : null}
      </div>
    </>
  );
}
