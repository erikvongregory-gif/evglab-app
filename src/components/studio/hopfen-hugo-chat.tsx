"use client";

import { type FormEvent, useCallback, useEffect, useId, useRef, useState } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

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

  const handleSubmit = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      if (!inputValue.trim() || loading) return;
      setTypingPulse(true);
      onSubmit();
      window.setTimeout(() => setTypingPulse(false), 800);
    },
    [inputValue, loading, onSubmit],
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
      data-tour="brewai-assistant"
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
                <svg width="19" height="19" viewBox="0 0 22 22" fill="none">
                  <path
                    d="M11 3c-3 0-5 3-5 6.5C6 14 8.3 17 11 19c2.7-2 5-5 5-9.5C16 6 14 3 11 3z"
                    fill="#fff"
                    opacity="0.95"
                  />
                  <path
                    d="M8.6 8.3c.4-1 1.3-1.6 2.4-1.6s2 .6 2.4 1.6"
                    stroke="var(--ac-3)"
                    strokeWidth="1"
                    strokeLinecap="round"
                    opacity="0.7"
                  />
                </svg>
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
              className={cn("evg-hopfenhugo-row", msg.role === "user" && "evg-hopfenhugo-row--user")}
            >
              {msg.role === "assistant" ? (
                <div className="evg-hopfenhugo-msg-avatar" aria-hidden>
                  <svg width="11" height="11" viewBox="0 0 22 22" fill="none">
                    <path
                      d="M11 3c-3 0-5 3-5 6.5C6 14 8.3 17 11 19c2.7-2 5-5 5-9.5C16 6 14 3 11 3z"
                      fill="#fff"
                    />
                  </svg>
                </div>
              ) : null}
              <div className="evg-hopfenhugo-row-body">
                <div
                  className={cn(
                    "evg-hopfenhugo-bubble",
                    msg.role === "user" ? "evg-hopfenhugo-bubble--user" : "evg-hopfenhugo-bubble--assistant",
                  )}
                >
                  {msg.role === "assistant" ? (
                    <span className="evg-hopfenhugo-bubble-label">{ASSISTANT_NAME}</span>
                  ) : null}
                  <p>{msg.text}</p>
                </div>
                {msg.role === "assistant" && index === 0 ? (
                  <div className="evg-hopfenhugo-time">gerade eben</div>
                ) : null}
              </div>
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
            <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="evg-hopfenhugo-row">
              <div className="evg-hopfenhugo-msg-avatar" aria-hidden>
                <svg width="11" height="11" viewBox="0 0 22 22" fill="none">
                  <path
                    d="M11 3c-3 0-5 3-5 6.5C6 14 8.3 17 11 19c2.7-2 5-5 5-9.5C16 6 14 3 11 3z"
                    fill="#fff"
                  />
                </svg>
              </div>
              <div className="evg-hopfenhugo-row-body">
                <div className="evg-hopfenhugo-bubble evg-hopfenhugo-bubble--assistant evg-hopfenhugo-bubble--typing">
                  <span className="evg-hopfenhugo-dot" />
                  <span className="evg-hopfenhugo-dot" />
                  <span className="evg-hopfenhugo-dot" />
                </div>
              </div>
            </motion.div>
          ) : null}
        </div>

        <footer className="evg-hopfenhugo-foot">
          <form className="evg-hopfenhugo-form" onSubmit={handleSubmit}>
            <input
              type="text"
              value={inputValue}
              onChange={(e) => onInputChange(e.target.value)}
              placeholder="Frag BrewAI zu allem …"
              className="evg-hopfenhugo-input"
              maxLength={1200}
              autoComplete="off"
              aria-label="Nachricht an BrewAI"
            />
            <button
              type="submit"
              className="evg-hopfenhugo-send"
              disabled={!inputValue.trim() || loading}
              aria-label="Nachricht senden"
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M1.5 8L14 2.2 9.4 14.5l-2.3-5.1L1.5 8z" fill="#fff" />
              </svg>
            </button>
          </form>
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
