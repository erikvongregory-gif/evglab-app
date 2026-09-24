"use client";

import { create } from "zustand";

type PromptState = {
  text: string;
  setText: (text: string) => void;
};

export const useVideoPrompt = create<PromptState>((set) => ({
  text: "",
  setText: (text) => set({ text }),
}));

export const useImagePrompt = create<PromptState>((set) => ({
  text: "",
  setText: (text) => set({ text }),
}));
