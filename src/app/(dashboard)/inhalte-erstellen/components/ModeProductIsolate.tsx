"use client";

/* eslint-disable @next/next/no-img-element */
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { buildProductIsolatePrompt } from "../lib/prompt-builders/product-isolate";
import { productIsolateSchema, type ProductIsolateInput } from "../lib/schemas";

const defaultInput: ProductIsolateInput = {
  inputBild: "https://example.com/product.png",
  hintergrund: "transparent",
  schattenErhalten: true,
  outputFormat: "png",
};

function readFile(file: File, onDone: (dataUrl: string) => void) {
  const reader = new FileReader();
  reader.onload = () => onDone(String(reader.result ?? ""));
  reader.readAsDataURL(file);
}

export function ModeProductIsolate() {
  const [input, setInput] = useState<ProductIsolateInput>(defaultInput);
  const [image, setImage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const prompt = useMemo(() => buildProductIsolatePrompt(input), [input]);

  async function submit() {
    setLoading(true);
    setError("");
    try {
      const parsed = productIsolateSchema.parse(input);
      const res = await fetch("/api/generate-isolate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed),
      });
      const data = (await res.json()) as { error?: string; image?: string };
      if (!res.ok) throw new Error(data.error ?? "Freistellen fehlgeschlagen.");
      setImage(data.image ?? "");
      const history = JSON.parse(localStorage.getItem("evglab:history:isolate") ?? "[]") as unknown[];
      localStorage.setItem("evglab:history:isolate", JSON.stringify([{ input: parsed, prompt, createdAt: new Date().toISOString() }, ...history].slice(0, 20)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Freistellen fehlgeschlagen.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>2. Produkt freistellen</CardTitle>
        <CardDescription>Dedizierter Background-Removal-Service, kein Re-Rendering des Etiketts.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <Label>Produktbild</Label>
            <Input
              type="file"
              accept="image/*"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                readFile(file, (dataUrl) => setInput((prev) => ({ ...prev, inputBild: dataUrl })));
              }}
            />
          </div>
          <select className="h-9 rounded-lg border px-3 text-sm" value={input.hintergrund} onChange={(e) => setInput({ ...input, hintergrund: e.target.value as ProductIsolateInput["hintergrund"] })}>
            <option value="transparent">Transparent</option>
            <option value="weiss">Weiss</option>
            <option value="schwarz">Schwarz</option>
          </select>
          <select className="h-9 rounded-lg border px-3 text-sm" value={input.outputFormat} onChange={(e) => setInput({ ...input, outputFormat: e.target.value as ProductIsolateInput["outputFormat"] })}>
            <option value="png">PNG</option>
            <option value="webp">WebP</option>
          </select>
          <label className="md:col-span-2 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={input.schattenErhalten} onChange={(e) => setInput({ ...input, schattenErhalten: e.target.checked })} />
            Weichen Kontaktschatten erhalten
          </label>
          <details className="md:col-span-2 rounded-xl border bg-zinc-50 p-4">
            <summary className="cursor-pointer text-sm font-medium">Advanced anzeigen: Prompt-Vorschau</summary>
            <pre className="mt-3 whitespace-pre-wrap text-xs text-zinc-700">{prompt}</pre>
          </details>
          <div className="md:col-span-2 flex items-center justify-between rounded-xl bg-emerald-50 p-4 text-sm text-emerald-900">
            <span>Credit-Preview: niedrig. Erwartete Zeit: 1-2 Sekunden.</span>
            <Button onClick={submit} disabled={loading}>{loading ? "Stellt frei..." : "Freistellen"}</Button>
          </div>
          {error ? <p className="md:col-span-2 text-sm text-red-600">{error}</p> : null}
        </div>
        <div className="space-y-3">
          {input.inputBild ? <img src={input.inputBild} alt="Produkt Vorschau" className="w-full rounded-2xl border object-contain" /> : null}
          {loading ? <div className="h-40 animate-pulse rounded-2xl bg-zinc-100" /> : null}
          {image ? <img src={image} alt="Freisteller" className="w-full rounded-2xl border bg-grid-small-black/[0.05] object-contain" /> : null}
        </div>
      </CardContent>
    </Card>
  );
}
