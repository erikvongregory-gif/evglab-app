"use client";

import { useEffect } from "react";
import RuixenMoonChat from "@/components/ui/ruixen-moon-chat";
import { useStudioShell } from "@/components/studio/studio-workspace-shell";

/** Moon-Chat füllt nur den Content unter der Kopfzeile — Header bleibt normal. */
export function InhalteErstellenMoonChatPage() {
  const { setFullBleed, setContentPadding } = useStudioShell();

  useEffect(() => {
    setFullBleed(true);
    setContentPadding("0");
    return () => {
      setFullBleed(false);
      setContentPadding(undefined);
    };
  }, [setFullBleed, setContentPadding]);

  return (
    <div className="absolute inset-0 flex min-h-0 w-full flex-col">
      <RuixenMoonChat />
    </div>
  );
}
