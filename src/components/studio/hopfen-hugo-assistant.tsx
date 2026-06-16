"use client";

import { useCallback, useMemo, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { HOPFEN_HUGO_GREETING } from "@/lib/assistant/hopfenHugoPolicy";
import { HopfenHugoChat, type HopfenHugoMessage } from "@/components/studio/hopfen-hugo-chat";

function resolveAssistantTab(pathname: string, tabParam: string | null): string {
  if (pathname.startsWith("/inhalte-erstellen")) return "create";
  if (pathname.startsWith("/videos-erstellen")) return "create-video";
  if (tabParam && tabParam !== "dashboard") return tabParam;
  return "dashboard";
}

export function HopfenHugoAssistant() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");

  const currentTab = useMemo(
    () => resolveAssistantTab(pathname, tabParam),
    [pathname, tabParam],
  );

  const [assistantOpen, setAssistantOpen] = useState(false);
  const [assistantInput, setAssistantInput] = useState("");
  const [assistantLoading, setAssistantLoading] = useState(false);
  const [assistantMessages, setAssistantMessages] = useState<HopfenHugoMessage[]>([
    { role: "assistant", text: HOPFEN_HUGO_GREETING },
  ]);

  const submitAssistantMessage = useCallback(async () => {
    const trimmed = assistantInput.trim();
    if (!trimmed || assistantLoading) return;

    const nextMessages: HopfenHugoMessage[] = [...assistantMessages, { role: "user", text: trimmed }];
    setAssistantLoading(true);
    setAssistantInput("");
    setAssistantMessages(nextMessages);

    try {
      const res = await fetch("/api/claude/brauerei-assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          messages: nextMessages,
          currentTab,
          assistantPersona: "hopfen-hugo",
        }),
      });
      const data = (await res.json()) as { answer?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Assistent nicht erreichbar.");
      setAssistantMessages((prev) => [
        ...prev,
        { role: "assistant", text: data.answer ?? "Dazu habe ich gerade keine klare Antwort." },
      ]);
    } catch (error) {
      setAssistantMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: error instanceof Error ? error.message : "Assistent konnte nicht antworten.",
        },
      ]);
    } finally {
      setAssistantLoading(false);
    }
  }, [assistantInput, assistantLoading, assistantMessages, currentTab]);

  return (
    <HopfenHugoChat
      isOpen={assistantOpen}
      onToggle={() => setAssistantOpen((prev) => !prev)}
      messages={assistantMessages}
      inputValue={assistantInput}
      onInputChange={setAssistantInput}
      onSubmit={() => {
        void submitAssistantMessage();
      }}
      loading={assistantLoading}
      onboardingAttr="hopfen-hugo"
    />
  );
}
