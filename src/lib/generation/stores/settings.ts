"use client";

import { create } from "zustand";

type SettingsState = {
  byModel: Record<string, Record<string, unknown>>;
  setValue: (modelId: string, key: string, value: unknown) => void;
  replaceModel: (modelId: string, values: Record<string, unknown>) => void;
};

export const useSettings = create<SettingsState>((set) => ({
  byModel: {},
  setValue: (modelId, key, value) =>
    set((state) => ({
      byModel: {
        ...state.byModel,
        [modelId]: { ...state.byModel[modelId], [key]: value },
      },
    })),
  replaceModel: (modelId, values) =>
    set((state) => ({
      byModel: { ...state.byModel, [modelId]: values },
    })),
}));
