"use client";

import React from "react";
import type { ContentCreationPreset } from "@/lib/image-types/policy";

export function getFlowTypingPhrases(preset: ContentCreationPreset, mode: "standard" | "campaign"): string[] {
  if (mode === "campaign") {
    return [
      "Referenz-Screenshot hochladen — neue Instagram-Grafik im gleichen Markenlook.",
      "Zwei Post-Screenshots — KI baut daraus einen frischen Feed-Post mit Text im Bild.",
      "Optional: Sommerabend am Wasser — sonst nur Bilder, Text erfindet die KI.",
    ];
  }
  if (preset === "product_cutout") {
    return [
      "Produkt freistellen als transparentes PNG ohne Hintergrund.",
      "Packshot: eine Flasche freigestellt, Label gestochen scharf.",
      "Einzelnes Glas freigestellt, keine Szene, keine Deko.",
    ];
  }
  if (preset === "product_studio") {
    return [
      "Premium-Studiobild einer Dose auf neutralem Hintergrund, softes Hero-Licht.",
      "Flasche im kontrollierten Studio-Setup, sauberer Schatten, hohe Label-Lesbarkeit.",
      "Produkt-Studioaufnahme mit ruhigem Hintergrund und klaren Reflexen.",
    ];
  }
  return [
    "Helles im Willibecher auf Holztisch, warmes Abendlicht, echte Biergarten-Stimmung.",
    "Pils im schlanken Pilstulpen-Glas, klare Lichtkante, kuehler Premium-Werbe-Look.",
    "Weizenbier im hohen Weizenglas mit dichter Schaumkrone, sommerliche Abendsonne.",
  ];
}
