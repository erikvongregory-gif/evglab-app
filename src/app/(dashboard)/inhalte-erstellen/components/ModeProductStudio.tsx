"use client";

/* eslint-disable @next/next/no-img-element */
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GLAS_TYPEN, STUDIO_PROPS_BY_BIERSTIL } from "../lib/brewing-knowledge";
import { buildProductStudioPrompt, resolveStudioGlas } from "../lib/prompt-builders/product-studio";
import { productStudioSchema, type ProductStudioInput } from "../lib/schemas";

type ImageResponse = { b64_json?: string; url?: string };

const defaultInput: ProductStudioInput = {
  referenzBild: "https://example.com/product.png",
  bierstil: "pils",
  hintergrundStil: "naturholz_warm",
  glasNebenFlasche: true,
  lichtStimmung: "weich_diffuse",
  aspectRatio: "1:1",
  quality: "high",
};

function readFile(file: File, onDone: (dataUrl: string) => void) {
  const reader = new FileReader();
  reader.onload = () => onDone(String(reader.result ?? ""));
  reader.readAsDataURL(file);
}

function imageSrc(image: ImageResponse) {
  return image.url ?? (image.b64_json ? `data:image/png;base64,${image.b64_json}` : "");
}

export function ModeProductStudio() {
  const [input, setInput] = useState<ProductStudioInput>(defaultInput);
  const [images, setImages] = useState<ImageResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const prompt = useMemo(() => buildProductStudioPrompt(input), [input]);
  const resolvedGlas = GLAS_TYPEN[resolveStudioGlas(input)].label;

  async function submit() {
    setLoading(true);
    setError("");
    try {
      const parsed = productStudioSchema.parse(input);
      const res = await fetch("/api/generate-studio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed),
      });
      const data = (await res.json()) as { error?: string; images?: ImageResponse[] };
      if (!res.ok) throw new Error(data.error ?? "Studio-Generierung fehlgeschlagen.");
      setImages(data.images ?? []);
      const history = JSON.parse(localStorage.getItem("evglab:history:studio") ?? "[]") as unknown[];
      localStorage.setItem("evglab:history:studio", JSON.stringify([{ input: parsed, prompt, createdAt: new Date().toISOString() }, ...history].slice(0, 20)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Studio-Generierung fehlgeschlagen.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>3. Produkt Studio</CardTitle>
        <CardDescription>Bierstil steuert Glasform und Garnituren. Automatisch: {resolvedGlas}.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="grid gap-4">
          <div className="space-y-2">
            <Label>Referenzbild mit Etikett</Label>
            <Input
              type="file"
              accept="image/*"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                readFile(file, (dataUrl) => setInput((prev) => ({ ...prev, referenzBild: dataUrl })));
              }}
            />
          </div>

          <div className="grid gap-2 sm:grid-cols-3">
            {Object.keys(STUDIO_PROPS_BY_BIERSTIL).map((stil) => (
              <button
                key={stil}
                type="button"
                className={`rounded-xl border p-3 text-left text-sm transition ${input.bierstil === stil ? "border-amber-500 bg-amber-50" : "border-zinc-200 bg-white hover:border-amber-300"}`}
                onClick={() => setInput({ ...input, bierstil: stil as ProductStudioInput["bierstil"] })}
              >
                <span className="font-medium">{stil}</span>
                <span className="mt-1 block text-xs text-zinc-500">{STUDIO_PROPS_BY_BIERSTIL[stil as ProductStudioInput["bierstil"]].slice(0, 2).join(", ")}</span>
              </button>
            ))}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <select className="h-9 rounded-lg border px-3 text-sm" value={input.hintergrundStil} onChange={(e) => setInput({ ...input, hintergrundStil: e.target.value as ProductStudioInput["hintergrundStil"] })}>
              {["naturholz_warm", "marmor_hell", "schiefer_dunkel", "leinen_rustikal", "studio_gradient_warm", "studio_gradient_kuehl", "outdoor_naturlich"].map((value) => <option key={value}>{value}</option>)}
            </select>
            <select className="h-9 rounded-lg border px-3 text-sm" value={input.glasTyp ?? ""} onChange={(e) => setInput({ ...input, glasTyp: (e.target.value || undefined) as ProductStudioInput["glasTyp"] })}>
              <option value="">Automatisch</option>
              {Object.entries(GLAS_TYPEN).map(([key, item]) => <option key={key} value={key}>{item.label}</option>)}
            </select>
            <select className="h-9 rounded-lg border px-3 text-sm" value={input.aspectRatio} onChange={(e) => setInput({ ...input, aspectRatio: e.target.value as ProductStudioInput["aspectRatio"] })}>
              <option value="1:1">1:1</option>
              <option value="2:3">2:3</option>
            </select>
            <select className="h-9 rounded-lg border px-3 text-sm" value={input.quality} onChange={(e) => setInput({ ...input, quality: e.target.value as ProductStudioInput["quality"] })}>
              <option value="medium">Vorschau</option>
              <option value="high">Final</option>
            </select>
          </div>

          <Input value={input.customProps ?? ""} onChange={(e) => setInput({ ...input, customProps: e.target.value || undefined })} placeholder="Optionale eigene Props statt Auto-Garnitur" />

          <details className="rounded-xl border bg-zinc-50 p-4">
            <summary className="cursor-pointer text-sm font-medium">Advanced anzeigen: Prompt-Vorschau</summary>
            <pre className="mt-3 whitespace-pre-wrap text-xs text-zinc-700">{prompt}</pre>
          </details>

          <div className="flex items-center justify-between rounded-xl bg-amber-50 p-4 text-sm text-amber-900">
            <span>Credit-Preview: {input.quality === "high" ? "High Render" : "Medium Preview"}. Erwartete Zeit: 15-40 Sekunden.</span>
            <Button onClick={submit} disabled={loading}>{loading ? "Generiert..." : "Studio rendern"}</Button>
          </div>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
        </div>
        <div className="space-y-3">
          {input.referenzBild ? <img src={input.referenzBild} alt="Referenz Vorschau" className="w-full rounded-2xl border object-contain" /> : null}
          {loading ? <div className="h-40 animate-pulse rounded-2xl bg-zinc-100" /> : null}
          {images.map((image, index) => <img key={index} src={imageSrc(image)} alt={`Studio Variante ${index + 1}`} className="w-full rounded-2xl border" />)}
        </div>
      </CardContent>
    </Card>
  );
}
