"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname, useSearchParams } from "next/navigation";
import { HOPFEN_HUGO_GREETING } from "@/lib/assistant/hopfenHugoPolicy";
import { HopfenHugoChat, type HopfenHugoMessage } from "@/components/studio/hopfen-hugo-chat";
import type { HopBuddyState } from "@/components/studio/hop-buddy-avatar";

const LEGACY_KEY = "brewai.assistant.active";
const STORE_KEY = "brewai.assistant.threads";
const MAX_STORED = 40;
const MAX_THREADS = 20;

export type AssistantConversation = {
  id: string;
  title: string;
  updatedAt: number;
  messages: HopfenHugoMessage[];
};

type ThreadStore = {
  activeId: string;
  conversations: AssistantConversation[];
};

function greetingMessages(): HopfenHugoMessage[] {
  return [{ role: "assistant", text: HOPFEN_HUGO_GREETING }];
}

function newId() {
  return `c_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function isRealThread(messages: HopfenHugoMessage[]) {
  return !(messages.length <= 1 && messages[0]?.role === "assistant");
}

function titleFromMessages(messages: HopfenHugoMessage[]) {
  const firstUser = messages.find((m) => m.role === "user" && m.text.trim());
  if (!firstUser) return "Neuer Chat";
  const t = firstUser.text.trim().replace(/\s+/g, " ");
  return t.length > 42 ? `${t.slice(0, 42)}…` : t;
}

function sanitizeMessages(raw: unknown): HopfenHugoMessage[] | null {
  if (!Array.isArray(raw)) return null;
  const msgs = raw
    .filter(
      (m): m is HopfenHugoMessage =>
        !!m &&
        (m.role === "user" || m.role === "assistant") &&
        typeof m.text === "string" &&
        m.text.trim().length > 0,
    )
    .slice(-MAX_STORED);
  return msgs.length > 0 ? msgs : null;
}

function makeConversation(messages: HopfenHugoMessage[], id = newId()): AssistantConversation {
  return {
    id,
    title: titleFromMessages(messages),
    updatedAt: Date.now(),
    messages,
  };
}

function emptyStore(): ThreadStore {
  const conv = makeConversation(greetingMessages());
  return { activeId: conv.id, conversations: [conv] };
}

function loadStore(): ThreadStore {
  if (typeof window === "undefined") return emptyStore();
  try {
    const raw = window.localStorage.getItem(STORE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<ThreadStore>;
      const conversations = Array.isArray(parsed.conversations)
        ? parsed.conversations
            .map((c) => {
              if (!c || typeof c !== "object") return null;
              const messages = sanitizeMessages((c as AssistantConversation).messages);
              if (!messages) return null;
              const id = typeof (c as AssistantConversation).id === "string" ? (c as AssistantConversation).id : newId();
              const title =
                typeof (c as AssistantConversation).title === "string" && (c as AssistantConversation).title.trim()
                  ? (c as AssistantConversation).title.trim()
                  : titleFromMessages(messages);
              const updatedAt =
                typeof (c as AssistantConversation).updatedAt === "number"
                  ? (c as AssistantConversation).updatedAt
                  : Date.now();
              return { id, title, updatedAt, messages } satisfies AssistantConversation;
            })
            .filter((c): c is AssistantConversation => !!c)
            .slice(0, MAX_THREADS)
        : [];
      if (conversations.length > 0) {
        const activeId =
          typeof parsed.activeId === "string" && conversations.some((c) => c.id === parsed.activeId)
            ? parsed.activeId
            : conversations[0].id;
        return { activeId, conversations };
      }
    }

    // ponytail: migrate single-thread key once
    const legacy = window.localStorage.getItem(LEGACY_KEY);
    if (legacy) {
      const messages = sanitizeMessages(JSON.parse(legacy));
      if (messages && isRealThread(messages)) {
        const conv = makeConversation(messages);
        window.localStorage.removeItem(LEGACY_KEY);
        return { activeId: conv.id, conversations: [conv] };
      }
      window.localStorage.removeItem(LEGACY_KEY);
    }
  } catch {
    // quota / private mode / bad JSON
  }
  return emptyStore();
}

function persistStore(store: ThreadStore) {
  if (typeof window === "undefined") return;
  try {
    const conversations = store.conversations
      .filter((c) => isRealThread(c.messages) || c.id === store.activeId)
      .slice(0, MAX_THREADS)
      .map((c) => ({
        ...c,
        messages: c.messages.slice(-MAX_STORED),
        title: c.title || titleFromMessages(c.messages),
      }));
    const activeId = conversations.some((c) => c.id === store.activeId)
      ? store.activeId
      : conversations[0]?.id;
    if (!activeId || conversations.length === 0) {
      window.localStorage.removeItem(STORE_KEY);
      return;
    }
    window.localStorage.setItem(STORE_KEY, JSON.stringify({ activeId, conversations }));
  } catch {
    // quota / private mode
  }
}

function formatThreadTime(ts: number) {
  const d = new Date(ts);
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) {
    return d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
  }
  return d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" });
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
  const [store, setStore] = useState<ThreadStore>(emptyStore);
  const [hydrated, setHydrated] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const moodTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const active = store.conversations.find((c) => c.id === store.activeId) ?? store.conversations[0];
  const assistantMessages = active?.messages ?? greetingMessages();

  useEffect(() => {
    setStore(loadStore());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    persistStore(store);
  }, [store, hydrated]);

  useEffect(() => {
    if (!historyOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setHistoryOpen(false);
    };
    const mq = window.matchMedia("(max-width: 900px)");
    const onMq = () => {
      if (!mq.matches) setHistoryOpen(false);
    };
    window.addEventListener("keydown", onKey);
    mq.addEventListener("change", onMq);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
      mq.removeEventListener("change", onMq);
    };
  }, [historyOpen]);

  useEffect(() => {
    return () => {
      if (moodTimer.current) clearTimeout(moodTimer.current);
    };
  }, []);

  const updateActiveMessages = useCallback((messages: HopfenHugoMessage[]) => {
    setStore((prev) => {
      const id = prev.activeId;
      const conversations = prev.conversations.map((c) =>
        c.id === id
          ? {
              ...c,
              messages,
              title: isRealThread(messages) ? titleFromMessages(messages) : c.title,
              updatedAt: Date.now(),
            }
          : c,
      );
      return { ...prev, conversations };
    });
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
      updateActiveMessages(nextMessages);

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
        updateActiveMessages([
          ...nextMessages,
          { role: "assistant", text: data.answer ?? "Dazu habe ich gerade keine klare Antwort." },
        ]);
        flashBuddy("done", 1600);
      } catch (error) {
        updateActiveMessages([
          ...nextMessages,
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
    [assistantLoading, assistantMessages, currentTab, flashBuddy, updateActiveMessages],
  );

  const startNewChat = useCallback(() => {
    if (assistantLoading) return;
    if (moodTimer.current) clearTimeout(moodTimer.current);
    setBuddyState("idle");
    setAssistantInput("");
    setStore((prev) => {
      const kept = prev.conversations.filter((c) => isRealThread(c.messages));
      const next = makeConversation(greetingMessages());
      return {
        activeId: next.id,
        conversations: [next, ...kept].slice(0, MAX_THREADS),
      };
    });
  }, [assistantLoading]);

  const selectConversation = useCallback(
    (id: string) => {
      if (assistantLoading || id === store.activeId) {
        setHistoryOpen(false);
        return;
      }
      if (moodTimer.current) clearTimeout(moodTimer.current);
      setBuddyState("idle");
      setAssistantInput("");
      setStore((prev) => ({ ...prev, activeId: id }));
      setHistoryOpen(false);
    },
    [assistantLoading, store.activeId],
  );

  const deleteConversation = useCallback(
    (id: string) => {
      if (assistantLoading) return;
      setStore((prev) => {
        const remaining = prev.conversations.filter((c) => c.id !== id);
        if (remaining.length === 0) {
          const next = makeConversation(greetingMessages());
          return { activeId: next.id, conversations: [next] };
        }
        const activeId = prev.activeId === id ? remaining[0].id : prev.activeId;
        return { activeId, conversations: remaining };
      });
    },
    [assistantLoading],
  );

  const historyList = useMemo(
    () =>
      [...store.conversations]
        .filter((c) => isRealThread(c.messages) || c.id === store.activeId)
        .sort((a, b) => b.updatedAt - a.updatedAt),
    [store],
  );

  const renderHistoryList = (showClose: boolean) => (
    <>
      <div className="evg-brewai-history-head">
        <span className="evg-brewai-history-title">Verläufe</span>
        <div className="evg-brewai-history-head-actions">
          <button
            type="button"
            className="evg-hopfenhugo-newchat"
            onClick={() => {
              startNewChat();
              setHistoryOpen(false);
            }}
            disabled={assistantLoading || !isRealThread(assistantMessages)}
          >
            Neu
          </button>
          {showClose ? (
            <button
              type="button"
              className="evg-hopfenhugo-newchat evg-brewai-history-close"
              onClick={() => setHistoryOpen(false)}
              aria-label="Schließen"
            >
              Schließen
            </button>
          ) : null}
        </div>
      </div>
      <ul className="evg-brewai-history-list">
        {historyList.map((c) => {
          const selected = c.id === store.activeId;
          const preview =
            [...c.messages].reverse().find((m) => m.role === "user")?.text ??
            c.messages[c.messages.length - 1]?.text ??
            "";
          return (
            <li key={c.id}>
              <button
                type="button"
                className={`evg-brewai-history-item${selected ? " is-active" : ""}`}
                onClick={() => selectConversation(c.id)}
                disabled={assistantLoading}
              >
                <span className="evg-brewai-history-item-top">
                  <span className="evg-brewai-history-item-title">{c.title}</span>
                  <span className="evg-brewai-history-item-time">{formatThreadTime(c.updatedAt)}</span>
                </span>
                <span className="evg-brewai-history-item-preview">{preview}</span>
              </button>
              {isRealThread(c.messages) ? (
                <button
                  type="button"
                  className="evg-brewai-history-delete"
                  aria-label={`„${c.title}“ löschen`}
                  onClick={() => deleteConversation(c.id)}
                  disabled={assistantLoading}
                >
                  ×
                </button>
              ) : null}
            </li>
          );
        })}
      </ul>
    </>
  );

  const chat = (
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
      onOpenHistory={variant === "page" ? () => setHistoryOpen(true) : undefined}
      loading={assistantLoading}
      buddyState={buddyState}
    />
  );

  if (variant !== "page") return chat;

  const mobileSheet =
    historyOpen && typeof document !== "undefined"
      ? createPortal(
          <div className="evg-brewai-history-sheet" role="dialog" aria-modal="true" aria-label="Chat-Verläufe">
            <aside className="evg-brewai-history evg-brewai-history--sheet">{renderHistoryList(true)}</aside>
          </div>,
          document.body,
        )
      : null;

  return (
    <div className="evg-brewai-shell">
      <aside className="evg-brewai-history evg-brewai-history--rail" aria-label="Chat-Verläufe">
        {renderHistoryList(false)}
      </aside>
      <div className="evg-brewai-shell-main">{chat}</div>
      {mobileSheet}
    </div>
  );
}

/** @deprecated Floating-Chat entfernt — nutze BrewAiAssistantView */
export function HopfenHugoAssistant() {
  return <BrewAiAssistantView />;
}
