"use client";

import React from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import {
  ArrowUp,
  Check,
  ChevronDown,
  Gem,
  ImagePlus,
  RectangleHorizontal,
  Sparkles,
  Square,
  X,
} from "lucide-react";
import { motion } from "framer-motion";
import { GenerateButtonParticles } from "@/components/ui/generate-button-particles";
import { MAX_REFERENCE_UPLOADS } from "@/lib/image-types/policy";

const cn = (...classes: (string | undefined | null | false)[]) => classes.filter(Boolean).join(" ");

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("FileReader error"));
    reader.readAsDataURL(file);
  });
}

const styles = `
  *:focus-visible {
    outline-offset: 0 !important;
    --ring-offset: 0 !important;
  }
  textarea::-webkit-scrollbar {
    width: 6px;
  }
  textarea::-webkit-scrollbar-track {
    background: transparent;
  }
  textarea::-webkit-scrollbar-thumb {
    background-color: #444444;
    border-radius: 3px;
  }
  textarea::-webkit-scrollbar-thumb:hover {
    background-color: #555555;
  }
`;

function StyleInjector() {
  React.useEffect(() => {
    const styleSheet = document.createElement("style");
    styleSheet.setAttribute("data-ai-prompt-box", "true");
    styleSheet.innerText = styles;
    document.head.appendChild(styleSheet);

    return () => {
      styleSheet.remove();
    };
  }, []);

  return null;
}

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  className?: string;
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(({ className, ...props }, ref) => (
  <textarea
    className={cn(
      "min-h-[64px] w-full resize-none rounded-md border-none bg-transparent px-3 py-3 text-base leading-6 text-gray-100 placeholder:text-gray-400 sm:min-h-[44px] sm:py-2.5 sm:leading-5 focus-visible:outline-none focus-visible:ring-0 disabled:cursor-not-allowed disabled:opacity-50",
      className,
    )}
    ref={ref}
    rows={1}
    {...props}
  />
));
Textarea.displayName = "Textarea";

const TooltipProvider = TooltipPrimitive.Provider;
const Tooltip = TooltipPrimitive.Root;
const TooltipTrigger = TooltipPrimitive.Trigger;
const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => (
  <TooltipPrimitive.Content
    ref={ref}
    sideOffset={sideOffset}
    className={cn(
      "z-50 overflow-hidden rounded-md border border-[#333333] bg-[#1F2023] px-3 py-1.5 text-sm text-white shadow-md animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
      className,
    )}
    {...props}
  />
));
TooltipContent.displayName = TooltipPrimitive.Content.displayName;

const Dialog = DialogPrimitive.Root;
const DialogPortal = DialogPrimitive.Portal;
const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-black/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className,
    )}
    {...props}
  />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        "fixed left-[50%] top-[50%] z-50 grid w-full max-w-[90vw] translate-x-[-50%] translate-y-[-50%] gap-4 rounded-2xl border border-[#333333] bg-[#1F2023] p-0 shadow-xl duration-300 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 md:max-w-[800px]",
        className,
      )}
      {...props}
    >
      {children}
      <DialogPrimitive.Close className="absolute right-4 top-4 z-10 rounded-full bg-[#2E3033]/80 p-2 transition-all hover:bg-[#2E3033]">
        <X className="h-5 w-5 text-gray-200 hover:text-white" />
        <span className="sr-only">Close</span>
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPortal>
));
DialogContent.displayName = DialogPrimitive.Content.displayName;

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn("text-lg font-semibold leading-none tracking-tight text-gray-100", className)}
    {...props}
  />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "lg" | "icon";
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", ...props }, ref) => {
    const variantClasses = {
      default: "bg-white hover:bg-white/80 text-black",
      outline: "border border-[#444444] bg-transparent hover:bg-[#3A3A40]",
      ghost: "bg-transparent hover:bg-[#3A3A40]",
    };
    const sizeClasses = {
      default: "h-10 px-4 py-2",
      sm: "h-8 px-3 text-sm",
      lg: "h-12 px-6",
      icon: "h-8 w-8 rounded-full aspect-[1/1]",
    };

    return (
      <button
        className={cn(
          "inline-flex items-center justify-center font-medium transition-colors focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50",
          variantClasses[variant],
          sizeClasses[size],
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

interface ImageViewDialogProps {
  imageUrl: string | null;
  onClose: () => void;
}

const ImageViewDialog: React.FC<ImageViewDialogProps> = ({ imageUrl, onClose }) => {
  if (!imageUrl) return null;

  return (
    <Dialog open={!!imageUrl} onOpenChange={onClose}>
      <DialogContent className="max-w-[90vw] border-none bg-transparent p-0 shadow-none md:max-w-[800px]">
        <DialogTitle className="sr-only">Image Preview</DialogTitle>
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="relative overflow-hidden rounded-2xl bg-[#1F2023] shadow-2xl"
        >
          <img src={imageUrl} alt="Full preview" className="max-h-[80vh] w-full rounded-2xl object-contain" />
        </motion.div>
      </DialogContent>
    </Dialog>
  );
};

interface PromptInputContextType {
  isLoading: boolean;
  value: string;
  setValue: (value: string) => void;
  maxHeight: number | string;
  onSubmit?: () => void;
  disabled?: boolean;
}

const PromptInputContext = React.createContext<PromptInputContextType>({
  isLoading: false,
  value: "",
  setValue: () => {},
  maxHeight: 240,
  onSubmit: undefined,
  disabled: false,
});

function usePromptInput() {
  const context = React.useContext(PromptInputContext);
  if (!context) throw new Error("usePromptInput must be used within a PromptInput");
  return context;
}

interface PromptInputProps {
  isLoading?: boolean;
  value?: string;
  onValueChange?: (value: string) => void;
  maxHeight?: number | string;
  onSubmit?: () => void;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
  onDragOver?: (e: React.DragEvent) => void;
  onDragLeave?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
}

const PromptInput = React.forwardRef<HTMLDivElement, PromptInputProps>(
  (
    {
      className,
      isLoading = false,
      maxHeight = 240,
      value,
      onValueChange,
      onSubmit,
      children,
      disabled = false,
      onDragOver,
      onDragLeave,
      onDrop,
    },
    ref,
  ) => {
    const [internalValue, setInternalValue] = React.useState(value || "");

    const handleChange = (newValue: string) => {
      setInternalValue(newValue);
      onValueChange?.(newValue);
    };

    return (
      <TooltipProvider>
        <PromptInputContext.Provider
          value={{
            isLoading,
            value: value ?? internalValue,
            setValue: onValueChange ?? handleChange,
            maxHeight,
            onSubmit,
            disabled,
          }}
        >
          <div
            ref={ref}
            className={cn(
              "rounded-3xl border border-[#444444] bg-[#1F2023] p-1.5 shadow-[0_8px_30px_rgba(0,0,0,0.24)] transition-all duration-300",
              isLoading && "border-red-500/70",
              className,
            )}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
          >
            {children}
          </div>
        </PromptInputContext.Provider>
      </TooltipProvider>
    );
  },
);
PromptInput.displayName = "PromptInput";

interface PromptInputTextareaProps {
  disableAutosize?: boolean;
  placeholder?: string;
}

const PromptInputTextarea: React.FC<PromptInputTextareaProps & React.ComponentProps<typeof Textarea>> = ({
  className,
  onKeyDown,
  disableAutosize = false,
  placeholder,
  ...props
}) => {
  const { value, setValue, maxHeight, onSubmit, disabled } = usePromptInput();
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  React.useEffect(() => {
    if (disableAutosize || !textareaRef.current) return;
    textareaRef.current.style.height = "auto";
    textareaRef.current.style.height =
      typeof maxHeight === "number"
        ? `${Math.min(textareaRef.current.scrollHeight, maxHeight)}px`
        : `min(${textareaRef.current.scrollHeight}px, ${maxHeight})`;
  }, [value, maxHeight, disableAutosize]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSubmit?.();
    }
    onKeyDown?.(e);
  };

  return (
    <Textarea
      ref={textareaRef}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={handleKeyDown}
      className={cn("text-base", className)}
      disabled={disabled}
      placeholder={placeholder}
      {...props}
    />
  );
};

type PromptInputActionsProps = React.HTMLAttributes<HTMLDivElement>;
const PromptInputActions: React.FC<PromptInputActionsProps> = ({ children, className, ...props }) => (
  <div className={cn("flex items-center gap-2", className)} {...props}>
    {children}
  </div>
);

interface PromptInputActionProps extends React.ComponentProps<typeof Tooltip> {
  tooltip: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  side?: "top" | "bottom" | "left" | "right";
}

const PromptInputAction: React.FC<PromptInputActionProps> = ({
  tooltip,
  children,
  className,
  side = "top",
  ...props
}) => {
  const { disabled } = usePromptInput();

  return (
    <Tooltip {...props}>
      <TooltipTrigger asChild disabled={disabled}>
        {children}
      </TooltipTrigger>
      <TooltipContent side={side} className={className}>
        {tooltip}
      </TooltipContent>
    </Tooltip>
  );
};

interface PromptInputBoxProps {
  onSend?: (message: string, files?: File[]) => void;
  onFilesChange?: (files: File[]) => void;
  isLoading?: boolean;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  clearOnSend?: boolean;
  enableTypingPlaceholder?: boolean;
  typingPhrases?: string[];
  modelLabel?: string;
  modelBadgeText?: string;
  showModelBadge?: boolean;
  showAspectRatioBadge?: boolean;
  showResolutionBadge?: boolean;
  showImageUpload?: boolean;
  aspectRatio?: "1:1" | "3:4" | "4:5" | "16:9" | "9:16";
  onAspectRatioChange?: (value: "1:1" | "3:4" | "4:5" | "16:9" | "9:16") => void;
  resolution?: "1K" | "2K" | "4K";
  onResolutionChange?: (value: "1K" | "2K" | "4K") => void;
  presetButtonLabel?: string;
  onPresetButtonClick?: () => void;
  sendButtonText?: string;
  variantCount?: 1 | 2 | 3;
  onVariantCountChange?: (value: 1 | 2 | 3) => void;
  usePerspectiveSet?: boolean;
  onUsePerspectiveSetChange?: (value: boolean) => void;
  onValidationError?: (message: string) => void;
  /** Maximale Anzahl Referenzbilder (z. B. laut Bildtyp-Policy). Standard: MAX_REFERENCE_UPLOADS. */
  maxReferenceImages?: number;
}

export const PromptInputBox = React.forwardRef<HTMLDivElement, PromptInputBoxProps>((props, ref) => {
  const {
    onSend = () => {},
    onFilesChange,
    isLoading = false,
    disabled = false,
    placeholder = "Type your message here...",
    className,
    value,
    onValueChange,
    clearOnSend = true,
    enableTypingPlaceholder = false,
    typingPhrases = [
      "Erstelle mir einen Prompt für ein Weizenbier im Biergarten bei golden hour.",
      "Baue einen hochwertigen Produkt-Prompt für ein Pils in Studio-Optik.",
      "Schreibe einen Prompt für ein sommerliches Kampagnenmotiv mit Flasche und Glas.",
    ],
    modelLabel = "Nano Banana Pro",
    modelBadgeText = "G",
    showModelBadge = false,
    showAspectRatioBadge = true,
    showResolutionBadge = true,
    showImageUpload = true,
    aspectRatio,
    onAspectRatioChange,
    resolution,
    onResolutionChange,
    presetButtonLabel,
    onPresetButtonClick,
    sendButtonText,
    variantCount,
    onVariantCountChange,
    usePerspectiveSet,
    onUsePerspectiveSetChange,
    onValidationError,
    maxReferenceImages = MAX_REFERENCE_UPLOADS,
  } = props;

  const [internalInput, setInternalInput] = React.useState("");
  const input = value ?? internalInput;
  const setInput = (nextValue: string) => {
    if (onValueChange) onValueChange(nextValue);
    else setInternalInput(nextValue);
  };
  type ComposerImageSlot = { file: File; previewUrl: string };
  const [composerImages, setComposerImages] = React.useState<ComposerImageSlot[]>([]);
  const composerImagesRef = React.useRef<ComposerImageSlot[]>([]);
  React.useLayoutEffect(() => {
    composerImagesRef.current = composerImages;
  }, [composerImages]);
  const [selectedImage, setSelectedImage] = React.useState<string | null>(null);
  const [selectedAspectRatio, setSelectedAspectRatio] = React.useState<"1:1" | "3:4" | "4:5" | "16:9" | "9:16">("3:4");
  const [selectedResolution, setSelectedResolution] = React.useState<"1K" | "2K" | "4K">("1K");
  const [aspectMenuOpen, setAspectMenuOpen] = React.useState(false);
  const [resolutionMenuOpen, setResolutionMenuOpen] = React.useState(false);
  const [variantMenuOpen, setVariantMenuOpen] = React.useState(false);
  const [perspectiveMenuOpen, setPerspectiveMenuOpen] = React.useState(false);
  const [typingPhraseIndex, setTypingPhraseIndex] = React.useState(0);
  const [uploadError, setUploadError] = React.useState("");
  const [typingCharIndex, setTypingCharIndex] = React.useState(0);
  const [typingForward, setTypingForward] = React.useState(true);
  const uploadInputRef = React.useRef<HTMLInputElement>(null);
  const promptBoxRef = React.useRef<HTMLDivElement>(null);
  const aspectMenuRef = React.useRef<HTMLDivElement>(null);
  const resolutionMenuRef = React.useRef<HTMLDivElement>(null);
  const variantMenuRef = React.useRef<HTMLDivElement>(null);
  const perspectiveMenuRef = React.useRef<HTMLDivElement>(null);
  const currentAspectRatio = aspectRatio ?? selectedAspectRatio;
  const currentResolution = resolution ?? selectedResolution;

  const isImageFile = (file: File) => file.type.startsWith("image/");

  const effectiveMaxRefs = Math.max(0, Math.min(MAX_REFERENCE_UPLOADS, maxReferenceImages));

  const processIncomingFiles = React.useCallback(
    async (incoming: File[]) => {
      if (!showImageUpload || effectiveMaxRefs <= 0) return;
      const images = incoming.filter(isImageFile);
      if (incoming.length > 0 && images.length === 0) {
        const message = "Nur Bilddateien sind erlaubt.";
        setUploadError(message);
        onValidationError?.(message);
        return;
      }
      const oversized = images.filter((f) => f.size > 10 * 1024 * 1024);
      const usable = images.filter((f) => f.size <= 10 * 1024 * 1024);
      if (oversized.length > 0 && usable.length === 0) {
        const message = "Datei zu groß (maximal 10 MB pro Bild).";
        setUploadError(message);
        onValidationError?.(message);
        return;
      }
      if (usable.length === 0) return;

      // Keinen async-Start im setState-Updater: In React 18 Strict Mode wird der Updater in der
      // Entwicklung doppelt aufgerufen — sonst würde dieselbe Datei zweimal eingefügt.
      const prev = composerImagesRef.current;
      const room = effectiveMaxRefs - prev.length;
      if (room <= 0) {
        if (images.length > 0) {
          const message = `Maximal ${effectiveMaxRefs} Referenzbild(er).`;
          setUploadError(message);
          onValidationError?.(message);
        }
        return;
      }
      const batch = usable.slice(0, room);
      if (batch.length < usable.length) {
        setUploadError(`Es passen nur noch ${room} Bild(er) (max. ${effectiveMaxRefs}).`);
      } else if (oversized.length === 0) {
        setUploadError("");
      } else {
        setUploadError("Einige Dateien waren zu groß und wurden übersprungen.");
      }

      const entries: ComposerImageSlot[] = await Promise.all(
        batch.map(async (file) => ({ file, previewUrl: await readFileAsDataUrl(file) })),
      );

      setComposerImages((p) => {
        const stillRoom = effectiveMaxRefs - p.length;
        const append = entries.slice(0, Math.max(0, stillRoom));
        if (append.length === 0) return p;
        return [...p, ...append].slice(0, effectiveMaxRefs);
      });
    },
    [effectiveMaxRefs, onValidationError, showImageUpload],
  );

  React.useEffect(() => {
    setComposerImages((prev) => {
      if (prev.length <= effectiveMaxRefs) return prev;
      return prev.slice(0, effectiveMaxRefs);
    });
  }, [effectiveMaxRefs]);

  React.useEffect(() => {
    onFilesChange?.(composerImages.map((x) => x.file));
  }, [composerImages, onFilesChange]);

  const handleDragOver = React.useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDragLeave = React.useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = React.useCallback(
    (e: React.DragEvent) => {
      if (!showImageUpload) return;
      e.preventDefault();
      e.stopPropagation();
      const droppedFiles = Array.from(e.dataTransfer.files);
      const imageFiles = droppedFiles.filter((file) => isImageFile(file));
      if (imageFiles.length > 0) void processIncomingFiles(imageFiles);
    },
    [processIncomingFiles, showImageUpload],
  );

  const handleRemoveFile = (index: number) => {
    setComposerImages((prev) => prev.filter((_, i) => i !== index));
    setUploadError("");
  };

  const openImageModal = (imageUrl: string) => setSelectedImage(imageUrl);

  const handlePaste = React.useCallback(
    (e: ClipboardEvent) => {
      if (!showImageUpload) return;
      const items = e.clipboardData?.items;
      if (!items) return;
      const pasted: File[] = [];
      for (let i = 0; i < items.length; i += 1) {
        if (items[i].type.indexOf("image") !== -1) {
          const file = items[i].getAsFile();
          if (file) pasted.push(file);
        }
      }
      if (pasted.length > 0) {
        e.preventDefault();
        void processIncomingFiles(pasted);
      }
    },
    [processIncomingFiles, showImageUpload],
  );

  React.useEffect(() => {
    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, [handlePaste]);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (aspectMenuRef.current && !aspectMenuRef.current.contains(event.target as Node)) {
        setAspectMenuOpen(false);
      }
      if (!resolutionMenuRef.current) return;
      if (!resolutionMenuRef.current.contains(event.target as Node)) {
        setResolutionMenuOpen(false);
      }
      if (variantMenuRef.current && !variantMenuRef.current.contains(event.target as Node)) {
        setVariantMenuOpen(false);
      }
      if (perspectiveMenuRef.current && !perspectiveMenuRef.current.contains(event.target as Node)) {
        setPerspectiveMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  React.useEffect(() => {
    if (!enableTypingPlaceholder || typingPhrases.length === 0) return;
    if (input.trim().length > 0) return;

    const currentPhrase = typingPhrases[typingPhraseIndex % typingPhrases.length] ?? "";
    const reachedEnd = typingCharIndex >= currentPhrase.length;
    const reachedStart = typingCharIndex <= 0;
    const pauseMs = reachedEnd ? 1300 : reachedStart && !typingForward ? 500 : 0;
    const timeoutMs = pauseMs || (typingForward ? 32 : 18);

    const timer = window.setTimeout(() => {
      if (typingForward) {
        if (typingCharIndex < currentPhrase.length) {
          setTypingCharIndex((prev) => prev + 1);
        } else {
          setTypingForward(false);
        }
      } else if (typingCharIndex > 0) {
        setTypingCharIndex((prev) => prev - 1);
      } else {
        setTypingForward(true);
        setTypingPhraseIndex((prev) => (prev + 1) % typingPhrases.length);
      }
    }, timeoutMs);

    return () => window.clearTimeout(timer);
  }, [enableTypingPlaceholder, input, typingCharIndex, typingForward, typingPhraseIndex, typingPhrases]);

  const animatedPlaceholder = enableTypingPlaceholder && typingPhrases.length > 0
    ? `${typingPhrases[typingPhraseIndex % typingPhrases.length]?.slice(0, typingCharIndex) ?? ""}${input.trim().length === 0 ? "▌" : ""}`
    : placeholder;

  const handleSubmit = () => {
    if (disabled) return;
    if (input.trim() || composerImages.length > 0) {
      onSend(
        input,
        composerImages.map((x) => x.file),
      );
      if (clearOnSend) setInput("");
      setComposerImages([]);
      setUploadError("");
    }
  };

  const hasContent = input.trim() !== "" || composerImages.length > 0;
  const canAddMoreImages = showImageUpload && effectiveMaxRefs > 0 && composerImages.length < effectiveMaxRefs;

  return (
    <>
      <StyleInjector />
      <PromptInput
        value={input}
        onValueChange={setInput}
        isLoading={isLoading}
        onSubmit={handleSubmit}
        className={cn(
          "w-full border-[#444444] bg-[#1F2023] shadow-[0_8px_30px_rgba(0,0,0,0.24)] transition-all duration-300 ease-in-out",
          className,
        )}
        disabled={isLoading || disabled}
        ref={ref || promptBoxRef}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {showImageUpload && effectiveMaxRefs > 0 ? (
          <div className="flex min-h-[4.75rem] max-w-full flex-row flex-nowrap items-center overflow-x-auto px-1 pb-1.5 pt-1 transition-all duration-300 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {composerImages.map((slot, index) => (
              <div
                key={`${slot.file.name}-${slot.file.lastModified}-${index}`}
                className={cn("group relative shrink-0", index > 0 && "-ml-3.5 sm:-ml-4")}
                style={{ zIndex: index + 1 }}
              >
                <div
                  className="h-[4.5rem] w-[4.5rem] cursor-pointer overflow-hidden rounded-2xl border-2 border-[#1F2023] bg-zinc-900/95 shadow-md ring-1 ring-white/10 transition-transform duration-200 hover:z-50 hover:ring-white/25"
                  onClick={() => openImageModal(slot.previewUrl)}
                >
                  <img src={slot.previewUrl} alt="" className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveFile(index);
                    }}
                    className="absolute right-0.5 top-0.5 rounded-full bg-black/75 p-0.5 opacity-100 transition-opacity hover:bg-black/90"
                  >
                    <X className="h-3 w-3 text-white" />
                  </button>
                </div>
              </div>
            ))}
            {canAddMoreImages ? (
              <button
                type="button"
                aria-label="Referenzbild hinzufügen"
                disabled={disabled || isLoading}
                onClick={() => uploadInputRef.current?.click()}
                className={cn(
                  "relative flex h-[4.5rem] w-[4.5rem] shrink-0 flex-col items-center justify-center rounded-2xl border-2 border-[#1F2023] bg-zinc-800/95 text-zinc-400 shadow-md ring-1 ring-white/10 transition-colors hover:z-50 hover:border-white/20 hover:bg-zinc-700/95 hover:text-zinc-200 hover:ring-white/20 disabled:pointer-events-none disabled:opacity-40",
                  composerImages.length > 0 && "-ml-3 sm:-ml-3.5",
                )}
                style={{ zIndex: composerImages.length + 2 }}
              >
                <ImagePlus className="h-8 w-8" strokeWidth={1.25} />
              </button>
            ) : null}
            <input
              ref={uploadInputRef}
              type="file"
              className="hidden"
              tabIndex={-1}
              multiple={effectiveMaxRefs > 1}
              onChange={(e) => {
                const list = e.target.files ? Array.from(e.target.files) : [];
                if (list.length > 0) void processIncomingFiles(list);
                if (e.target) e.target.value = "";
              }}
              accept="image/*"
            />
          </div>
        ) : null}

        <div className="transition-all duration-300 opacity-100">
          <PromptInputTextarea
            placeholder={animatedPlaceholder}
            className="text-sm sm:text-base"
          />
        </div>
        {uploadError ? <p className="px-2 pb-1 text-xs text-red-300">{uploadError}</p> : null}

        <PromptInputActions className="flex flex-wrap items-end justify-start gap-1.5 p-0 pt-1.5">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5 transition-opacity duration-300 visible opacity-100">
            {showModelBadge ? (
              <span className="inline-flex h-8 max-w-[9.5rem] items-center gap-1.5 rounded-xl border border-white/10 bg-[#232936] px-2 text-xs font-semibold text-zinc-100 sm:h-9 sm:max-w-none sm:gap-2 sm:px-3 sm:text-sm whitespace-nowrap">
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#1b2314] text-[#c8ff26]">{modelBadgeText}</span>
                <span className="truncate">{modelLabel}</span>
              </span>
            ) : null}
            {showAspectRatioBadge ? (
              <div ref={aspectMenuRef} className="relative">
                <button
                  type="button"
                  onClick={() => setAspectMenuOpen((prev) => !prev)}
                  className="inline-flex h-8 items-center gap-1 rounded-xl border border-white/10 bg-[#232936] pl-2.5 pr-7 text-xs font-medium text-zinc-100 sm:h-9 sm:gap-1.5 sm:pl-3 sm:pr-8 sm:text-sm"
                  aria-haspopup="menu"
                  aria-expanded={aspectMenuOpen}
                >
                  <RectangleHorizontal className="h-3.5 w-3.5 text-zinc-300 sm:h-4 sm:w-4" />
                  {currentAspectRatio}
                  <ChevronDown className="pointer-events-none absolute right-2 h-3.5 w-3.5 text-zinc-300 sm:h-4 sm:w-4" />
                </button>
                {aspectMenuOpen ? (
                  <div className="absolute bottom-[calc(100%+0.6rem)] left-0 z-50 w-[240px] rounded-xl border border-white/10 bg-[#14181f] p-3 shadow-[0_20px_50px_-25px_rgba(0,0,0,0.85)]">
                    <p className="mb-2 text-sm text-zinc-400">Format auswählen</p>
                    <div className="space-y-1">
                      {(["1:1", "3:4", "4:5", "16:9", "9:16"] as const).map((ratio) => {
                        const isActive = currentAspectRatio === ratio;
                        return (
                          <button
                            key={ratio}
                            type="button"
                            onClick={() => {
                              if (!aspectRatio) setSelectedAspectRatio(ratio);
                              onAspectRatioChange?.(ratio);
                              setAspectMenuOpen(false);
                            }}
                            className={cn(
                              "flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-base font-medium transition",
                              isActive ? "bg-white/10 text-zinc-100" : "text-zinc-200 hover:bg-white/5",
                            )}
                          >
                            <span>{ratio}</span>
                            {isActive ? <Check className="h-4 w-4 text-zinc-300" /> : null}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
            {presetButtonLabel && onPresetButtonClick ? (
              <button
                type="button"
                onClick={onPresetButtonClick}
                className="inline-flex h-8 items-center gap-1 rounded-xl border border-white/10 bg-[#232936] px-2.5 text-xs font-medium text-zinc-100 sm:h-9 sm:gap-1.5 sm:px-3 sm:text-sm"
              >
                <Sparkles className="h-3.5 w-3.5 text-zinc-300 sm:h-4 sm:w-4" />
                <span className="max-w-[9rem] truncate sm:max-w-none">{presetButtonLabel}</span>
              </button>
            ) : null}
            {showResolutionBadge ? (
              <div ref={resolutionMenuRef} className="relative">
                <button
                  type="button"
                  onClick={() => setResolutionMenuOpen((prev) => !prev)}
                  className="inline-flex h-8 items-center gap-1 rounded-xl border border-white/10 bg-[#232936] pl-2.5 pr-7 text-xs font-medium text-zinc-100 sm:h-9 sm:gap-1.5 sm:pl-3 sm:pr-8 sm:text-sm"
                  aria-haspopup="menu"
                  aria-expanded={resolutionMenuOpen}
                >
                  <Gem className="h-3.5 w-3.5 text-zinc-300 sm:h-4 sm:w-4" />
                  {currentResolution}
                  <ChevronDown className="pointer-events-none absolute right-2 h-3.5 w-3.5 text-zinc-300 sm:h-4 sm:w-4" />
                </button>
                {resolutionMenuOpen ? (
                  <div className="absolute bottom-[calc(100%+0.6rem)] left-0 z-50 w-[300px] rounded-xl border border-white/10 bg-[#14181f] p-3 shadow-[0_20px_50px_-25px_rgba(0,0,0,0.85)]">
                    <p className="mb-2 text-sm text-zinc-400">Qualität auswählen</p>
                    <div className="space-y-1">
                      {(["1K", "2K", "4K"] as const).map((quality) => {
                        return (
                          <button
                            key={quality}
                            type="button"
                            onClick={() => {
                              if (!resolution) setSelectedResolution(quality);
                              onResolutionChange?.(quality);
                              setResolutionMenuOpen(false);
                            }}
                            className={cn(
                              "flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-[22px] font-medium transition",
                              currentResolution === quality ? "bg-white/10 text-zinc-100" : "text-zinc-200 hover:bg-white/5",
                            )}
                          >
                            <span className="inline-flex items-center gap-2">
                              {quality}
                              {quality === "4K" ? (
                                <span className="rounded-sm bg-[#c8ff26]/15 px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-[#c8ff26]">
                                  Premium
                                </span>
                              ) : null}
                            </span>
                            {currentResolution === quality ? <Check className="h-4 w-4 text-zinc-300" /> : null}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
            {typeof variantCount === "number" && onVariantCountChange ? (
              <div className="ml-1 flex items-center gap-1.5">
                <div ref={variantMenuRef} className="relative">
                  <button
                    type="button"
                    onClick={() => setVariantMenuOpen((prev) => !prev)}
                    className="inline-flex h-8 items-center gap-1 rounded-xl border border-white/10 bg-[#232936] pl-2.5 pr-7 text-xs font-medium text-zinc-100 sm:h-9 sm:gap-1.5 sm:pl-3 sm:pr-8 sm:text-sm"
                    aria-haspopup="menu"
                    aria-expanded={variantMenuOpen}
                  >
                    Varianten: {variantCount}
                    <ChevronDown className="pointer-events-none absolute right-2 h-3.5 w-3.5 text-zinc-300 sm:h-4 sm:w-4" />
                  </button>
                  {variantMenuOpen ? (
                    <div className="absolute bottom-[calc(100%+0.6rem)] left-0 z-50 w-[220px] rounded-xl border border-white/10 bg-[#14181f] p-3 shadow-[0_20px_50px_-25px_rgba(0,0,0,0.85)]">
                      <p className="mb-2 text-sm text-zinc-400">Varianten auswählen</p>
                      <div className="space-y-1">
                        {[1, 2, 3].map((count) => (
                          <button
                            key={count}
                            type="button"
                            onClick={() => {
                              onVariantCountChange(count as 1 | 2 | 3);
                              setVariantMenuOpen(false);
                            }}
                            className={cn(
                              "flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-base font-medium transition",
                              variantCount === count ? "bg-white/10 text-zinc-100" : "text-zinc-200 hover:bg-white/5",
                            )}
                          >
                            <span>
                              {count} Bild{count > 1 ? "er" : ""}
                            </span>
                            {variantCount === count ? <Check className="h-4 w-4 text-zinc-300" /> : null}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
                {typeof usePerspectiveSet === "boolean" && onUsePerspectiveSetChange ? (
                  <div ref={perspectiveMenuRef} className="relative">
                    <button
                      type="button"
                      onClick={() => setPerspectiveMenuOpen((prev) => !prev)}
                      className="inline-flex h-8 items-center gap-1 rounded-xl border border-white/10 bg-[#232936] pl-2.5 pr-7 text-xs font-medium text-zinc-100 sm:h-9 sm:gap-1.5 sm:pl-3 sm:pr-8 sm:text-sm"
                      aria-haspopup="menu"
                      aria-expanded={perspectiveMenuOpen}
                    >
                      Perspektiven: {usePerspectiveSet ? "An" : "Aus"}
                      <ChevronDown className="pointer-events-none absolute right-2 h-3.5 w-3.5 text-zinc-300 sm:h-4 sm:w-4" />
                    </button>
                    {perspectiveMenuOpen ? (
                      <div className="absolute bottom-[calc(100%+0.6rem)] left-0 z-50 w-[220px] rounded-xl border border-white/10 bg-[#14181f] p-3 shadow-[0_20px_50px_-25px_rgba(0,0,0,0.85)]">
                        <p className="mb-2 text-sm text-zinc-400">Perspektiven variieren</p>
                        <div className="space-y-1">
                          {[true, false].map((value) => (
                            <button
                              key={value ? "on" : "off"}
                              type="button"
                              onClick={() => {
                                onUsePerspectiveSetChange(value);
                                setPerspectiveMenuOpen(false);
                              }}
                              className={cn(
                                "flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-base font-medium transition",
                                usePerspectiveSet === value ? "bg-white/10 text-zinc-100" : "text-zinc-200 hover:bg-white/5",
                              )}
                            >
                              <span>{value ? "An" : "Aus"}</span>
                              {usePerspectiveSet === value ? <Check className="h-4 w-4 text-zinc-300" /> : null}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          <PromptInputAction
            tooltip={isLoading ? "Stop generation" : "Send message"}
            className={cn(sendButtonText ? "w-full sm:w-auto" : "")}
          >
            {sendButtonText ? (
              <div className="flex w-full justify-end sm:w-auto">
                <GenerateButtonParticles
                  text={sendButtonText}
                  loading={isLoading}
                  disabled={disabled || !hasContent}
                  onClick={() => {
                    if (hasContent) handleSubmit();
                  }}
                />
              </div>
            ) : (
              <Button
                variant="default"
                size="icon"
                className={cn(
                  "h-8 w-8 rounded-full transition-all duration-200",
                  hasContent
                    ? "bg-white text-[#1F2023] hover:bg-white/80"
                    : "bg-transparent text-[#9CA3AF] hover:bg-gray-600/30 hover:text-[#D1D5DB]",
                )}
                onClick={() => {
                  if (hasContent) handleSubmit();
                }}
                disabled={disabled || (isLoading && !hasContent)}
              >
                {isLoading ? (
                  <Square className="h-4 w-4 animate-pulse fill-[#1F2023]" />
                ) : hasContent ? (
                  <ArrowUp className="h-4 w-4 text-[#1F2023]" />
                ) : (
                  <ArrowUp className="h-5 w-5 text-[#9CA3AF] transition-colors" />
                )}
              </Button>
            )}
          </PromptInputAction>
        </PromptInputActions>
      </PromptInput>

      <ImageViewDialog imageUrl={selectedImage} onClose={() => setSelectedImage(null)} />
    </>
  );
});

PromptInputBox.displayName = "PromptInputBox";
