"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import AIMessage from "@/components/ui/ai-message";
import GradientChatInput from "@/components/ui/gradient-chat-input";
import {
  HopBuddyAvatar,
  type HopBuddyState,
} from "@/components/studio/hop-buddy-avatar";

export type HopfenHugoMessage = {
  role: "user" | "assistant";
  text: string;
};

type HopfenHugoChatProps = {
  messages: HopfenHugoMessage[];
  inputValue: string;
  onInputChange: (value: string) => void;
  onSubmit: () => void;
  onSendText?: (text: string) => void;
  onNewChat?: () => void;
  onOpenHistory?: () => void;
  loading?: boolean;
  /** Extern gesteuerter Avatar-Zustand (thinking / done / error …) */
  buddyState?: HopBuddyState;
  /** page = eigener Tab; column = Dashboard-Spalte */
  variant?: "page" | "column";
};

const SUGGESTIONS = ["Kampagnen-Idee", "Bild-Prompt", "Marketing-Tipp"] as const;
const ASSISTANT_NAME = "BrewAI";

const msgVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: "spring" as const, stiffness: 480, damping: 32 },
  },
};

const STATE_ROLE: Record<HopBuddyState, string> = {
  idle: "KI-Assistent · Studio",
  thinking: "Denkt nach …",
  typing: "Schreibt …",
  speaking: "Spricht …",
  done: "Fertig",
  error: "Da lief etwas schief",
};

export function HopfenHugoChat({
  messages,
  inputValue,
  onInputChange,
  onSubmit,
  onSendText,
  onNewChat,
  onOpenHistory,
  loading = false,
  buddyState,
  variant = "page",
}: HopfenHugoChatProps) {
  const widgetId = useId();
  const scrollRef = useRef<HTMLDivElement>(null);

  const resolvedState: HopBuddyState =
    buddyState ?? (loading ? "thinking" : "idle");

  const isThinking = loading || resolvedState === "thinking" || resolvedState === "typing";
  const showSuggestions =
    !isThinking && messages.length === 1 && messages[0]?.role === "assistant";
  const canNewChat = Boolean(onNewChat) && messages.length > 1 && !loading;

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, isThinking, showSuggestions, resolvedState]);

  const triggerSend = useCallback(
    (text: string) => {
      if (!text.trim() || loading) return;
      if (onSendText) {
        onSendText(text);
      } else {
        onSubmit();
      }
    },
    [loading, onSendText, onSubmit],
  );

  const handleSuggestion = useCallback(
    (label: string) => {
      if (loading) return;
      onSendText?.(label);
    },
    [loading, onSendText],
  );

  return (
    <div
      className={cn("evg-brewai-page", variant === "column" && "evg-brewai-page--column")}
      data-view="brewai-assistant"
    >
      <div
        className={cn(
          "evg-hopfenhugo-panel",
          variant === "column" ? "evg-hopfenhugo-panel--column" : "evg-hopfenhugo-panel--page",
        )}
        aria-labelledby={widgetId}
      >
        <header className="evg-hopfenhugo-head">
          <div className="evg-hopfenhugo-head-inner">
            <div className="evg-hopfenhugo-avatar-wrap">
              <div className="evg-hopfenhugo-avatar-bob" aria-hidden>
                <HopBuddyAvatar
                  state={resolvedState}
                  badge={
                    resolvedState === "thinking" ||
                    resolvedState === "typing" ||
                    resolvedState === "speaking" ||
                    resolvedState === "done" ||
                    resolvedState === "error"
                  }
                />
              </div>
              <span
                className={cn(
                  "evg-hopfenhugo-status",
                  resolvedState === "thinking" && "is-busy",
                  resolvedState === "error" && "is-error",
                  resolvedState === "done" && "is-ok",
                )}
                aria-hidden
              />
            </div>
            <div className="evg-hopfenhugo-head-copy">
              <h1 id={widgetId} className="evg-hopfenhugo-name">
                {ASSISTANT_NAME}
              </h1>
              <p className="evg-hopfenhugo-role" aria-live="polite">
                {STATE_ROLE[resolvedState]}
              </p>
            </div>
            <div className="evg-hopfenhugo-head-actions">
              {onOpenHistory ? (
                <button
                  type="button"
                  className="evg-hopfenhugo-newchat evg-hopfenhugo-history-btn"
                  onClick={onOpenHistory}
                  disabled={loading}
                  aria-label="Chat-Verläufe öffnen"
                >
                  Verläufe
                </button>
              ) : null}
              {onNewChat ? (
                <button
                  type="button"
                  className="evg-hopfenhugo-newchat"
                  onClick={onNewChat}
                  disabled={!canNewChat}
                  aria-label="Neuen Chat starten"
                >
                  Neuer Chat
                </button>
              ) : null}
            </div>
          </div>
        </header>

        <div ref={scrollRef} className="evg-hopfenhugo-messages">
          {messages.map((msg, index) => (
            <motion.div
              key={`${msg.role}-${index}`}
              variants={msgVariants}
              initial="hidden"
              animate="visible"
              className="w-full"
            >
              <AIMessage
                from={msg.role}
                avatar={
                  msg.role === "assistant" ? (
                    <span className="brewai-msg-avatar-ring">
                      <HopBuddyAvatar state="idle" size={28} badge={false} />
                    </span>
                  ) : undefined
                }
                copyText={msg.role === "assistant" ? msg.text : undefined}
                timestamp={msg.role === "assistant" && index === 0 ? "gerade eben" : undefined}
              >
                {msg.role === "assistant" ? (
                  <>
                    <span className="mb-1 block text-[11px] font-medium tracking-wide text-[var(--ac)]">
                      {ASSISTANT_NAME}
                    </span>
                    {msg.text}
                  </>
                ) : (
                  msg.text
                )}
              </AIMessage>
            </motion.div>
          ))}

          {showSuggestions ? (
            <div className="evg-hopfenhugo-suggestions">
              {SUGGESTIONS.map((label) => (
                <button
                  key={label}
                  type="button"
                  className="evg-hopfenhugo-chip"
                  onClick={() => handleSuggestion(label)}
                >
                  {label}
                </button>
              ))}
            </div>
          ) : null}

          {isThinking ? (
            <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="w-full">
              <AIMessage
                from="assistant"
                avatar={
                  <span className="brewai-msg-avatar-ring">
                    <HopBuddyAvatar
                      state={resolvedState === "typing" ? "typing" : "thinking"}
                      size={28}
                      badge={false}
                    />
                  </span>
                }
                bubble
              >
                <span className="inline-flex items-center gap-1.5 py-0.5" aria-label="Denkt nach">
                  <span className="evg-hopfenhugo-dot" />
                  <span className="evg-hopfenhugo-dot" />
                  <span className="evg-hopfenhugo-dot" />
                </span>
              </AIMessage>
            </motion.div>
          ) : null}
        </div>

        <footer className="evg-hopfenhugo-foot">
          <GradientChatInput
            value={inputValue}
            onChange={onInputChange}
            onSend={triggerSend}
            disabled={loading}
            placeholder="Frag BrewAI zu allem …"
            autoReply={null}
            showBubbles={false}
            sound={false}
            className="w-full"
          />
          <p className="evg-hopfenhugo-policy">
            Antworten folgen den{" "}
            <a href="/agb" target="_blank" rel="noopener noreferrer">
              Nutzungsrichtlinien
            </a>
            . Keine Rechts-, Medizin- oder Finanzberatung.
          </p>
        </footer>
      </div>
    </div>
  );
}
