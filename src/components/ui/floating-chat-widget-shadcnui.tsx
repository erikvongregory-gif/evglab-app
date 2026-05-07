"use client";

import { type FormEvent, type ReactNode, useCallback, useId, useMemo, useState } from "react";
import { AnimatePresence, motion, type Variants } from "framer-motion";
import { Send, X } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { HopfenHugoAvatar } from "@/components/branding/HopfenHugoAvatar";
import { HopfenHugoIcon } from "@/components/branding/HopfenHugoIcon";
import { cn } from "@/lib/utils";

type AssistantAgent = {
  id: string;
  name: string;
  role: string;
  avatar?: string;
  /**
   * Optionaler Custom-Renderer fuer den Avatar. Wenn gesetzt, wird er statt `avatar` (URL)
   * verwendet — wir leiten den `thinking`-Zustand und die gewuenschte Pixel-Groesse durch.
   */
  renderAvatar?: (ctx: { thinking: boolean; size: number }) => ReactNode;
  status: "online" | "busy" | "offline";
  gradient: string;
};

type AssistantMessage = {
  role: "user" | "assistant";
  text: string;
};

type FloatingChatWidgetProps = {
  isOpen: boolean;
  onToggle: () => void;
  selectedAgent: string;
  agents: AssistantAgent[];
  messages: AssistantMessage[];
  inputValue: string;
  onInputChange: (value: string) => void;
  onSubmit: () => void;
  loading?: boolean;
  onboardingAttr?: string;
};

const containerVariants: Variants = {
  hidden: {
    opacity: 0,
    y: 20,
    scale: 0.95,
    transformOrigin: "bottom right",
  },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      type: "spring",
      damping: 25,
      stiffness: 300,
      staggerChildren: 0.05,
    },
  },
  exit: {
    opacity: 0,
    y: 20,
    scale: 0.95,
    transition: {
      duration: 0.2,
    },
  },
};

const messageVariants: Variants = {
  hidden: { opacity: 0, y: 10, x: -10 },
  visible: {
    opacity: 1,
    y: 0,
    x: 0,
    transition: { type: "spring", stiffness: 500, damping: 30 },
  },
};

function AgentAvatar({
  agent,
  size,
  thinking,
  className,
}: {
  agent: AssistantAgent;
  size: number;
  thinking: boolean;
  className?: string;
}) {
  if (agent.renderAvatar) {
    return (
      <div
        className={cn("flex shrink-0 items-center justify-center overflow-hidden rounded-full", className)}
        style={{ width: size, height: size }}
        aria-hidden
      >
        {agent.renderAvatar({ thinking, size })}
      </div>
    );
  }
  return (
    <Avatar className={cn(className)} style={{ width: size, height: size }}>
      <AvatarImage src={agent.avatar} alt={agent.name} />
      <AvatarFallback>AI</AvatarFallback>
    </Avatar>
  );
}

export function FloatingChatWidget({
  isOpen,
  onToggle,
  selectedAgent,
  agents,
  messages,
  inputValue,
  onInputChange,
  onSubmit,
  loading = false,
  onboardingAttr,
}: FloatingChatWidgetProps) {
  const widgetId = useId();
  const [typingVisible, setTypingVisible] = useState(false);

  const currentAgent = useMemo(
    () => agents.find((a) => a.id === selectedAgent) || agents[0],
    [agents, selectedAgent],
  );

  const statusClass =
    currentAgent?.status === "online"
      ? "bg-emerald-500"
      : currentAgent?.status === "busy"
        ? "bg-amber-500"
        : "bg-slate-400";

  const handleSubmit = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      setTypingVisible(true);
      onSubmit();
      window.setTimeout(() => setTypingVisible(false), 900);
    },
    [onSubmit],
  );

  const isThinking = loading || typingVisible;

  if (!currentAgent) return null;

  return (
    <div
      className={cn(
        "fixed z-[96] flex flex-col items-end gap-4",
        // Über der mobilen Tab-Leiste (fixed bottom, inkl. Safe Area + mittlerer Sparkle-Button)
        "max-md:bottom-[calc(max(0.75rem,env(safe-area-inset-bottom))+6.85rem)] max-md:right-3",
        "md:bottom-6 md:right-6",
      )}
    >
      <AnimatePresence>
        {isOpen ? (
          <motion.div
            key="chat-window"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="w-[380px] overflow-hidden rounded-2xl border border-zinc-200/80 bg-white shadow-2xl ring-1 ring-black/5 max-sm:w-[92vw]"
            aria-labelledby={widgetId}
          >
            <div className="relative overflow-hidden border-b border-zinc-200 bg-zinc-50/90 p-4">
              <div
                className={cn(
                  "absolute inset-0 bg-gradient-to-br opacity-50",
                  currentAgent.gradient,
                )}
              />
              <div className="relative z-10 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <AgentAvatar
                      agent={currentAgent}
                      size={40}
                      thinking={isThinking}
                      className="border-2 border-background shadow-sm"
                    />
                    <span
                      className={cn(
                        "absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-background",
                        statusClass,
                      )}
                    />
                  </div>
                  <div>
                    <h3 id={widgetId} className="text-sm font-semibold text-zinc-900">
                      {currentAgent.name}
                    </h3>
                    <span className="text-xs text-zinc-600">{currentAgent.role}</span>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-full hover:bg-zinc-100"
                  onClick={onToggle}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="flex h-[320px] flex-col gap-3 overflow-y-auto bg-gradient-to-b from-white to-zinc-50 p-4">
              {messages.map((msg, index) => (
                <motion.div
                  key={`${msg.role}-${index}`}
                  variants={messageVariants}
                  initial="hidden"
                  animate="visible"
                  className={cn("flex gap-3", msg.role === "user" ? "flex-row-reverse self-end" : "")}
                >
                  {msg.role === "assistant" ? (
                    <AgentAvatar
                      agent={currentAgent}
                      size={32}
                      thinking={false}
                      className="border border-border/40 shadow-sm"
                    />
                  ) : (
                    <Avatar className="h-8 w-8 border border-border/40 shadow-sm">
                      <AvatarImage src="https://api.dicebear.com/9.x/identicon/svg?seed=neutral-user&backgroundColor=e2e8f0,cbd5e1,f1f5f9" />
                      <AvatarFallback className="bg-zinc-300 text-zinc-700 font-semibold">DU</AvatarFallback>
                    </Avatar>
                  )}
                  <div className={cn("flex max-w-[85%] flex-col gap-1", msg.role === "user" ? "items-end" : "")}>
                    {msg.role === "assistant" ? (
                      <span className="text-xs font-medium text-zinc-600">{currentAgent.name}</span>
                    ) : null}
                    <div
                      className={cn(
                        "px-4 py-2.5 text-sm shadow-sm",
                        msg.role === "assistant"
                          ? "rounded-2xl rounded-tl-none border border-zinc-200 bg-white text-zinc-900"
                          : "rounded-2xl rounded-tr-none bg-zinc-900 text-white shadow-md",
                      )}
                    >
                      <p>{msg.text}</p>
                    </div>
                  </div>
                </motion.div>
              ))}

              {isThinking ? (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex gap-3"
                >
                  <AgentAvatar
                    agent={currentAgent}
                    size={32}
                    thinking={true}
                    className="border border-border/40 shadow-sm"
                  />
                  <div className="rounded-2xl rounded-tl-none border border-zinc-200 bg-white px-4 py-3 shadow-sm">
                    <div className="flex items-center justify-center gap-1">
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-foreground/40 [animation-delay:-0.3s]" />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-foreground/40 [animation-delay:-0.15s]" />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-foreground/40" />
                    </div>
                  </div>
                </motion.div>
              ) : null}
            </div>

            <div className="border-t border-zinc-200 bg-white p-3">
              <form className="relative flex items-center gap-2" onSubmit={handleSubmit}>
                <input
                  type="text"
                  value={inputValue}
                  onChange={(e) => onInputChange(e.target.value)}
                  placeholder={`Frage zu Bild / Prompt (${currentAgent.name}) …`}
                  className="flex-1 rounded-full border border-zinc-300 bg-white px-4 py-2.5 text-sm text-zinc-900 outline-none transition-all placeholder:text-zinc-500 focus:border-primary/50 focus:ring-2 focus:ring-primary/10"
                />
                <Button
                  size="icon"
                  className="h-10 w-10 rounded-full bg-zinc-900 text-white shadow-lg transition-transform hover:scale-105 hover:shadow-black/20"
                  disabled={!inputValue.trim() || loading}
                >
                  <Send className="h-4 w-4" />
                </Button>
              </form>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={onToggle}
        data-onboarding={onboardingAttr}
        className={cn(
          "group relative flex h-15 w-15 cursor-pointer items-center justify-center overflow-hidden rounded-full border-2 border-white shadow-2xl transition-all duration-300",
          isOpen
            ? "rotate-90 bg-zinc-900 text-white"
            : "bg-[#c8ff26] text-black hover:shadow-[#c8ff26]/40",
        )}
        aria-label={isOpen ? "Chat schließen" : "Chat öffnen"}
      >
        <span className="absolute inset-0 -z-10 rounded-full bg-inherit opacity-20 blur-xl transition-opacity duration-300 group-hover:opacity-40" />
        {isOpen ? (
          <X className="h-7 w-7 text-white" strokeWidth={2.5} />
        ) : (
          <HopfenHugoIcon className="h-12 w-12" />
        )}
      </motion.button>
    </div>
  );
}

export const DEFAULT_HOPFEN_AGENTS: AssistantAgent[] = [
  {
    id: "hopfen-hugo",
    name: "Hopfen Hugo",
    role: "Assistent für KI-Werbebilder",
    renderAvatar: ({ thinking, size }) => <HopfenHugoAvatar size={size} thinking={thinking} />,
    status: "online",
    gradient: "from-lime-500/20 to-emerald-500/20",
  },
];
