"use client";

import { VideoGenerationStudio } from "@/components/studio/video-generation-studio";

/** Full-Bleed Chat wie Bilder erstellen — Composer unten. */
export function VideosErstellenMoonChatPage({ breweryName }: { breweryName?: string }) {
  return (
    <div className="absolute inset-0 flex min-h-0 w-full flex-col pb-[calc(5.75rem+env(safe-area-inset-bottom,0px))] md:pb-0">
      <VideoGenerationStudio breweryName={breweryName} />
    </div>
  );
}
