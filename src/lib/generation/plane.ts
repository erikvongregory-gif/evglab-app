import type { GenerationPlane, MediaItem, MediaRole, ModelEntry } from "./catalog/types";
import { parseSettings } from "./catalog/parse-settings";

/** Clamp media to catalog caps and parse settings — single place before submit. */
export function normalizePlane(model: ModelEntry, plane: GenerationPlane): GenerationPlane {
  const media: GenerationPlane["media"] = {};
  for (const role of Object.keys(model.roles) as MediaRole[]) {
    const max = model.roles[role];
    if (!max) continue;
    const items = (plane.media[role] ?? []).filter((item): item is MediaItem =>
      Boolean(item?.id && item?.url && item.role === role),
    );
    if (items.length) media[role] = items.slice(0, max);
  }
  return {
    model: model.id,
    prompt: { text: plane.prompt?.text?.trim() ?? "" },
    media,
    settings: parseSettings(model, plane.settings ?? {}),
  };
}
