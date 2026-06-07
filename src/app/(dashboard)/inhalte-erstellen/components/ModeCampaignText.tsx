"use client";

/* eslint-disable @next/next/no-img-element */
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { buildCampaignTextPrompt } from "../lib/prompt-builders/campaign-text";
import { campaignTextSchema, type CampaignTextInput } from "../lib/schemas";

type ImageResponse = { b64_json?: string; url?: string };

const defaultInput: CampaignTextInput = {
  referenzBilder: [],
  postZiel: "produkt_launch",
  headline: "Frisch eingebraut",
  subline: "Unser neues Bier ist ab sofort im Ausschank.",
  ctaText: "Jetzt probieren",
  brauereiName: "Beispielmarke",
  aspectRatio: "4:5",
  quality: "high",
};

function imageSrc(image: ImageResponse) {
  return image.url ?? (image.b64_json ? `data:image/png;base64,${image.b64_json}` : "");
}

async function filesToDataUrls(files: FileList | null): Promise<string[]> {
  if (!files) return [];
  return Promise.all(
    Array.from(files)
      .slice(0, 5)
      .map(
        (file) =>
          new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result ?? ""));
            reader.readAsDataURL(file);
          }),
      ),
  );
}

export function ModeCampaignText() {
  const [input, setInput] = useState<CampaignTextInput>(defaultInput);
  const [images, setImages] = useState<ImageResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const prompt = useMemo(() => buildCampaignTextPrompt(input), [input]);
  const canSubmit = input.referenzBilder.length >= 3;

  async function submit() {
    setLoading(true);
    setError("");
    try {
      const parsed = campaignTextSchema.parse(input);
      const res = await fetch("/api/generate-campaign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed),
      });
      const data = (await res.json()) as { error?: string; images?: ImageResponse[] };
      if (!res.ok) throw new Error(data.error ?? "Kampagnen-Generierung fehlgeschlagen.");
      setImages(data.images ?? []);
      const history = JSON.parse(localStorage.getItem("evglab:history:campaign") ?? "[]") as unknown[];
      localStorage.setItem("evglab:history:campaign", JSON.stringify([{ input: parsed, prompt, createdAt: new Date().toISOString() }, ...history].slice(0, 20)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kampagnen-Generierung fehlgeschlagen.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>4. Kampagnenbild mit Text</CardTitle>
        <CardDescription>3-5 Feed-Referenzen definieren Stil, Farbe und Komposition. Thinking bleibt für Text-Layout aktiv.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <Label>Instagram-Referenzen (3 bis 5 Bilder)</Label>
            <Input
              type="file"
              accept="image/*"
              multiple
              onChange={async (event) => {
                const referenzBilder = await filesToDataUrls(event.target.files);
                setInput((prev) => ({ ...prev, referenzBilder }));
              }}
            />
            {!canSubmit ? <p className="text-xs text-red-600">Mindestens 3 Referenzbilder erforderlich.</p> : null}
          </div>
          <Input value={input.brauereiName} onChange={(e) => setInput({ ...input, brauereiName: e.target.value })} placeholder="Brauerei" />
          <select className="h-9 rounded-lg border px-3 text-sm" value={input.postZiel} onChange={(e) => setInput({ ...input, postZiel: e.target.value as CampaignTextInput["postZiel"] })}>
            {["produkt_launch", "event_ankuendigung", "saisonal", "behind_the_scenes", "rezept_pairing", "community_engagement", "edukativ_bierwissen", "sale_aktion"].map((value) => <option key={value}>{value}</option>)}
          </select>
          <Input value={input.headline} onChange={(e) => setInput({ ...input, headline: e.target.value })} placeholder="Headline" />
          <Input value={input.subline ?? ""} onChange={(e) => setInput({ ...input, subline: e.target.value || undefined })} placeholder="Subline" />
          <Input value={input.ctaText ?? ""} onChange={(e) => setInput({ ...input, ctaText: e.target.value || undefined })} placeholder="CTA" />
          <Input value={input.bierstilOderProdukt ?? ""} onChange={(e) => setInput({ ...input, bierstilOderProdukt: e.target.value || undefined })} placeholder="Bierstil oder Produkt" />
          <select className="h-9 rounded-lg border px-3 text-sm" value={input.aspectRatio} onChange={(e) => setInput({ ...input, aspectRatio: e.target.value as CampaignTextInput["aspectRatio"] })}>
            <option value="4:5">4:5</option>
            <option value="1:1">1:1</option>
            <option value="9:16">9:16</option>
          </select>
          <select className="h-9 rounded-lg border px-3 text-sm" value={input.quality} onChange={(e) => setInput({ ...input, quality: e.target.value as CampaignTextInput["quality"] })}>
            <option value="medium">Vorschau</option>
            <option value="high">Final</option>
          </select>
          <textarea className="md:col-span-2 min-h-24 rounded-lg border p-3 text-sm" value={input.zusatzKontext ?? ""} onChange={(e) => setInput({ ...input, zusatzKontext: e.target.value || undefined })} placeholder="Zusatzkontext" />

          <details className="md:col-span-2 rounded-xl border bg-zinc-50 p-4">
            <summary className="cursor-pointer text-sm font-medium">Advanced anzeigen: Prompt-Vorschau</summary>
            <pre className="mt-3 whitespace-pre-wrap text-xs text-zinc-700">{prompt}</pre>
          </details>

          <div className="md:col-span-2 flex items-center justify-between rounded-xl bg-amber-50 p-4 text-sm text-amber-900">
            <span>Credit-Preview: {input.quality === "high" ? "High Render" : "Medium Preview"}. Queue sichtbar, Rate-Limit 5 IPM beachten.</span>
            <Button onClick={submit} disabled={loading || !canSubmit}>{loading ? "Generiert..." : "Kampagne rendern"}</Button>
          </div>
          {error ? <p className="md:col-span-2 text-sm text-red-600">{error}</p> : null}
        </div>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            {input.referenzBilder.map((src, index) => <img key={index} src={src} alt={`Referenz ${index + 1}`} className="aspect-square rounded-xl border object-cover" />)}
          </div>
          {loading ? <div className="h-40 animate-pulse rounded-2xl bg-zinc-100" /> : null}
          {images.map((image, index) => <img key={index} src={imageSrc(image)} alt={`Kampagne ${index + 1}`} className="w-full rounded-2xl border" />)}
        </div>
      </CardContent>
    </Card>
  );
}
