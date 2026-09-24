"use client";

import { create } from "zustand";
import type { MediaItem } from "@/lib/generation/catalog/types";

type MediaState = {
  items: MediaItem[];
  add: (item: MediaItem) => void;
  remove: (id: string) => void;
  clear: () => void;
  replace: (items: MediaItem[]) => void;
};

function createMediaStore() {
  return create<MediaState>((set) => ({
    items: [],
    add: (item) => set((state) => ({ items: [...state.items, item] })),
    remove: (id) => set((state) => ({ items: state.items.filter((item) => item.id !== id) })),
    clear: () => set({ items: [] }),
    replace: (items) => set({ items }),
  }));
}

export const useVideoMedia = createMediaStore();
export const useImageMedia = createMediaStore();
