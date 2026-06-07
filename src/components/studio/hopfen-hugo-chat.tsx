"use client";

import { type FormEvent, useCallback, useEffect, useId, useRef, useState } from "react";
import { AnimatePresence, motion, type Variants } from "framer-motion";
import { HopfenHugoAvatar } from "@/components/branding/HopfenHugoAvatar";
import { HopfenHugoIcon } from "@/components/branding/HopfenHugoIcon";
import { cn } from "@/lib/utils";

export type HopfenHugoMessage = {
  role: "user" | "assistant";
  text: string;
};

type HopfenHugoChatProps = {
  isOpen: boolean;
  onToggle: () => void;
  messages: HopfenHugoMessage[];
  inputValue: string;
  onInputChange: (value: string) => void;
  onSubmit: () => void;
  loading?: boolean;
  onboardingAttr?: string;
};

const panelVariants: Variants = {
  hidden: { opacity: 0, y: 16, scale: 0.96, transformOrigin: "bottom right" },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: "spring", damping: 26, stiffness: 320 },
  },
  exit: { opacity: 0, y: 12, scale: 0.97, transition: { duration: 0.18 } },
};

const msgVariants: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 480, damping: 32 } },
};

export function HopfenHugoChat({
  isOpen,
  onToggle,
  messages,
  inputValue,
  onInputChange,
  onSubmit,
  loading = false,
  onboardingAttr,
}: HopfenHugoChatProps) {
  const widgetId = useId();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [typingPulse, setTypingPulse] = useState(false);

  const isThinking = loading || typingPulse;

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, isThinking, isOpen]);

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

  return (
    <div
      className={cn(
        "evg-hopfenhugo-root fixed z-[96] flex flex-col items-end gap-3",
        "max-md:bottom-[calc(max(0.75rem,env(safe-area-inset-bottom))+6.85rem)] max-md:right-3",
        "md:bottom-6 md:right-6",
      )}
    >
      <AnimatePresence>
        {isOpen ? (
          <motion.div
            key="hopfenhugo-panel"
            variants={panelVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="evg-hopfenhugo-panel"
            aria-labelledby={widgetId}
          >
            <header className="evg-hopfenhugo-head">
              <div className="evg-hopfenhugo-head-glow" aria-hidden />
              <div className="evg-hopfenhugo-head-inner">
                <div className="evg-hopfenhugo-avatar-wrap">
                  <HopfenHugoAvatar size={42} thinking={isThinking} />
                  <span className="evg-hopfenhugo-status" aria-hidden />
                </div>
                <div className="evg-hopfenhugo-head-copy">
                  <h3 id={widgetId} className="evg-hopfenhugo-name">
                    Hopfen Hugo
                  </h3>
                  <p className="evg-hopfenhugo-role">KI-Assistent · EvGlab Studio</p>
                </div>
                <button type="button" className="evg-hopfenhugo-close" onClick={onToggle} aria-label="Chat schließen">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
                    <path d="M4 4 L12 12 M12 4 L4 12" />
                  </svg>
                </button>
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
                      <HopfenHugoAvatar size={28} thinking={false} />
                    </div>
                  ) : null}
                  <div className={cn("evg-hopfenhugo-bubble", msg.role === "user" ? "evg-hopfenhugo-bubble--user" : "evg-hopfenhugo-bubble--assistant")}>
                    {msg.role === "assistant" ? <span className="evg-hopfenhugo-bubble-label">Hopfen Hugo</span> : null}
                    <p>{msg.text}</p>
                  </div>
                </motion.div>
              ))}

              {isThinking ? (
                <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="evg-hopfenhugo-row">
                  <div className="evg-hopfenhugo-msg-avatar" aria-hidden>
                    <HopfenHugoAvatar size={28} thinking />
                  </div>
                  <div className="evg-hopfenhugo-bubble evg-hopfenhugo-bubble--assistant evg-hopfenhugo-bubble--typing">
                    <span className="evg-hopfenhugo-dot" />
                    <span className="evg-hopfenhugo-dot" />
                    <span className="evg-hopfenhugo-dot" />
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
                  placeholder="Frag mich zu allem …"
                  className="evg-hopfenhugo-input"
                  maxLength={1200}
                  autoComplete="off"
                />
                <button
                  type="submit"
                  className="evg-hopfenhugo-send"
                  disabled={!inputValue.trim() || loading}
                  aria-label="Nachricht senden"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M22 2 L11 13" />
                    <path d="M22 2 L15 22 L11 13 L2 9 Z" />
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
          </motion.div>
        ) : null}
      </AnimatePresence>

      <motion.button
        type="button"
        whileHover={{ scale: 1.04 }}
        whileTap={{ scale: 0.96 }}
        onClick={onToggle}
        data-onboarding={onboardingAttr}
        className={cn("evg-hopfenhugo-fab", isOpen && "evg-hopfenhugo-fab--open")}
        aria-label={isOpen ? "Hopfen Hugo schließen" : "Hopfen Hugo öffnen"}
        aria-expanded={isOpen}
      >
        {isOpen ? (
          <svg width="24" height="24" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M4 4 L12 12 M12 4 L4 12" />
          </svg>
        ) : (
          <HopfenHugoIcon className="evg-hopfenhugo-fab-icon" title="Hopfen Hugo" />
        )}
      </motion.button>
    </div>
  );
}
