"use client";

import { getModel } from "@/lib/generation/catalog";
import type { GenerationPlane } from "@/lib/generation/catalog/types";
import { useActive } from "./active";
import { useImageMedia, useVideoMedia } from "./media";
import { useImagePrompt, useVideoPrompt } from "./prompt";
import { useSettings } from "./settings";
import { normalizePlane } from "../plane";

export function assemblePlane(): GenerationPlane {
  const { model: modelId, surface } = useActive.getState();
  const model = getModel(modelId);
  const text = (surface === "image" ? useImagePrompt : useVideoPrompt).getState().text;
  const items = (surface === "image" ? useImageMedia : useVideoMedia).getState().items;
  const media: GenerationPlane["media"] = {};
  for (const item of items) {
    const max = model.roles[item.role];
    if (!max) continue;
    const list = media[item.role] ?? [];
    if (list.length >= max) continue;
    list.push(item);
    media[item.role] = list;
  }
  return normalizePlane(model, {
    model: model.id,
    prompt: { text },
    media,
    settings: useSettings.getState().byModel[model.id] ?? {},
  });
}

/** Restore composer from a finished run. */
export function applyPlane(plane: GenerationPlane) {
  const model = getModel(plane.model);
  useActive.getState().setSurface(model.surface);
  useActive.getState().setModel(model.id);
  (model.surface === "image" ? useImagePrompt : useVideoPrompt).getState().setText(plane.prompt.text);
  const items = Object.values(plane.media).flatMap((list) => list ?? []);
  (model.surface === "image" ? useImageMedia : useVideoMedia).getState().replace(items);
  useSettings.getState().replaceModel(model.id, plane.settings);
}
