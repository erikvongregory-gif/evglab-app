import type { BrandReferenceImagePayload, BrandScanSuggestion } from "./BrandProfileSetupModal";

export {
  formatConfidenceLabel,
  parseHexSwatches,
  parseRuleSentences,
  parseToneTags,
} from "@/lib/brand/brand-profile-display";

export function reviewReferencePreviews(review: BrandScanSuggestion): string[] {
  if (review.referenceImagePayloads?.length) {
    return review.referenceImagePayloads.map((image: BrandReferenceImagePayload) => `data:${image.mime};base64,${image.base64}`);
  }
  return review.referenceImageUrls;
}
