import {
  coalesceBrandReferenceUrls,
  createBrandReferenceUrlResolver,
  LEGACY_REFERENCE_IMAGE_ERROR,
} from "@/lib/brand/reference-image-store";
import type { ReferenceUrlResolver } from "@/app/(dashboard)/inhalte-erstellen/lib/image-clients/openai-image";

export function createReferenceResolverFromMetadata(userMetadata: unknown): ReferenceUrlResolver {
  return createBrandReferenceUrlResolver(userMetadata);
}

export function resolveReferenceUrlsForGeneration(
  userMetadata: unknown,
  origin: string,
  urls: string[],
): string[] {
  return coalesceBrandReferenceUrls(userMetadata, origin, urls);
}

export function assertResolvableReferenceUrls(
  userMetadata: unknown,
  origin: string,
  urls: string[],
): void {
  const resolved = coalesceBrandReferenceUrls(userMetadata, origin, urls);
  if (resolved.length > 0) return;
  if (urls.some((url) => url.trim())) {
    throw new Error(LEGACY_REFERENCE_IMAGE_ERROR);
  }
}
