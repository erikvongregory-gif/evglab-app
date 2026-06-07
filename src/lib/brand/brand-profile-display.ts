export const FALLBACK_SWATCHES = ["#E8772E", "#6B4423", "#F4EFE6", "#3D5C45", "#2A1F14"];

export function parseHexSwatches(text: string): string[] {
  const hex = [...text.matchAll(/#(?:[0-9a-fA-F]{3}){1,2}\b/g)].map((m) => m[0]);
  if (hex.length >= 2) return hex.slice(0, 8);
  return FALLBACK_SWATCHES;
}

export function parseToneTags(tone: string): string[] {
  const raw = tone
    .split(/[,;·|\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (raw.length >= 2) return raw.slice(0, 12);
  if (tone.trim()) return [tone.trim()];
  return [];
}

export function parseRuleSentences(text: string): string[] {
  return text
    .split(/\n|(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function parseBildregeln(dos: string, donts: string) {
  const dosLines = parseRuleSentences(dos);
  return {
    bildlicht: dosLines[0] ?? dos.trim() ?? "—",
    komposition: dosLines[1] ?? (dosLines.length > 1 ? dosLines.slice(1).join(" ") : "—"),
    tabu: donts.trim() || "—",
  };
}

export function formatDomain(url: string): string {
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    return u.hostname.replace(/^www\./, "");
  } catch {
    return url.replace(/^https?:\/\//, "").replace(/\/$/, "");
  }
}

export function formatConfidenceLabel(confidence?: string): string | null {
  if (!confidence?.trim()) return null;
  const c = confidence.trim().toLowerCase();
  if (c === "high" || c === "hoch") return "Konfidenz: Hoch";
  if (c === "medium" || c === "mittel") return "Konfidenz: Mittel";
  if (c === "low" || c === "niedrig") return "Konfidenz: Niedrig";
  return `Konfidenz: ${confidence}`;
}

export function brandLockLabel(level: "strict" | "balanced" | "loose"): string {
  if (level === "strict") return "Strict";
  if (level === "balanced") return "Balanced";
  return "Frei";
}
