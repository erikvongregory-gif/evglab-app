import { z } from "zod";
import { IMAGE_PROMPT_SECTIONS } from "../image-direction";
import { hyperrealisticSchema } from "@/app/(dashboard)/inhalte-erstellen/lib/schemas";

export const referenceRoleSchema = z.enum(["product", "label", "mood", "shape", "glass", "liquid", "scene", "look"]);

export const compiledBriefSchema = z.object({
  normalized_brief: z.object({
    // The fallback stores the full accepted user brief here, without shortening it.
    scene: hyperrealisticSchema.shape.zusatzWunsch.unwrap().min(1),
    action: z.string().trim().max(400).optional().default(""),
    people: z.string().trim().max(400).optional().default(""),
    mood: z.string().trim().max(200).optional().default(""),
    channel: z.string().trim().max(120).optional().default("Instagram / Website"),
    format: z.string().trim().max(40).optional().default("4:5"),
  }),
  missing_information: z.array(z.string().trim().min(1)).default([]),
  blocking_issues: z.array(z.string().trim().min(1)).default([]),
  reference_roles: z
    .array(
      z.object({
        index: z.number().int().min(1).max(8),
        role: referenceRoleSchema,
        note: z.string().trim().max(240).optional().default(""),
      }),
    )
    .default([]),
  image_prompt: z.string().trim().min(40).max(12_000),
  preserve_constraints: z.array(z.string().trim().min(1)).default([]),
  exclusions: z.array(z.string().trim().min(1)).default([]),
  generation_settings: z
    .object({
      aspectRatio: z.string().trim().optional(),
      quality: z.enum(["low", "medium", "high"]).optional(),
    })
    .default({}),
});

export type CompiledBrief = z.infer<typeof compiledBriefSchema>;

export const MASTER_PROMPT_SECTIONS = IMAGE_PROMPT_SECTIONS;

export function masterPromptHasRequiredSections(prompt: string): boolean {
  const upper = prompt.toUpperCase();
  let previous = -1;
  return MASTER_PROMPT_SECTIONS.every((section) => {
    const position = upper.indexOf(section.toUpperCase());
    const ordered = position > previous;
    previous = position;
    return ordered;
  });
}
