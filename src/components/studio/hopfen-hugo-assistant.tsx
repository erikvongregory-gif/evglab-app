"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { HOPFEN_HUGO_GREETING } from "@/lib/assistant/hopfenHugoPolicy";
import { HopfenHugoChat, type HopfenHugoMessage } from "@/components/studio/hopfen-hugo-chat";
import type { HopBuddyState } from "@/components/studio/hop-buddy-avatar";

const STORAGE_KEY = "brewai.assistant.active";
const MAX_STORED = 40;

function greetingMessages(): HopfenHugoMessage[] {
  return [{ role: "assistant", text: HOPFEN_HUGO_GREETING }];
}

function loadStoredMessages(): HopfenHugoMessage[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return null;
    const msgs = parsed
      .filter(
        (m): m is HopfenHugoMessage =>
          !!m &&
          (m.role === "user" || m.role === "assistant") &&
          typeof m.text === "string" &&
          m.text.trim().length > 0,
      )
      .slice(-MAX_STORED);
    return msgs.length > 0 ? msgs : null;
  } catch {
    return null;
  }
}

function persistMessages(messages: HopfenHugoMessage[]) {
  if (typeof window === "undefined") return;
  try {
    // ponytail: only store real threads; greeting-only clears the key
    if (messages.length <= 1 && messages[0]?.role === "assistant") {
      window.localStorage.removeItem(STORAGE_KEY);
      return;
    }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-MAX_STORED)));
  } catch {
    // quota / private mode
  }
}

function resolveAssistantTab(pathname: string, tabParam: string | null): string {
  if (pathname.startsWith("/inhalte-erstellen")) return "create";
  if (pathname.startsWith("/videos-erstellen")) return "create-video";
  if (tabParam && tabParam !== "dashboard") return tabParam;
  return "dashboard";
}

/** BrewAI-Assistent — Tab (`page`) oder Dashboard-Spalte (`column`). */
export function BrewAiAssistantView({ variant = "page" }: { variant?: "page" | "column" }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");

  const currentTab = useMemo(
    () => resolveAssistantTab(pathname, tabParam),
    [pathname, tabParam],
  );

  const [assistantInput, setAssistantInput] = useState("");
  const [assistantLoading, setAssistantLoading] = useState(false);
  const [buddyState, setBuddyState] = useState<HopBuddyState>("idle");
  const [assistantMessages, setAssistantMessages] = useState<HopfenHugoMessage[]>(greetingMessages);
  const [hydrated, setHydrated] = useState(false);
  const moodTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const stored = loadStoredMessages();
    if (stored) setAssistantMessages(stored);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    persistMessages(assistantMessages);
  }, [assistantMessages, hydrated]);

  useEffect(() => {
    return () => {
      if (moodTimer.current) clearTimeout(moodTimer.current);
    };
  }, []);

  const flashBuddy = useCallback((next: HopBuddyState, holdMs: number) => {
    if (moodTimer.current) clearTimeout(moodTimer.current);
    setBuddyState(next);
    moodTimer.current = setTimeout(() => setBuddyState("idle"), holdMs);
  }, []);

  const sendAssistantMessage = useCallback(
    async (raw: string) => {
      const trimmed = raw.trim();
      if (!trimmed || assistantLoading) return;

      const nextMessages: HopfenHugoMessage[] = [...assistantMessages, { role: "user", text: trimmed }];
      setAssistantLoading(true);
      setBuddyState("thinking");
      setAssistantInput("");
      setAssistantMessages(nextMessages);

      // Nach kurzem „Nachdenken“ → Schreib-Zustand, solange die Antwort kommt
      const typingKick = window.setTimeout(() => {
        setBuddyState((s) => (s === "thinking" ? "typing" : s));
      }, 900);

      try {
        const res = await fetch("/api/claude/brauerei-assistant", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            messages: nextMessages,
            currentTab,
            assistantPersona: "brewai",
          }),
        });
        const data = (await res.json()) as { answer?: string; error?: string };
        if (!res.ok) throw new Error(data.error ?? "Assistent nicht erreichbar.");
        setAssistantMessages((prev) => [
          ...prev,
          { role: "assistant", text: data.answer ?? "Dazu habe ich gerade keine klare Antwort." },
        ]);
        flashBuddy("done", 1600);
      } catch (error) {
        setAssistantMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            text: error instanceof Error ? error.message : "Assistent konnte nicht antworten.",
          },
        ]);
        flashBuddy("error", 3200);
      } finally {
        window.clearTimeout(typingKick);
        setAssistantLoading(false);
      }
    },
    [assistantLoading, assistantMessages, currentTab, flashBuddy],
  );

  const startNewChat = useCallback(() => {
    if (assistantLoading) return;
    if (moodTimer.current) clearTimeout(moodTimer.current);
    setBuddyState("idle");
    setAssistantInput("");
    setAssistantMessages(greetingMessages());
    persistMessages(greetingMessages());
  }, [assistantLoading]);

  return (
    <HopfenHugoChat
      variant={variant}
      messages={assistantMessages}
      inputValue={assistantInput}
      onInputChange={setAssistantInput}
      onSubmit={() => {
        void sendAssistantMessage(assistantInput);
      }}
      onSendText={(text) => {
        void sendAssistantMessage(text);
      }}
      onNewChat={startNewChat}
      loading={assistantLoading}
      buddyState={buddyState}
    />
  );
}

/** @deprecated Floating-Chat entfernt — nutze BrewAiAssistantView */
export function HopfenHugoAssistant() {
  return <BrewAiAssistantView />;
}
