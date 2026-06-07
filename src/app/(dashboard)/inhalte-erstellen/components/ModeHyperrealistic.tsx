"use client";

/* eslint-disable @next/next/no-img-element */
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FLASCHEN_TYPEN, GLAS_TYPEN } from "../lib/brewing-knowledge";
import { buildHyperrealisticPrompt } from "../lib/prompt-builders/hyperrealistic";
import { hyperrealisticSchema, type HyperrealisticInput } from "../lib/schemas";

type ImageResponse = { b64_json?: string; url?: string };

const defaultInput: HyperrealisticInput = {
  etikettBild: "https://example.com/label.png",
  flaschenTyp: "nrw_500",
  flaschenfarbe: "braun",
  bierstil: "pils",
  glasTyp: "pils_tulpe",
  szene: "biergarten_sommer",
  personImBild: false,
  tageszeit: "goldene_stunde",
  stimmung: "entspannt",
  aspectRatio: "4:5",
  quality: "medium",
};

function readFile(file: File, onDone: (dataUrl: string) => void) {
  const reader = new FileReader();
  reader.onload = () => onDone(String(reader.result ?? ""));
  reader.readAsDataURL(file);
}

function imageSrc(image: ImageResponse) {
  return image.url ?? (image.b64_json ? `data:image/png;base64,${image.b64_json}` : "");
}

export function ModeHyperrealistic() {
  const [input, setInput] = useState<HyperrealisticInput>(defaultInput);
  const [images, setImages] = useState<ImageResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const prompt = useMemo(() => buildHyperrealisticPrompt(input), [input]);
  const creditPreview = input.quality === "high" ? "ca. 2 x High Render" : "ca. 2 x Medium Preview";

  async function submit() {
    setLoading(true);
    setError("");
    try {
      const parsed = hyperrealisticSchema.parse(input);
      const res = await fetch("/api/generate-hyperrealistic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed),
      });
      const data = (await res.json()) as { error?: string; images?: ImageResponse[] };
      if (!res.ok) throw new Error(data.error ?? "Generierung fehlgeschlagen.");
      setImages(data.images ?? []);
      const history = JSON.parse(localStorage.getItem("evglab:history:hyperreal") ?? "[]") as unknown[];
      localStorage.setItem("evglab:history:hyperreal", JSON.stringify([{ input: parsed, prompt, createdAt: new Date().toISOString() }, ...history].slice(0, 20)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generierung fehlgeschlagen.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <CardTitle>1. Hyperrealistisches Bild</CardTitle>
        <CardDescription>Etikett als fixe Referenz, Flaschentyp und Bierstil explizit im Prompt verankert.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <Label>Etikett-Upload</Label>
            <Input
              type="file"
              accept="image/*"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                readFile(file, (dataUrl) => setInput((prev) => ({ ...prev, etikettBild: dataUrl })));
              }}
            />
            <p className="text-xs text-zinc-500">Square-Crop empfohlen, mindestens 1024 x 1024 px. Unter 200 KB kann die Etikett-Treue leiden.</p>
          </div>

          <div className="space-y-2">
            <Label>Flasche</Label>
            <select className="h-9 w-full rounded-lg border px-3 text-sm" value={input.flaschenTyp} onChange={(e) => setInput({ ...input, flaschenTyp: e.target.value as HyperrealisticInput["flaschenTyp"] })}>
              {Object.entries(FLASCHEN_TYPEN).map(([key, item]) => (
                <option key={key} value={key}>{item.label}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label>Glas</Label>
            <select className="h-9 w-full rounded-lg border px-3 text-sm" value={input.glasTyp ?? ""} onChange={(e) => setInput({ ...input, glasTyp: (e.target.value || undefined) as HyperrealisticInput["glasTyp"] })}>
              <option value="">Kein Glas</option>
              {Object.entries(GLAS_TYPEN).map(([key, item]) => (
                <option key={key} value={key}>{item.label}</option>
              ))}
            </select>
          </div>

          <Input value={input.bierstil} onChange={(e) => setInput({ ...input, bierstil: e.target.value })} placeholder="Bierstil, z. B. Pils" />
          <select className="h-9 rounded-lg border px-3 text-sm" value={input.szene} onChange={(e) => setInput({ ...input, szene: e.target.value as HyperrealisticInput["szene"] })}>
            {["biergarten_sommer", "wirtshaus_innen", "kueche_zuhause", "wiese_picknick", "strand_sonnenuntergang", "alpenpanorama", "stadtbalkon_abend", "brauereihof", "fussball_public_viewing"].map((value) => (
              <option key={value} value={value}>{value}</option>
            ))}
          </select>
          <select className="h-9 rounded-lg border px-3 text-sm" value={input.aspectRatio} onChange={(e) => setInput({ ...input, aspectRatio: e.target.value as HyperrealisticInput["aspectRatio"] })}>
            {["4:5", "1:1", "9:16", "16:9"].map((value) => <option key={value}>{value}</option>)}
          </select>
          <select className="h-9 rounded-lg border px-3 text-sm" value={input.quality} onChange={(e) => setInput({ ...input, quality: e.target.value as HyperrealisticInput["quality"] })}>
            <option value="medium">Vorschau</option>
            <option value="high">Final</option>
          </select>

          <details className="md:col-span-2 rounded-xl border bg-zinc-50 p-4">
            <summary className="cursor-pointer text-sm font-medium">Advanced anzeigen: Prompt-Vorschau</summary>
            <pre className="mt-3 whitespace-pre-wrap text-xs text-zinc-700">{prompt}</pre>
          </details>

          <div className="md:col-span-2 flex items-center justify-between rounded-xl bg-amber-50 p-4 text-sm text-amber-900">
            <span>Credit-Preview: {creditPreview}. Erwartete Zeit: 15-40 Sekunden.</span>
            <Button onClick={submit} disabled={loading}>{loading ? "Generiert..." : "Generieren"}</Button>
          </div>
          {error ? <p className="md:col-span-2 text-sm text-red-600">{error}</p> : null}
        </div>

        <div className="space-y-3">
          {input.etikettBild ? <img src={input.etikettBild} alt="Etikett Vorschau" className="aspect-square w-full rounded-2xl border object-cover" /> : null}
          {loading ? <div className="h-40 animate-pulse rounded-2xl bg-zinc-100" /> : null}
          {images.map((image, index) => (
            <img key={index} src={imageSrc(image)} alt={`Variante ${index + 1}`} className="w-full rounded-2xl border" />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
