"use client";

import { create } from "zustand";
import { MODELS, type Surface } from "@/lib/generation/catalog";

const MAX_BATCH = 4;

type ActiveState = {
  surface: Surface;
  model: string;
  batch: number;
  setSurface: (surface: Surface) => void;
  setModel: (model: string) => void;
  setBatch: (batch: number) => void;
};

const defaultVideo = MODELS.find((m) => m.surface === "video")?.id ?? "seedance-2.5";

export const useActive = create<ActiveState>((set) => ({
  surface: "video",
  model: defaultVideo,
  batch: 1,
  setSurface: (surface) => {
    const next = MODELS.find((m) => m.surface === surface);
    set({ surface, ...(next ? { model: next.id } : {}) });
  },
  setModel: (model) => set({ model }),
  setBatch: (batch) => set({ batch: Math.max(1, Math.min(MAX_BATCH, batch)) }),
}));

export { MAX_BATCH };
