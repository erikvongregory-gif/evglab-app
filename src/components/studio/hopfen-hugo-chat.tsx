"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import AIMessage from "@/components/ui/ai-message";
import GradientChatInput from "@/components/ui/gradient-chat-input";

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
  loading?: boolean;
  /** page = eigener Tab; column = Dashboard-Spalte */
  variant?: "page" | "column";
};

const SUGGESTIONS = ["Kampagnen-Idee", "Bild-Prompt", "Marketing-Tipp"] as const;
const ASSISTANT_NAME = "BrewAI";

const msgVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 480, damping: 32 } },
};

function BrewAiAvatar({ size = 19 }: { size?: number }) {
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full bg-[var(--ac,oklch(0.55_0.14_55))]"
      style={{ width: size + 8, height: size + 8 }}
      aria-hidden
    >
      <svg width={size} height={size} viewBox="0 0 22 22" fill="none">
        <path
          d="M11 3c-3 0-5 3-5 6.5C6 14 8.3 17 11 19c2.7-2 5-5 5-9.5C16 6 14 3 11 3z"
          fill="#fff"
          opacity="0.95"
        />
        <path
          d="M8.6 8.3c.4-1 1.3-1.6 2.4-1.6s2 .6 2.4 1.6"
          stroke="var(--ac-3, oklch(0.45 0.1 55))"
          strokeWidth="1"
          strokeLinecap="round"
          opacity="0.7"
        />
      </svg>
    </div>
  );
}

export function HopfenHugoChat({
  messages,
  inputValue,
  onInputChange,
  onSubmit,
  onSendText,
  loading = false,
  variant = "page",
}: HopfenHugoChatProps) {
  const widgetId = useId();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [typingPulse, setTypingPulse] = useState(false);

  const isThinking = loading || typingPulse;
  const showSuggestions =
    !isThinking && messages.length === 1 && messages[0]?.role === "assistant";

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, isThinking, showSuggestions]);

  const triggerSend = useCallback(
    (text: string) => {
      if (!text.trim() || loading) return;
      setTypingPulse(true);
      if (onSendText) {
        onSendText(text);
      } else {
        onSubmit();
      }
      window.setTimeout(() => setTypingPulse(false), 800);
    },
    [loading, onSendText, onSubmit],
  );

  const handleSuggestion = useCallback(
    (label: string) => {
      if (loading) return;
      setTypingPulse(true);
      onSendText?.(label);
      window.setTimeout(() => setTypingPulse(false), 800);
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
                <BrewAiAvatar />
              </div>
              <span className="evg-hopfenhugo-status" aria-hidden />
            </div>
            <div className="evg-hopfenhugo-head-copy">
              <h1 id={widgetId} className="evg-hopfenhugo-name">
                {ASSISTANT_NAME}
              </h1>
              <p className="evg-hopfenhugo-role">KI-Assistent · Studio</p>
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
                avatar={msg.role === "assistant" ? <BrewAiAvatar size={14} /> : undefined}
                copyText={msg.role === "assistant" ? msg.text : undefined}
                timestamp={msg.role === "assistant" && index === 0 ? "gerade eben" : undefined}
              >
                {msg.role === "assistant" ? (
                  <>
                    <span className="mb-1 block text-[11px] font-medium text-muted-foreground">
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
              <AIMessage from="assistant" avatar={<BrewAiAvatar size={14} />} bubble>
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
            className="max-w-none"
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
