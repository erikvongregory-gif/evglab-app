import { parseSettings } from "./parse-settings";
import { seedance2, seedance2Fast, seedance2Mini } from "./seedance-2";
import { seedance25, seedance25Edit, seedance25Extend } from "./seedance-2.5";
import type { ModelEntry, Surface } from "./types";

/** ModelArk-fähige Modelle zuerst — Katalog erweiterbar. */
export const MODELS: readonly ModelEntry[] = [
  seedance25,
  seedance25Edit,
  seedance25Extend,
  seedance2,
  seedance2Fast,
  seedance2Mini,
];

export function getModel(id: string): ModelEntry {
  const model = MODELS.find((entry) => entry.id === id);
  if (!model) throw new Error(`Unknown model: ${id}`);
  return model;
}

export function modelsForSurface(surface: Surface): readonly ModelEntry[] {
  return MODELS.filter((entry) => entry.surface === surface);
}

export type {
  GenerationPlane,
  MediaItem,
  MediaRole,
  ModelEntry,
  SettingField,
  Surface,
} from "./types";
export { parseSettings };
export { SEEDANCE_ASPECT } from "./tokens";
