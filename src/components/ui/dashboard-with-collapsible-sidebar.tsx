"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Beer,
  Bell,
  Check,
  ChevronDown,
  ChevronsRight,
  Crown,
  CreditCard,
  FileText,
  Gem,
  HelpCircle,
  Home,
  Image,
  LogOut,
  Menu,
  RotateCcw,
  Settings,
  Sparkles,
  Users,
  User,
  Wand2,
  type LucideIcon,
} from "lucide-react";
import { AdminDashboard } from "@/components/admin/AdminDashboard";
import { BrandProfileSetupModal, type BrandScanSuggestion } from "@/components/dashboard/BrandProfileSetupModal";
import {
  BrewerySubscriptionPlans,
  type SubscriptionPlanKey,
} from "@/components/dashboard/BrewerySubscriptionPlans";
import { OnboardingDialog, type OnboardingStep } from "@/components/ui/onboarding-dialog";
import { PromptInputBox } from "@/components/ui/ai-prompt-box";
import { getFlowTypingPhrases } from "@/components/ui/content-type-flows";
import { DEFAULT_HOPFEN_AGENTS, FloatingChatWidget } from "@/components/ui/floating-chat-widget-shadcnui";
import { cn } from "@/lib/utils";
import { MARKETING_SITE_URL } from "@/lib/siteConfig";
import { buildCampaignCreativeFromReferencesPrompt, buildCampaignCreativePrompt } from "@/lib/kie/campaignImagePrompt";
import {
  type ContentCreationPreset,
  type ContentEngine,
  applyContentPresetPrompt,
  getPolicyForPreset,
  validateImageTypePolicy,
} from "@/lib/image-types/policy";

type OptionProps = {
  Icon: LucideIcon;
  title: DashboardTab;
  selected: DashboardTab;
  setSelected: React.Dispatch<React.SetStateAction<DashboardTab>>;
  open: boolean;
  notifs?: number;
};

type DashboardTab =
  | "Dashboard"
  | "Prompt-Erstellung"
  | "Bilder Erstellen"
  | "Mediathek"
  | "Abo & Tokens"
  | "Team"
  | "Admin Center"
  | "Einstellungen"
  | "Hilfe & Support";

type ToggleCloseProps = {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
};

type ExampleContentProps = {
  userEmail?: string;
  userName?: string;
  selectedTab: DashboardTab;
  setSelectedTab: React.Dispatch<React.SetStateAction<DashboardTab>>;
  isAdmin?: boolean;
};

type ActivityItem = {
  id: string;
  type: "media" | "team" | "billing";
  title: string;
  desc: string;
  time: string; // ISO
  color: "orange" | "blue" | "purple" | "green";
};

type MediaLibraryItem = {
  id: string;
  imageUrl: string;
  prompt: string;
  createdAt: string;
  aspectRatio: string;
  resolution: "1K" | "2K" | "4K";
  outputFormat: "png" | "jpg";
  model?: string;
  referenceImageUrl?: string;
};

type HybridAnswer = {
  question: string;
  answer: string;
};

const CONTENT_CREATION_PRESETS: Array<{
  id: ContentCreationPreset;
  title: string;
  description: string;
  mode: "standard" | "campaign";
  engine: ContentEngine;
  previewSrc: string;
}> = [
  {
    id: "hyperreal",
    title: "Hyperrealistisches Motiv",
    description: "Normales Bild mit maximal realistischer Szene, Licht und Materialtiefe.",
    mode: "standard",
    engine: "nano_banana",
    previewSrc: "/public/hyperreal-preview.png",
  },
  {
    id: "product_cutout",
    title: "Produkt freigestellt",
    description: "Packshot/Freisteller ohne Hintergrund, z. B. für Shop, Website oder Anzeigen.",
    mode: "standard",
    engine: "chatgpt_image2",
    previewSrc: "/public/product-cutout-preview.png",
  },
  {
    id: "product_studio",
    title: "Produkt-Studio",
    description: "Kontrollierte Studio-Optik mit neutralem Hintergrund und Hero-Licht.",
    mode: "standard",
    engine: "nano_banana",
    previewSrc: "/public/product-studio-preview.png",
  },
  {
    id: "campaign_social",
    title: "Kampagnenbild mit Text",
    description: "Neue Instagram-Posts: Referenzbilder hochladen, Texte erfindet die KI (nur mit Markenprofil).",
    mode: "campaign",
    engine: "chatgpt_image2",
    previewSrc: "/public/kampagnenbild-mit-text-preview.png",
  },
];

const PLAN_LABELS: Record<SubscriptionPlanKey, string> = {
  start: "Brauerei Start",
  growth: "Brauerei Wachstum",
  pro: "Brauerei Pro",
};
const PLAN_BASE_TOKENS: Record<SubscriptionPlanKey, number> = {
  start: 1200,
  growth: 3000,
  pro: 7500,
};

function resolveActivePlan(
  plan: SubscriptionPlanKey | null | undefined,
  monthlyTokens: number | null | undefined,
  status?: string | null,
): SubscriptionPlanKey | null {
  if (plan) return plan;
  // Heuristik nur als letzter Ausweg, und niemals bei explizit inaktivem/abgemeldetem Status.
  // Sonst kann ein Start-Plan + viele Zusatz-Tokens faelschlich als Pro angezeigt werden.
  if (status && (status === "none" || status === "canceled" || status === "incomplete")) {
    return null;
  }
  if (typeof monthlyTokens !== "number") return null;
  if (monthlyTokens >= PLAN_BASE_TOKENS.pro) return "pro";
  if (monthlyTokens >= PLAN_BASE_TOKENS.growth) return "growth";
  if (monthlyTokens >= PLAN_BASE_TOKENS.start) return "start";
  return null;
}

function getHomepageCheckoutPlan(params: URLSearchParams): SubscriptionPlanKey | null {
  const plan = params.get("plan");
  const checkout = params.get("checkout");
  const source = params.get("source");
  const isValidPlan = plan === "start" || plan === "growth" || plan === "pro";
  if (!isValidPlan || checkout !== "1" || source !== "homepage_pricing") return null;
  return plan;
}


const BILLING_CHECKOUT_ENABLED = process.env.NEXT_PUBLIC_BILLING_CHECKOUT_ENABLED !== "false";
const BILLING_KLEINUNTERNEHMER_MODE = process.env.NEXT_PUBLIC_BILLING_KLEINUNTERNEHMER === "true";

function getActivityIcon(type: ActivityItem["type"]): LucideIcon {
  if (type === "media") return Image;
  if (type === "team") return Users;
  return CreditCard;
}

function formatRelativeTime(isoDate: string): string {
  const diffMs = Date.now() - new Date(isoDate).getTime();
  if (!Number.isFinite(diffMs) || diffMs < 0) return "gerade eben";
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return "gerade eben";
  if (mins < 60) return `vor ${mins} Min.`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `vor ${hours} Std.`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "gestern";
  return `vor ${days} Tagen`;
}

type TeamMember = {
  id: string;
  email: string;
  name: string;
  role: "owner" | "admin" | "editor" | "viewer";
  status: "active" | "invited";
  invitedAt: string;
};

type DashboardSummary = {
  tokens: { monthly: number; used: number; remaining: number };
  postsThisMonth: number;
  activeCampaigns: number;
  teamMembers: number;
  openInvites: number;
  billingStatus: string;
  plan: SubscriptionPlanKey | null;
  degradedBilling?: boolean;
};

const USE_CASE_FLOWS = [
  {
    title: "Saisonbier-Launch",
    steps: ["Prompt-Briefing ausfüllen", "2 Hero-Motive generieren", "Instagram + Story exportieren"],
  },
  {
    title: "Event-Promotion",
    steps: ["Eventdaten im Prompt setzen", "Promo-Bildserie rendern", "Reminder-Visuals veröffentlichen"],
  },
  {
    title: "Gastro-Partner-Content",
    steps: ["Produkt + Zielgruppe wählen", "Co-Branding-Bilder erzeugen", "Pakete an Partner senden"],
  },
] as const;

const DASHBOARD_ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: "dashboard-overview",
    tab: "Dashboard",
    targetSelector: '[data-onboarding="dashboard-overview"]',
    title: "Dein Dashboard auf einen Blick",
    description: "Hier siehst du direkt Tokens, Posts, Kampagnen und Team-Status in deinem neuen Design.",
  },
  {
    id: "nav-expand",
    tab: "Dashboard",
    targetSelector: '[data-onboarding-nav-toggle="main"]',
    title: "Navigation aufklappen",
    description: "Mit dem Pfeil links neben Pakete blendest du alle Menüpunkte oben ein.",
  },
  {
    id: "content",
    tab: "Bilder Erstellen",
    targetSelector: '[data-onboarding-nav="content"]',
    title: "Bilder Erstellen",
    description: "Hier startest du neue Bildideen und erzeugst Motive für Kampagnen und Social.",
  },
  {
    id: "library",
    tab: "Mediathek",
    targetSelector: '[data-onboarding-nav="library"]',
    title: "Mediathek",
    description: "Alle generierten Bilder landen hier und sind direkt downloadbar.",
  },
  {
    id: "team",
    tab: "Team",
    targetSelector: '[data-onboarding-nav="team"]',
    title: "Team",
    description: "Lade Teammitglieder ein, weise Rollen zu und verwalte Zugriffe zentral.",
  },
  {
    id: "settings",
    tab: "Einstellungen",
    targetSelector: '[data-onboarding-nav="settings"]',
    title: "Einstellungen",
    description: "Passe Profil, Kontodaten und Benachrichtigungen an.",
  },
  {
    id: "support",
    tab: "Hilfe & Support",
    targetSelector: '[data-onboarding-nav="support"]',
    title: "Hilfe & Support",
    description: "Hier findest du Hilfe und kannst direkt den Support kontaktieren.",
  },
  {
    id: "assistant",
    targetSelector: '[data-onboarding="hopfen-hugo"]',
    title: "Hopfen Hugo Assistent",
    description:
      "Hier ist Hopfen Hugo erreichbar — nur für KI-Bilder: Prompt, Motiv, Markenlook, Varianten, Mediathek und Token fürs Generieren.",
  },
  {
    id: "billing",
    tab: "Abo & Tokens",
    targetSelector: '[data-onboarding-nav="billing"]',
    title: "Pakete & Credits",
    description: "Über Pakete verwaltest du Abo, Token-Verbrauch und Zukäufe.",
  },
];

const CONTENT_CREATION_TOUR_STEPS: OnboardingStep[] = [
  {
    id: "content-tour-workflow",
    tab: "Bilder Erstellen",
    targetSelector: '[data-onboarding="content-workflow"]',
    title: "Kreativbereich",
    description: "Hier startest du deinen Content-Flow und definierst die Bildidee.",
  },
  {
    id: "content-tour-brief",
    tab: "Bilder Erstellen",
    targetSelector: '[data-onboarding="content-brief"]',
    title: "Prompt eingeben & senden",
    description: "Beschreibe Szene, Stil und Ziel und schicke deinen Prompt direkt über den Pfeil-Button ab.",
  },
  {
    id: "content-tour-preflight",
    tab: "Bilder Erstellen",
    targetSelector: '[data-onboarding="content-preflight"]',
    title: "Einstellungen prüfen",
    description: "Wähle Varianten, Format und Perspektive vor dem finalen Render, damit die Ausgabe passt.",
  },
  {
    id: "content-tour-result",
    tab: "Bilder Erstellen",
    targetSelector: '[data-onboarding="content-result"]',
    title: "Ergebnis & Download",
    description: "Deine fertigen Bilder erscheinen hier und lassen sich direkt herunterladen.",
  },
];

type ExampleProps = {
  userEmail?: string;
  userName?: string;
  isAdmin?: boolean;
};

export const Example = ({ userEmail, userName, isAdmin = false }: ExampleProps) => {
  const [selectedTab, setSelectedTab] = useState<DashboardTab>("Dashboard");
  const isDark = true;

  useEffect(() => {
    if (typeof window === "undefined") return;
    const root = document.documentElement;
    root.classList.add("dark");
    root.style.colorScheme = "dark";
    window.localStorage.setItem("evglab-dashboard-theme", "dark");
  }, []);

  return (
    <div className={`flex min-h-screen w-full ${isDark ? "dark" : ""}`}>
      <div className="relative flex w-full flex-col overflow-hidden bg-gray-50 text-gray-100 dark:bg-gray-950">
        <div className="relative z-10">
          <ExampleContent
            userEmail={userEmail}
            userName={userName}
            selectedTab={selectedTab}
            setSelectedTab={setSelectedTab}
            isAdmin={isAdmin}
          />
        </div>
      </div>
    </div>
  );
};

const Sidebar = ({
  selected,
  setSelected,
  userEmail,
  isAdmin = false,
}: {
  selected: DashboardTab;
  setSelected: React.Dispatch<React.SetStateAction<DashboardTab>>;
  userEmail?: string;
  isAdmin?: boolean;
}) => {
  const [open, setOpen] = useState(true);
  const [activeSubscription, setActiveSubscription] = useState<SubscriptionPlanKey | null>(null);
  const [billingStatus, setBillingStatus] = useState<string>("none");

  useEffect(() => {
    let ignore = false;
    const loadBilling = async () => {
      try {
        const res = await fetch("/api/billing/state", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as {
          state?: {
            plan: SubscriptionPlanKey | null;
            monthlyTokens?: number;
            status?: string;
          };
        };
        if (!ignore && data.state) {
          setActiveSubscription(resolveActivePlan(data.state.plan, data.state.monthlyTokens, data.state.status));
          setBillingStatus(data.state.status ?? "none");
        }
      } catch {
        // ignore network errors
      }
    };
    void loadBilling();
    const onBillingUpdated = () => {
      void loadBilling();
    };
    window.addEventListener("evglab-billing-updated", onBillingUpdated as EventListener);
    return () => {
      ignore = true;
      window.removeEventListener("evglab-billing-updated", onBillingUpdated as EventListener);
    };
  }, []);

  const hasActiveBilling = Boolean(activeSubscription) && billingStatus !== "none" && billingStatus !== "canceled";
  const currentPlanLabel = hasActiveBilling && activeSubscription ? PLAN_LABELS[activeSubscription] : "Kein aktives Abo";

  return (
    <nav
      className={`sticky top-0 h-screen shrink-0 border-r transition-all duration-300 ease-in-out ${
        open ? "w-64" : "w-16"
      } hidden border-gray-200 bg-white p-2 shadow-sm dark:border-gray-800 dark:bg-gray-900 lg:block`}
    >
      <TitleSection open={open} userEmail={userEmail} planLabel={currentPlanLabel} />

      <div className="mb-8 space-y-1">
        <Option Icon={Home} title="Dashboard" selected={selected} setSelected={setSelected} open={open} />
        <Option Icon={Wand2} title="Bilder Erstellen" selected={selected} setSelected={setSelected} open={open} />
        <Option Icon={Image} title="Mediathek" selected={selected} setSelected={setSelected} open={open} />
        <Option Icon={Users} title="Team" selected={selected} setSelected={setSelected} open={open} />
        {isAdmin ? <Option Icon={Settings} title="Admin Center" selected={selected} setSelected={setSelected} open={open} /> : null}
      </div>

      {open && (
        <div className="space-y-1 border-t border-gray-200 pt-4 dark:border-gray-800">
          <div className="px-3 py-2 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Konto</div>
          <Option Icon={Settings} title="Einstellungen" selected={selected} setSelected={setSelected} open={open} />
          <Option Icon={HelpCircle} title="Hilfe & Support" selected={selected} setSelected={setSelected} open={open} />
        </div>
      )}

      <ToggleClose open={open} setOpen={setOpen} />
    </nav>
  );
};

const MobileTabBar = ({
  selected,
  setSelected,
  isAdmin = false,
  onRestartOnboarding,
}: {
  selected: DashboardTab;
  setSelected: React.Dispatch<React.SetStateAction<DashboardTab>>;
  isAdmin?: boolean;
  onRestartOnboarding?: () => void;
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const tabs: Array<{ title: DashboardTab; Icon: LucideIcon }> = [
    { title: "Dashboard", Icon: Home },
    { title: "Bilder Erstellen", Icon: Wand2 },
    { title: "Mediathek", Icon: Image },
    { title: "Team", Icon: Users },
    { title: "Einstellungen", Icon: Settings },
    { title: "Hilfe & Support", Icon: HelpCircle },
  ];
  if (isAdmin) {
    tabs.splice(5, 0, { title: "Admin Center", Icon: Settings });
  }

  return (
    <div className="-mx-4 mb-4 bg-transparent px-4 py-3 sm:-mx-6 sm:px-6 lg:hidden">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => {
            if (typeof window === "undefined") return;
            window.location.assign(MARKETING_SITE_URL);
          }}
          className="inline-flex h-10 items-center gap-2 rounded-md border border-gray-200 bg-white px-3 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
          aria-label="Zur Startseite"
        >
          <Home className="h-4 w-4" />
          Startseite
        </button>
        <button
          type="button"
          onClick={() => setMenuOpen((prev) => !prev)}
          aria-label={menuOpen ? "Menü schließen" : "Menü öffnen"}
          className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-transparent text-gray-800 transition-colors hover:bg-black/5 dark:text-gray-100 dark:hover:bg-white/10"
        >
          <Menu className="h-5 w-5" />
        </button>
      </div>

      {menuOpen && (
        <div className="mt-2 rounded-lg border border-gray-200 bg-white p-1 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          {tabs.map(({ title, Icon }) => {
            const isSelected = selected === title;
            return (
              <button
                key={title}
                onClick={() => {
                  setSelected(title);
                  setMenuOpen(false);
                }}
                className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm transition ${
                  isSelected
                    ? "bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
                    : "text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800"
                }`}
              >
                <span className="inline-flex items-center gap-2">
                  <Icon className="h-4 w-4" />
                  {title}
                </span>
                {isSelected ? <Check className="h-4 w-4" /> : null}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => {
              onRestartOnboarding?.();
              setMenuOpen(false);
            }}
            className="mt-1 flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm text-gray-700 transition hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            <span className="inline-flex items-center gap-2">
              <RotateCcw className="h-4 w-4" />
              Onboarding neu starten
            </span>
          </button>
        </div>
      )}
    </div>
  );
};

const Option = ({ Icon, title, selected, setSelected, open, notifs }: OptionProps) => {
  const isSelected = selected === title;
  const onboardingKey: Record<DashboardTab, string> = {
    Dashboard: "dashboard",
    "Prompt-Erstellung": "prompt",
    "Bilder Erstellen": "content",
    Mediathek: "library",
    "Abo & Tokens": "billing",
    Team: "team",
    "Admin Center": "settings",
    Einstellungen: "settings",
    "Hilfe & Support": "support",
  };

  return (
    <button
      onClick={() => setSelected(title)}
      data-onboarding-nav={onboardingKey[title]}
      className={`relative flex h-11 w-full items-center rounded-md transition-all duration-200 ${
        isSelected
          ? "border-l-2 border-blue-500 bg-blue-50 text-blue-700 shadow-sm dark:bg-blue-900/50 dark:text-blue-300"
          : "text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
      }`}
    >
      <div className="grid h-full w-12 place-content-center">
        <Icon className="h-4 w-4" />
      </div>

      {open && (
        <span className={`text-sm font-medium transition-opacity duration-200 ${open ? "opacity-100" : "opacity-0"}`}>{title}</span>
      )}

      {notifs && open && (
        <span className="absolute right-3 flex h-5 w-5 items-center justify-center rounded-full bg-blue-500 text-xs font-medium text-white dark:bg-blue-600">
          {notifs}
        </span>
      )}
    </button>
  );
};

const TitleSection = ({ open, userEmail, planLabel }: { open: boolean; userEmail?: string; planLabel: string }) => {
  const [menuOpen, setMenuOpen] = useState(false);

  const handleBackToHomepage = () => {
    if (typeof window === "undefined") return;
    window.location.assign(MARKETING_SITE_URL);
  };

  const handleRestartOnboarding = () => {
    if (typeof window === "undefined") return;
    const onboardingStorageKey = `evglab-dashboard-onboarding-v1:${userEmail ?? "default"}`;
    try {
      window.localStorage.removeItem(onboardingStorageKey);
    } catch {
      // ignore localStorage errors
    }
    window.dispatchEvent(new CustomEvent("evglab-restart-onboarding"));
    setMenuOpen(false);
  };

  return (
    <div className="mb-6 border-b border-gray-200 pb-4 dark:border-gray-800">
      <button
        type="button"
        onClick={() => setMenuOpen((prev) => !prev)}
        className="flex w-full cursor-pointer items-center justify-between rounded-md p-2 text-left transition-colors hover:bg-gray-50 dark:hover:bg-gray-800"
      >
        <div className="flex items-center gap-3">
          <Logo />
          {open && (
            <div className={`transition-opacity duration-200 ${open ? "opacity-100" : "opacity-0"}`}>
              <div className="flex items-center gap-2">
                <div>
                  <span className="block text-sm font-semibold text-gray-900 dark:text-gray-100">Brauerei Dashboard</span>
                  <span className="block text-xs text-gray-500 dark:text-gray-400">{planLabel}</span>
                </div>
              </div>
            </div>
          )}
        </div>
        {open && <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform dark:text-gray-500 ${menuOpen ? "rotate-180" : ""}`} />}
      </button>

      {open ? (
        <div
          className={`mt-2 origin-top overflow-hidden rounded-md border border-gray-200 bg-white p-1 shadow-sm transition-all duration-150 ease-[cubic-bezier(0.2,0.8,0.2,1)] dark:border-gray-700 dark:bg-gray-900 ${
            menuOpen
              ? "max-h-28 translate-y-0 scale-100 opacity-100"
              : "pointer-events-none max-h-0 -translate-y-1 scale-[0.98] opacity-0"
          }`}
          aria-hidden={!menuOpen}
        >
          <button
            type="button"
            onClick={handleBackToHomepage}
            className="flex w-full items-center rounded-md px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            Zur Startseite
          </button>
          <button
            type="button"
            onClick={handleRestartOnboarding}
            className="flex w-full items-center rounded-md px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            Onboarding neu starten
          </button>
        </div>
      ) : null}
    </div>
  );
};

const Logo = () => {
  return (
    <div className="grid size-10 shrink-0 place-content-center rounded-lg bg-gradient-to-br from-[#d46830] to-[#b84d15] shadow-sm">
      <svg width="20" height="auto" viewBox="0 0 50 39" fill="none" xmlns="http://www.w3.org/2000/svg" className="fill-white">
        <path d="M16.4992 2H37.5808L22.0816 24.9729H1L16.4992 2Z" />
        <path d="M17.4224 27.102L11.4192 36H33.5008L49 13.0271H32.7024L23.2064 27.102H17.4224Z" />
      </svg>
    </div>
  );
};

const ToggleClose = ({ open, setOpen }: ToggleCloseProps) => {
  return (
    <button
      onClick={() => setOpen(!open)}
      className="absolute bottom-0 left-0 right-0 border-t border-gray-200 transition-colors hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-800"
    >
      <div className="flex items-center p-3">
        <div className="grid size-10 place-content-center">
          <ChevronsRight className={`h-4 w-4 text-gray-500 transition-transform duration-300 dark:text-gray-400 ${open ? "rotate-180" : ""}`} />
        </div>
        {open && <span className={`text-sm font-medium text-gray-600 transition-opacity duration-200 dark:text-gray-300 ${open ? "opacity-100" : "opacity-0"}`}>Ausblenden</span>}
      </div>
    </button>
  );
};

const ExampleContent = ({ userEmail, userName, selectedTab, setSelectedTab, isAdmin = false }: ExampleContentProps) => {
  const [mediaItems, setMediaItems] = useState<MediaLibraryItem[]>([]);
  const [expandedPromptId, setExpandedPromptId] = useState<string | null>(null);
  const [downloadingMediaId, setDownloadingMediaId] = useState<string | null>(null);
  const [downloadErrorMessage, setDownloadErrorMessage] = useState("");
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showContentTour, setShowContentTour] = useState(false);
  const [showCreditsOffer, setShowCreditsOffer] = useState(false);
  const [activeSubscription, setActiveSubscription] = useState<SubscriptionPlanKey | null>(null);
  const [monthlyTokens, setMonthlyTokens] = useState(0);
  const [usedTokens, setUsedTokens] = useState(0);
  const [billingStatus, setBillingStatus] = useState<string>("none");
  const [onboardingBonusClaimed, setOnboardingBonusClaimed] = useState<boolean | null>(null);
  const [freeTrialImageUsed, setFreeTrialImageUsed] = useState(false);
  const [isCheckoutLoading, setIsCheckoutLoading] = useState(false);
  const [loadingPlan, setLoadingPlan] = useState<SubscriptionPlanKey | null>(null);
  const [checkoutMessage, setCheckoutMessage] = useState("Weiterleitung zu Stripe...");
  const [profileName, setProfileName] = useState(userName ?? "");
  const [breweryName, setBreweryName] = useState(userName ?? "");
  const [profilePhone, setProfilePhone] = useState("");
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [weeklySummary, setWeeklySummary] = useState(true);
  const [brandProfileMode, setBrandProfileMode] = useState<"undecided" | "guided" | "skip">("undecided");
  const [brandInstagramUrl, setBrandInstagramUrl] = useState("");
  const [brandLockLevel, setBrandLockLevel] = useState<"strict" | "balanced" | "loose">("strict");
  const [brandTone, setBrandTone] = useState("");
  const [brandColors, setBrandColors] = useState("");
  const [brandDos, setBrandDos] = useState("");
  const [brandDonts, setBrandDonts] = useState("");
  const [brandReferenceImageUrls, setBrandReferenceImageUrls] = useState("");
  const [showBrandProfileChoice, setShowBrandProfileChoice] = useState(false);
  const [brandProfileSetupOpen, setBrandProfileSetupOpen] = useState(false);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSaveMessage, setProfileSaveMessage] = useState("");
  const [deleteAccountConfirmation, setDeleteAccountConfirmation] = useState("");
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [dashboardSummary, setDashboardSummary] = useState<DashboardSummary | null>(null);
  const [activityItems, setActivityItems] = useState<ActivityItem[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [teamInviteEmail, setTeamInviteEmail] = useState("");
  const [teamInviteName, setTeamInviteName] = useState("");
  const [teamInviteRole, setTeamInviteRole] = useState<"admin" | "editor" | "viewer">("editor");
  const [teamMessage, setTeamMessage] = useState("");
  const [teamSaving, setTeamSaving] = useState(false);
  const [supportSubject, setSupportSubject] = useState("");
  const [supportMessage, setSupportMessage] = useState("");
  const [supportInfoMessage, setSupportInfoMessage] = useState("");
  const [mediaSearch, setMediaSearch] = useState("");
  const [mediaShowFavoritesOnly, setMediaShowFavoritesOnly] = useState(false);
  const [mediaFavoriteIds, setMediaFavoriteIds] = useState<string[]>([]);
  const [selectedMediaItem, setSelectedMediaItem] = useState<MediaLibraryItem | null>(null);
  const [mediaCommentsById, setMediaCommentsById] = useState<Record<string, string[]>>({});
  const [mediaCommentInput, setMediaCommentInput] = useState("");
  const [mediaImageDimensions, setMediaImageDimensions] = useState<Record<string, string>>({});
  const [globalErrorMessage, setGlobalErrorMessage] = useState("");
  const [globalNoticeMessage, setGlobalNoticeMessage] = useState("");
  const [topNavMenuOpen, setTopNavMenuOpen] = useState(false);
  const [bellMenuOpen, setBellMenuOpen] = useState(false);
  const [bellReadIds, setBellReadIds] = useState<string[]>([]);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [hybridInitialInput, setHybridInitialInput] = useState("");
  const [hybridAnswers, setHybridAnswers] = useState<HybridAnswer[]>([]);
  const [hybridCurrentQuestion, setHybridCurrentQuestion] = useState<string | null>(null);
  const [hybridIsLoading, setHybridIsLoading] = useState(false);
  const [hybridError, setHybridError] = useState("");
  const [contentPendingFiles, setContentPendingFiles] = useState<File[] | undefined>(undefined);
  const [contentComposerFiles, setContentComposerFiles] = useState<File[]>([]);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [assistantAgentId] = useState(DEFAULT_HOPFEN_AGENTS[0]?.id ?? "hopfen-hugo");
  const [assistantInput, setAssistantInput] = useState("");
  const [assistantLoading, setAssistantLoading] = useState(false);
  const [assistantMessages, setAssistantMessages] = useState<Array<{ role: "user" | "assistant"; text: string }>>([
    {
      role: "assistant",
      text: "Prost! Ich bin Hopfen Hugo — ich helfe nur bei KI-Bildern in EvGlab: Prompts, Stil, Markenlook, Formate, Mediathek und Token. Frag mich zu eurem nächsten Motiv.",
    },
  ]);
  const [contentDraftPrompt, setContentDraftPrompt] = useState("");
  const [contentIsGenerating, setContentIsGenerating] = useState(false);
  const [contentGenerationProgress, setContentGenerationProgress] = useState(0);
  const [contentGeneratedPreviewUrls, setContentGeneratedPreviewUrls] = useState<string[]>([]);
  const [contentGenerationError, setContentGenerationError] = useState("");
  const [lastGenerationTokenSpend, setLastGenerationTokenSpend] = useState<{
    total: number;
    imageCount: number;
    source: "kie" | "openai";
    freeTrial?: boolean;
  } | null>(null);
  const [contentVariantCount, setContentVariantCount] = useState<1 | 2 | 3>(1);
  const [contentUsePerspectiveSet, setContentUsePerspectiveSet] = useState(true);
  const [contentAspectRatio, setContentAspectRatio] = useState<"1:1" | "3:4" | "4:5" | "16:9" | "9:16">("3:4");
  const [contentResolution, setContentResolution] = useState<"1K" | "2K" | "4K">("1K");
  const [contentCreationPreset, setContentCreationPreset] = useState<ContentCreationPreset>("hyperreal");
  const [contentPresetPickerOpen, setContentPresetPickerOpen] = useState(false);
  const [contentImageMode, setContentImageMode] = useState<"standard" | "campaign">("standard");
  const [contentValidationError, setContentValidationError] = useState("");
  const [hybridCurrentOptions, setHybridCurrentOptions] = useState<string[]>([]);
  const hasHomepageCheckoutIntentRef = useRef(false);
  const bellMenuRef = useRef<HTMLDivElement | null>(null);
  const profileMenuRef = useRef<HTMLDivElement | null>(null);
  const profileButtonRef = useRef<HTMLButtonElement | null>(null);
  const sessionExpiredHandledRef = useRef(false);
  const displayName = breweryName || profileName || "deine Brauerei";
  const brandProfileComplete =
    brandProfileMode === "skip" ||
    (Boolean(breweryName.trim()) &&
      Boolean(brandTone.trim()) &&
      Boolean(brandColors.trim()) &&
      Boolean(brandDos.trim()) &&
      Boolean(brandDonts.trim()));
  const campaignBrandOk = brandProfileMode === "guided" && brandProfileComplete;
  const tabTitle = selectedTab;
  const isCreationTab = selectedTab === "Bilder Erstellen";
  const selectedContentPreset =
    CONTENT_CREATION_PRESETS.find((preset) => preset.id === contentCreationPreset) ?? CONTENT_CREATION_PRESETS[0];
  const topTabs: Array<{ title: DashboardTab; Icon: LucideIcon; notifs?: number }> = [
    { title: "Dashboard", Icon: Home },
    { title: "Bilder Erstellen", Icon: Wand2 },
    { title: "Mediathek", Icon: Image },
    { title: "Team", Icon: Users },
    { title: "Einstellungen", Icon: Settings },
    { title: "Hilfe & Support", Icon: HelpCircle },
  ];
  if (isAdmin) {
    topTabs.splice(6, 0, { title: "Admin Center", Icon: Settings });
  }

  const tabIconClassByTitle: Record<DashboardTab, string> = {
    Dashboard: "text-sky-300",
    "Prompt-Erstellung": "text-zinc-400",
    "Bilder Erstellen": "text-emerald-300",
    Mediathek: "text-[#7cff66]",
    Team: "text-cyan-300",
    "Admin Center": "text-amber-300",
    Einstellungen: "text-zinc-300",
    "Hilfe & Support": "text-orange-300",
    "Abo & Tokens": "text-fuchsia-300",
  };

  const submitContentFlowInput = async (message: string, files?: File[]) => {
    const trimmed = message.trim();
    const filesEarly = files ?? contentComposerFiles;
    const hasRefFiles = filesEarly.length > 0;
    const effectiveInput =
      trimmed ||
      (contentCreationPreset === "product_cutout"
        ? "Produkt freistellen."
        : contentCreationPreset === "campaign_social" && hasRefFiles
          ? "Instagram-Post aus Referenzbildern generieren."
          : "");
    if (!effectiveInput || contentIsGenerating) return;
    if (hybridCurrentQuestion && hybridCurrentOptions.length > 0 && !hybridCurrentOptions.includes(trimmed)) {
      setHybridError("Bitte waehle eine der vorgeschlagenen Optionen aus.");
      return;
    }
    const selectedPreset = CONTENT_CREATION_PRESETS.find((preset) => preset.id === contentCreationPreset);
    const selectedEngine: ContentEngine =
      contentCreationPreset === "product_cutout" ? "chatgpt_image2" : (selectedPreset?.engine ?? "nano_banana");
    const filesToValidate = files ?? contentComposerFiles;
    const preValidation = validateImageTypePolicy({
      preset: contentCreationPreset,
      engine: selectedEngine,
      referenceImageCount: filesToValidate?.length ?? 0,
      campaignMode: contentImageMode === "campaign",
    });
    if (preValidation) {
      setContentValidationError(preValidation.message);
      setHybridError(preValidation.message);
      return;
    }
    if (contentCreationPreset === "campaign_social" && !campaignBrandOk) {
      setContentValidationError("Kampagnenbild mit Text: bitte zuerst ein Markenprofil unter Einstellungen anlegen.");
      setHybridError("Kampagnenbild mit Text: bitte zuerst ein Markenprofil unter Einstellungen anlegen.");
      return;
    }
    setContentValidationError("");

    if (hybridIsLoading) return;
    setHybridError("");
    setHybridIsLoading(true);

    try {
      trackImageFlowMetric("flow_started");
      if (contentCreationPreset === "product_cutout" && !hybridCurrentQuestion) {
        const filesToUse = files ?? contentComposerFiles;
        const directPrompt = applyContentPresetPrompt(
          "Create a production-ready transparent PNG product cutout.",
          contentCreationPreset,
        );
        await generateContentWithKie(directPrompt, filesToUse);
        setContentPendingFiles(undefined);
        setHybridAnswers([]);
        setHybridInitialInput("");
        trackImageFlowMetric("flow_completed", { directFlow: true });
        return;
      }
      if (contentCreationPreset === "campaign_social" && !hybridCurrentQuestion && campaignBrandOk) {
        const filesToUse = files ?? contentComposerFiles;
        if ((filesToUse?.length ?? 0) < 1) {
          setHybridError("Bitte mindestens ein Referenzbild hochladen (z. B. Screenshot bestehender Instagram-Posts).");
          setContentValidationError("Bitte mindestens ein Referenzbild hochladen.");
          setHybridIsLoading(false);
          return;
        }
        const scene =
          trimmed ||
          "Neue Instagram-Feed-Grafik im Markenstil: vom Referenzbild inspiriert, aber neu komponiert.";
        setHybridCurrentQuestion(null);
        setHybridCurrentOptions([]);
        setHybridAnswers([]);
        setHybridInitialInput("");
        setContentPendingFiles(undefined);
        await generateCampaignWithOpenAiImage2(scene, "", "", "", filesToUse, { imageLedFromReferences: true });
        trackImageFlowMetric("flow_completed", { directFlow: true });
        return;
      }
      let nextAnswers = hybridAnswers;
      let effectiveInitialInput = hybridInitialInput;
      if (!hybridCurrentQuestion) {
        nextAnswers = [];
        effectiveInitialInput = effectiveInput;
        setHybridInitialInput(effectiveInput);
        setHybridAnswers([]);
        setContentPendingFiles(files);
      } else {
        nextAnswers = [...hybridAnswers, { question: hybridCurrentQuestion, answer: trimmed }];
        setHybridAnswers(nextAnswers);
      }

      const res = await fetch("/api/claude/hybrid-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          initialInput: effectiveInitialInput,
          history: nextAnswers,
          questionCount: nextAnswers.length,
          preset: contentCreationPreset,
        }),
      });
      const data = (await res.json()) as {
        status?: "follow_up" | "complete";
        question?: string;
        options?: string[];
        prompt?: string;
        error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? "Analyse fehlgeschlagen.");

      if (data.status === "follow_up" && data.question) {
        setHybridCurrentQuestion(data.question);
        setHybridCurrentOptions(Array.isArray(data.options) ? data.options.filter(Boolean).slice(0, 6) : []);
        return;
      }

      const finalPrompt = (data.prompt ?? "").trim();
      if (!finalPrompt) throw new Error("Prompt konnte nicht aufgebaut werden.");
      const presetPrompt = applyContentPresetPrompt(finalPrompt, contentCreationPreset);
      setHybridCurrentQuestion(null);
      setHybridCurrentOptions([]);
      const filesToUse = hybridCurrentQuestion ? contentPendingFiles : files;
      if (contentImageMode === "campaign") {
        const imageLedOpts = { imageLedFromReferences: true };
        if (selectedEngine === "chatgpt_image2") {
          await generateCampaignWithOpenAiImage2(presetPrompt, "", "", "", filesToUse, imageLedOpts);
        } else {
          await generateCampaignWithKie(presetPrompt, "", "", "", filesToUse, imageLedOpts);
        }
      } else if (selectedEngine === "chatgpt_image2") {
        await generateContentWithOpenAiImage2(presetPrompt, filesToUse);
      } else {
        await generateContentWithKie(presetPrompt, filesToUse);
      }
      setContentPendingFiles(undefined);
      setHybridAnswers([]);
      setHybridInitialInput("");
      trackImageFlowMetric("flow_completed");
    } catch (error) {
      trackImageFlowMetric("flow_failed", { error: error instanceof Error ? error.message : "unknown" });
      setHybridError(error instanceof Error ? error.message : "Analyse fehlgeschlagen.");
    } finally {
      setHybridIsLoading(false);
    }
  };

  useEffect(() => {
    setHybridCurrentQuestion(null);
    setHybridAnswers([]);
    setHybridInitialInput("");
    setHybridError("");
    setHybridCurrentOptions([]);
    setContentPendingFiles(undefined);
    setContentValidationError("");
  }, [contentImageMode, contentCreationPreset]);

  useEffect(() => {
    if (contentCreationPreset === "campaign_social" && !campaignBrandOk) {
      setContentCreationPreset("hyperreal");
    }
  }, [campaignBrandOk, contentCreationPreset]);

  useEffect(() => {
    const selectedPreset = CONTENT_CREATION_PRESETS.find((preset) => preset.id === contentCreationPreset);
    if (!selectedPreset) return;
    setContentImageMode(selectedPreset.mode);
    if (selectedPreset.id === "product_cutout") {
      setContentAspectRatio("1:1");
      setContentVariantCount(1);
      setContentUsePerspectiveSet(false);
    }
  }, [contentCreationPreset]);

  const submitAssistantMessage = useCallback(async () => {
    const trimmed = assistantInput.trim();
    if (!trimmed || assistantLoading) return;
    setAssistantLoading(true);
    setAssistantInput("");
    setAssistantMessages((prev) => [...prev, { role: "user", text: trimmed }]);
    try {
      const res = await fetch("/api/claude/brauerei-assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: trimmed,
          currentTab: selectedTab,
          assistantPersona: assistantAgentId,
        }),
      });
      const data = (await res.json()) as { answer?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Assistent nicht erreichbar.");
      setAssistantMessages((prev) => [...prev, { role: "assistant", text: data.answer ?? "Dazu habe ich gerade keine klare Antwort." }]);
    } catch (error) {
      setAssistantMessages((prev) => [
        ...prev,
        { role: "assistant", text: error instanceof Error ? error.message : "Assistent konnte nicht antworten." },
      ]);
    } finally {
      setAssistantLoading(false);
    }
  }, [assistantAgentId, assistantInput, assistantLoading, selectedTab]);

  const onboardingStorageKey =
    typeof window !== "undefined"
      ? `evglab-dashboard-onboarding-v1:${userEmail ?? "default"}`
      : "evglab-dashboard-onboarding-v1:default";

  useEffect(() => {
    if (typeof window === "undefined") return;
    const intentPlan = getHomepageCheckoutPlan(new URLSearchParams(window.location.search));
    if (intentPlan) {
      hasHomepageCheckoutIntentRef.current = true;
      return;
    }
    try {
      const hasSeenOnboarding = window.localStorage.getItem(onboardingStorageKey);
      if (!hasSeenOnboarding) {
        setShowOnboarding(true);
      }
    } catch {
      setShowOnboarding(true);
    }
  }, [onboardingStorageKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onRestart = () => setShowOnboarding(true);
    window.addEventListener("evglab-restart-onboarding", onRestart as EventListener);
    return () => {
      window.removeEventListener("evglab-restart-onboarding", onRestart as EventListener);
    };
  }, []);

  useEffect(() => {
    let ignore = false;
    const loadDashboardData = async () => {
      try {
        const [mediaRes, settingsRes, summaryRes, teamRes] = await Promise.all([
          fetch("/api/dashboard/media", { cache: "no-store" }),
          fetch("/api/dashboard/settings", { cache: "no-store" }),
          fetch("/api/dashboard/summary", { cache: "no-store" }),
          fetch("/api/dashboard/team", { cache: "no-store" }),
        ]);

        if (!ignore && mediaRes.ok) {
          const mediaData = (await mediaRes.json()) as { items?: MediaLibraryItem[] };
          if (Array.isArray(mediaData.items)) {
            setMediaItems(mediaData.items);
          }
        }
        if (!ignore && settingsRes.ok) {
          const settingsData = (await settingsRes.json()) as {
            settings?: {
              profileName?: string;
              breweryName?: string;
              profilePhone?: string;
              emailNotifications?: boolean;
              weeklySummary?: boolean;
              brandProfileMode?: "undecided" | "guided" | "skip";
              brandInstagramUrl?: string;
              brandLockLevel?: "strict" | "balanced" | "loose";
              brandTone?: string;
              brandColors?: string;
              brandDos?: string;
              brandDonts?: string;
              brandReferenceImageUrls?: string[];
            };
          };
          const settings = settingsData.settings;
          if (settings) {
            if (typeof settings.profileName === "string") setProfileName(settings.profileName);
            if (typeof settings.breweryName === "string") setBreweryName(settings.breweryName);
            if (typeof settings.profilePhone === "string") setProfilePhone(settings.profilePhone);
            if (typeof settings.emailNotifications === "boolean") setEmailNotifications(settings.emailNotifications);
            if (typeof settings.weeklySummary === "boolean") setWeeklySummary(settings.weeklySummary);
            if (settings.brandProfileMode === "guided" || settings.brandProfileMode === "skip" || settings.brandProfileMode === "undecided") {
              setBrandProfileMode(settings.brandProfileMode);
            }
            if (typeof settings.brandInstagramUrl === "string") setBrandInstagramUrl(settings.brandInstagramUrl);
            if (settings.brandLockLevel === "strict" || settings.brandLockLevel === "balanced" || settings.brandLockLevel === "loose") {
              setBrandLockLevel(settings.brandLockLevel);
            }
            if (typeof settings.brandTone === "string") setBrandTone(settings.brandTone);
            if (typeof settings.brandColors === "string") setBrandColors(settings.brandColors);
            if (typeof settings.brandDos === "string") setBrandDos(settings.brandDos);
            if (typeof settings.brandDonts === "string") setBrandDonts(settings.brandDonts);
            if (Array.isArray(settings.brandReferenceImageUrls)) {
              setBrandReferenceImageUrls(settings.brandReferenceImageUrls.join("\n"));
            }
          }
        }
        if (!ignore) setSettingsLoaded(true);
        if (!ignore && summaryRes.ok) {
          const summaryData = (await summaryRes.json()) as {
            summary?: DashboardSummary;
            activities?: ActivityItem[];
          };
          if (summaryData.summary) setDashboardSummary(summaryData.summary);
          if (Array.isArray(summaryData.activities)) setActivityItems(summaryData.activities);
        }
        if (!ignore && teamRes.ok) {
          const teamData = (await teamRes.json()) as { members?: TeamMember[] };
          if (Array.isArray(teamData.members)) setTeamMembers(teamData.members);
        }
      } catch {
        if (!ignore) {
          setGlobalErrorMessage("Einige Dashboard-Daten konnten nicht geladen werden.");
          setSettingsLoaded(true);
        }
      }
    };
    void loadDashboardData();
    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    if (!settingsLoaded) return;
    if (brandProfileMode !== "guided" || brandProfileComplete) return;
    setSelectedTab("Einstellungen");
  }, [brandProfileComplete, brandProfileMode, settingsLoaded, setSelectedTab]);

  useEffect(() => {
    if (!settingsLoaded) return;
    if (showOnboarding) return;
    if (brandProfileMode !== "undecided") return;
    setShowBrandProfileChoice(true);
  }, [brandProfileMode, settingsLoaded, showOnboarding]);

  useEffect(() => {
    if (selectedTab !== "Prompt-Erstellung") return;
    setSelectedTab("Bilder Erstellen");
  }, [selectedTab, setSelectedTab]);

  useEffect(() => {
    if (!profileMenuOpen && !bellMenuOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (profileButtonRef.current && target && profileButtonRef.current.contains(target)) {
        return;
      }
      if (bellMenuRef.current && target && !bellMenuRef.current.contains(target)) {
        setBellMenuOpen(false);
      }
      if (profileMenuRef.current && target && !profileMenuRef.current.contains(target)) {
        setProfileMenuOpen(false);
      }
    };
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setTopNavMenuOpen(false);
        setBellMenuOpen(false);
        setProfileMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    window.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("keydown", onEscape);
    };
  }, [profileMenuOpen, bellMenuOpen]);

  useEffect(() => {
    let cancelled = false;

    const verifySessionHealth = async () => {
      try {
        const res = await fetch("/api/auth/status", {
          method: "GET",
          cache: "no-store",
          credentials: "include",
        });
        if (!res.ok) return;
        const data = (await res.json()) as { authenticated?: boolean };
        if (cancelled) return;
        if (data.authenticated) {
          sessionExpiredHandledRef.current = false;
          setGlobalErrorMessage((prev) => (prev.includes("Session") ? "" : prev));
          return;
        }
        if (!sessionExpiredHandledRef.current) {
          sessionExpiredHandledRef.current = true;
          setGlobalErrorMessage("Session abgelaufen. Bitte neu anmelden.");
          if (typeof window !== "undefined") {
            window.dispatchEvent(new CustomEvent("evglab-open-auth-modal", { detail: { mode: "signin" } }));
          }
        }
      } catch {
        // ignore short-lived network errors
      }
    };

    const intervalId = globalThis.setInterval(() => {
      void verifySessionHealth();
    }, 60_000);

    const onFocus = () => {
      void verifySessionHealth();
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        void verifySessionHealth();
      }
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    void verifySessionHealth();

    return () => {
      cancelled = true;
      globalThis.clearInterval(intervalId);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  useEffect(() => {
    let ignore = false;
    const refreshBillingState = async () => {
      try {
        const res = await fetch("/api/billing/state");
        if (!res.ok) return null;
        const data = (await res.json()) as {
          state?: {
            plan: SubscriptionPlanKey | null;
            monthlyTokens: number;
            usedTokens: number;
            remainingTokens?: number;
            status?: string;
            freeTrialImageUsed?: boolean;
            onboardingBonusClaimed?: boolean;
          };
        };
        if (!ignore && data.state) {
          setActiveSubscription(resolveActivePlan(data.state.plan, data.state.monthlyTokens, data.state.status));
          setMonthlyTokens(data.state.monthlyTokens);
          setUsedTokens(data.state.usedTokens);
          setBillingStatus(data.state.status ?? "none");
          setFreeTrialImageUsed(Boolean(data.state.freeTrialImageUsed));
          setOnboardingBonusClaimed(Boolean(data.state.onboardingBonusClaimed));
          if (typeof window !== "undefined") {
            window.dispatchEvent(new CustomEvent("evglab-billing-updated"));
          }
        }
        return data.state ?? null;
      } catch {
        // ignore network errors
        return null;
      }
    };

    const waitForActiveBilling = async () => {
      for (let i = 0; i < 8; i += 1) {
        const state = await refreshBillingState();
        if (state?.plan && state.status !== "none" && state.status !== "canceled") {
          return;
        }
        if (i === 3 || i === 6) {
          try {
            await fetch("/api/billing/sync", { method: "POST", cache: "no-store" });
          } catch {
            // ignore network errors
          }
        }
        await new Promise((resolve) => setTimeout(resolve, 1200));
      }
    };

    void (async () => {
      if (typeof window !== "undefined") {
        const params = new URLSearchParams(window.location.search);
        const billing = params.get("billing");
        const sessionId = params.get("session_id");
        if (billing === "success" && sessionId) {
          try {
            await fetch("/api/billing/confirm-session", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ sessionId }),
            });
          } catch {
            // no-op, fallback is webhook
          }
          await waitForActiveBilling();
          const cleaned = new URL(window.location.href);
          cleaned.searchParams.delete("billing");
          cleaned.searchParams.delete("session_id");
          window.history.replaceState({}, "", cleaned.toString());
        }
        if (billing === "success_tokens" || billing === "cancel_tokens") {
          if (billing === "success_tokens" && sessionId) {
            try {
              await fetch("/api/billing/confirm-session", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ sessionId }),
              });
            } catch {
              // webhook remains as fallback
            }
            await refreshBillingState();
            await refreshSummary();
          }
          if (billing === "cancel_tokens") {
            setGlobalNoticeMessage("Token-Kauf abgebrochen. Es wurde nichts berechnet.");
          }
          const cleaned = new URL(window.location.href);
          cleaned.searchParams.delete("billing");
          cleaned.searchParams.delete("session_id");
          window.history.replaceState({}, "", cleaned.toString());
        }
        if (billing === "cancel") {
          setGlobalNoticeMessage("Vorgang abgebrochen. Es wurde kein Abo aktiviert.");
          const cleaned = new URL(window.location.href);
          cleaned.searchParams.delete("billing");
          cleaned.searchParams.delete("session_id");
          window.history.replaceState({}, "", cleaned.toString());
        }

        const homepageCheckoutPlan = getHomepageCheckoutPlan(params);
        if (homepageCheckoutPlan) {
          hasHomepageCheckoutIntentRef.current = true;
          setShowOnboarding(false);
          setShowCreditsOffer(false);
          setShowBrandProfileChoice(false);
          const currentState = await refreshBillingState();
          const hasActivePlan =
            Boolean(currentState?.plan) &&
            currentState?.status !== "none" &&
            currentState?.status !== "canceled";

          if (!hasActivePlan) {
            setSelectedTab("Abo & Tokens");
            setCheckoutMessage("Weiterleitung zu Stripe...");
            await handleSelectPlan(homepageCheckoutPlan);
            return;
          }

          const cleaned = new URL(window.location.href);
          cleaned.searchParams.delete("plan");
          cleaned.searchParams.delete("checkout");
          cleaned.searchParams.delete("source");
          window.history.replaceState({}, "", cleaned.toString());
        }
      }
      const state = await refreshBillingState();
      if (!state?.plan || state.status === "none" || state.status === "canceled") {
        try {
          await fetch("/api/billing/sync", { method: "POST", cache: "no-store" });
        } catch {
          // ignore network errors
        }
        await refreshBillingState();
      } else {
        try {
          await fetch("/api/billing/sync", { method: "POST", cache: "no-store" });
          await refreshBillingState();
          await refreshSummary();
        } catch {
          // ignore network errors
        }
      }
    })();
    return () => {
      ignore = true;
    };
  }, []);

  const closeOnboarding = () => {
    setShowOnboarding(false);
    if (hasHomepageCheckoutIntentRef.current) return;
    setSelectedTab("Dashboard");
    if (brandProfileMode === "undecided") {
      setShowBrandProfileChoice(true);
    }
    const hasActivePlan = Boolean(activeSubscription) && billingStatus !== "none" && billingStatus !== "canceled";
    if (!hasActivePlan && onboardingBonusClaimed === false) {
      setShowCreditsOffer(true);
    }
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(onboardingStorageKey, "seen");
    } catch {
      // ignore localStorage errors
    }
  };

  const handleChooseBrandProfileGuided = () => {
    setBrandProfileMode("guided");
    setBrandLockLevel("strict");
    setShowBrandProfileChoice(false);
    setBrandProfileSetupOpen(true);
  };

  const handleSkipBrandProfile = () => {
    setBrandProfileMode("skip");
    setShowBrandProfileChoice(false);
    void saveProfileSettings({ brandProfileMode: "skip", brandProfileSource: "skip" });
  };

  const handleRestartOnboardingGlobal = () => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.removeItem(onboardingStorageKey);
    } catch {
      // ignore localStorage errors
    }
    setShowOnboarding(true);
    window.dispatchEvent(new CustomEvent("evglab-restart-onboarding"));
  };

  const downloadMediaItem = async (item: MediaLibraryItem) => {
    setDownloadingMediaId(item.id);
    setDownloadErrorMessage("");
    try {
      const response = await fetch(
        `/api/kie/download?url=${encodeURIComponent(item.imageUrl)}&format=${item.outputFormat}&taskId=${encodeURIComponent(item.id)}`,
      );
      if (!response.ok) {
        let message = "Download fehlgeschlagen.";
        try {
          const payload = (await response.json()) as { error?: string };
          if (payload?.error) message = payload.error;
        } catch {
          // ignore parse errors and keep fallback message
        }
        setDownloadErrorMessage(message);
        return;
      }
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = `evglab-${item.id}.${item.outputFormat}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(objectUrl);
    } finally {
      setDownloadingMediaId(null);
    }
  };

  const getMediaAssetUrl = (item: MediaLibraryItem): string => {
    // Keep already-proxied URLs unchanged; proxy direct provider URLs through our API.
    if (item.imageUrl.startsWith("/api/kie/download?")) return item.imageUrl;
    return `/api/kie/download?url=${encodeURIComponent(item.imageUrl)}&format=${item.outputFormat}&taskId=${encodeURIComponent(item.id)}`;
  };

  const downloadGeneratedPreview = async (url: string, index: number) => {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        setGlobalErrorMessage("Download des generierten Bildes fehlgeschlagen.");
        return;
      }
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = `evglab-generiert-${index + 1}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(objectUrl);
    } catch {
      setGlobalErrorMessage("Download des generierten Bildes fehlgeschlagen.");
    }
  };

  const removeMediaItem = async (id: string) => {
    const previousItems = mediaItems;
    setMediaItems((prev) => prev.filter((item) => item.id !== id));
    try {
      const res = await fetch(`/api/dashboard/media?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      if (!res.ok) {
        setMediaItems(previousItems);
        setGlobalErrorMessage("Mediathek-Eintrag konnte nicht gelöscht werden.");
        return;
      }
      await refreshSummary();
    } catch {
      setMediaItems(previousItems);
      setGlobalErrorMessage("Mediathek-Eintrag konnte nicht gelöscht werden.");
    }
  };

  const trackImageFlowMetric = useCallback(
    (eventName: "flow_started" | "flow_completed" | "flow_failed", extra?: Record<string, unknown>) => {
      const payload = {
        eventName,
        preset: contentCreationPreset,
        mode: contentImageMode,
        ts: new Date().toISOString(),
        ...extra,
      };
      try {
        window.localStorage.setItem("evglab:last-image-flow-metric", JSON.stringify(payload));
      } catch {
        // ignore
      }
      void fetch("/api/analytics/image-flow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }).catch(() => undefined);
    },
    [contentCreationPreset, contentImageMode],
  );

  const tabDescriptions: Record<DashboardTab, string> = {
    Dashboard: "Hier siehst du alle wichtigen Zahlen für dein Content- und Abo-Management.",
    "Prompt-Erstellung": "Baue deinen Prompt sauber auf, bevor du Bilder generierst.",
    "Bilder Erstellen": "Plane und erstelle neue Bilder für Social Media, Events und Kampagnen.",
    Mediathek: "Verwalte deine Bilder, Vorlagen und exportierten Assets zentral an einem Ort.",
    "Abo & Tokens": "Behalte deinen Tarif, Verbrauch und kommende Aufladungen im Blick.",
    Team: "Lade Kolleginnen und Kollegen ein und verwalte Rollen im Team.",
    "Admin Center": "Als Admin verwaltest du hier Nutzer, Rollen, Billing, Team und Inhalte zentral.",
    Einstellungen: "Passe Konto, Branding und Standard-Einstellungen für Inhalte an.",
    "Hilfe & Support": "Finde Antworten und kontaktiere bei Bedarf direkt den Support.",
  };
  const remainingTokens = Math.max(monthlyTokens - usedTokens, 0);
  const hasActiveBilling = Boolean(activeSubscription) && billingStatus !== "none" && billingStatus !== "canceled";
  const basePlanTokens = activeSubscription ? PLAN_BASE_TOKENS[activeSubscription] : 0;
  const purchasedExtraTokens = hasActiveBilling ? Math.max(monthlyTokens - basePlanTokens, 0) : 0;
  const availableTokensDisplay = hasActiveBilling ? remainingTokens : (dashboardSummary?.tokens.remaining ?? 0);
  const creditFillPercent =
    hasActiveBilling && monthlyTokens > 0
      ? Math.max(0, Math.min((remainingTokens / monthlyTokens) * 100, 100))
      : 0;
  const draftRequestsBrandFidelity = /(label|etikett|logo|branding|brand|text on bottle|bottle text|wortmarke|marke)/i.test(
    contentDraftPrompt.toLowerCase(),
  );
  const hasComposerReference = Boolean(contentComposerFiles.length);
  const estimatedStrictLabelMode =
    contentImageMode === "campaign" ? true : hasComposerReference || draftRequestsBrandFidelity || contentCreationPreset === "product_studio";
  const estimatedImageCount =
    contentImageMode === "standard" && contentCreationPreset !== "product_cutout" ? contentVariantCount : 1;
  const estimatedTotalTokenSpend = estimateImageTokenCost(hasComposerReference, estimatedStrictLabelMode) * estimatedImageCount;
  const defaultButtonText = contentCreationPreset === "product_cutout" ? "Produkt freistellen" : `Generate • ${estimatedTotalTokenSpend} Tokens`;
  const generateButtonText = contentIsGenerating ? "Generiert..." : defaultButtonText;
  const bellNotifications = [
    {
      id: "generation-finished",
      title: "Bildgenerierung abgeschlossen",
      description: contentGeneratedPreviewUrls.length > 0 ? `${contentGeneratedPreviewUrls.length} Bild(er) bereit.` : "Neue Ergebnisse warten in der Mediathek.",
      actionLabel: "Zur Mediathek",
      onAction: () => setSelectedTab("Mediathek"),
      tone: "success" as const,
      visible: contentGeneratedPreviewUrls.length > 0,
    },
    {
      id: "credits-low",
      title: "Credits werden knapp",
      description: `${availableTokensDisplay.toLocaleString("de-DE")} Tokens verfügbar.`,
      actionLabel: "Zu Pakete",
      onAction: () => setSelectedTab("Abo & Tokens"),
      tone: "warning" as const,
      visible: hasActiveBilling && creditFillPercent <= 25,
    },
    {
      id: "team-invites",
      title: "Team-Updates",
      description: `${teamMembers.filter((member) => member.status === "invited").length} offene Einladung(en).`,
      actionLabel: "Zum Team",
      onAction: () => setSelectedTab("Team"),
      tone: "info" as const,
      visible: teamMembers.some((member) => member.status === "invited"),
    },
    {
      id: "onboarding",
      title: "Onboarding neu starten",
      description: "Du kannst den gefuhrten Rundgang jederzeit erneut starten.",
      actionLabel: "Jetzt starten",
      onAction: () => handleRestartOnboardingGlobal(),
      tone: "neutral" as const,
      visible: true,
    },
  ].filter((item) => item.visible);
  const bellUnreadCount = bellNotifications.filter((item) => !bellReadIds.includes(item.id)).length;
  const hasFreeTrialAvailable = !freeTrialImageUsed;
  const activePlanLabel = activeSubscription ? PLAN_LABELS[activeSubscription] : "Kein aktives Abo";

  const handleSelectPlan = async (plan: SubscriptionPlanKey) => {
    try {
      setGlobalErrorMessage("");
      setLoadingPlan(plan);
      setCheckoutMessage("Sandbox wird geöffnet...");
      setIsCheckoutLoading(true);
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      if (res.status === 401) {
        window.location.href = "/anmelden";
        return;
      }
      if (!res.ok) {
        const payload = (await res.json().catch(() => ({}))) as { error?: string };
        setGlobalErrorMessage(payload.error ?? "Checkout konnte nicht gestartet werden.");
        setIsCheckoutLoading(false);
        setLoadingPlan(null);
        return;
      }
      const data = (await res.json()) as { url?: string };
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      setIsCheckoutLoading(false);
      setLoadingPlan(null);
    } catch (error) {
      setGlobalErrorMessage(error instanceof Error ? error.message : "Checkout fehlgeschlagen.");
      setIsCheckoutLoading(false);
      setLoadingPlan(null);
    }
  };

  const handleClaimCredits = async () => {
    if (!BILLING_CHECKOUT_ENABLED) {
      try {
        setGlobalErrorMessage("");
        const res = await fetch("/api/billing/onboarding-bonus", { method: "POST" });
        if (!res.ok) {
          const payload = (await res.json().catch(() => ({}))) as { error?: string };
          setGlobalErrorMessage(payload.error ?? "Bonus-Credits konnten nicht freigeschaltet werden.");
          return;
        }
        const data = (await res.json()) as {
          state?: {
            plan: SubscriptionPlanKey | null;
            monthlyTokens: number;
            usedTokens: number;
            status?: string;
            bonusGranted?: boolean;
            bonusAlreadyClaimed?: boolean;
          };
        };
        if (data.state) {
          setActiveSubscription(resolveActivePlan(data.state.plan, data.state.monthlyTokens, data.state.status));
          setMonthlyTokens(data.state.monthlyTokens);
          setUsedTokens(data.state.usedTokens);
          setBillingStatus(data.state.status ?? "active");
          setOnboardingBonusClaimed(Boolean(data.state.bonusAlreadyClaimed || data.state.bonusGranted));
          if (typeof window !== "undefined") {
            window.dispatchEvent(new CustomEvent("evglab-billing-updated"));
          }
        }
        setShowCreditsOffer(false);
        setSelectedTab("Bilder Erstellen");
      } catch (error) {
        setGlobalErrorMessage(error instanceof Error ? error.message : "Bonus-Credits konnten nicht freigeschaltet werden.");
      }
      return;
    }
    await handleSelectPlan("start");
  };

  const handleOpenBillingPortal = async () => {
    try {
      setGlobalErrorMessage("");
      setCheckoutMessage("Abo-Verwaltung wird geöffnet...");
      setIsCheckoutLoading(true);
      const res = await fetch("/api/billing/portal", { method: "POST" });
      if (!res.ok) {
        const payload = (await res.json().catch(() => ({}))) as { error?: string };
        setGlobalErrorMessage(payload.error ?? "Billing-Portal konnte nicht geöffnet werden.");
        setIsCheckoutLoading(false);
        return;
      }
      const data = (await res.json()) as { url?: string };
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      setIsCheckoutLoading(false);
    } catch (error) {
      setGlobalErrorMessage(error instanceof Error ? error.message : "Billing-Portal fehlgeschlagen.");
      setIsCheckoutLoading(false);
    }
  };

  const handleBuyTokenPack = async (pack: "tokens_500" | "tokens_2000") => {
    try {
      setGlobalErrorMessage("");
      setCheckoutMessage("Token-Kauf wird vorbereitet...");
      setIsCheckoutLoading(true);
      const res = await fetch("/api/billing/buy-tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pack }),
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => ({}))) as { error?: string };
        setGlobalErrorMessage(payload.error ?? "Token-Kauf konnte nicht gestartet werden.");
        setIsCheckoutLoading(false);
        return;
      }
      const data = (await res.json()) as { url?: string };
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      setIsCheckoutLoading(false);
    } catch (error) {
      setGlobalErrorMessage(error instanceof Error ? error.message : "Token-Kauf fehlgeschlagen.");
      setIsCheckoutLoading(false);
    }
  };

  const consumeTokens = (amount: number) => {
    if (!amount || amount < 0) return;
    setUsedTokens((prev) => Math.min(prev + amount, monthlyTokens));
  };

  const applyBillingUpdateFromGeneration = (billing: {
    monthlyTokens?: number;
    usedTokens?: number;
    remainingTokens?: number;
    consumed?: number;
    freeTrial?: boolean;
  }) => {
    if (typeof billing.monthlyTokens === "number") setMonthlyTokens(billing.monthlyTokens);
    if (typeof billing.usedTokens === "number") setUsedTokens(billing.usedTokens);
    if (billing.freeTrial) setFreeTrialImageUsed(true);
  };

  function estimateImageTokenCost(hasReferenceImage: boolean, strictLabelMode: boolean) {
    const base = contentResolution === "4K" ? 35 : contentResolution === "2K" ? 20 : 10;
    return base + (hasReferenceImage ? 5 : 0) + (strictLabelMode ? 10 : 0);
  }

  const estimateTokenCost = useCallback(
    (hasReferenceImage: boolean, strictLabelMode: boolean) => {
      const base = contentResolution === "4K" ? 35 : contentResolution === "2K" ? 20 : 10;
      return base + (hasReferenceImage ? 5 : 0) + (strictLabelMode ? 10 : 0);
    },
    [contentResolution],
  );

  const saveProfileSettings = async (
    overrides?: Partial<{
      brandProfileMode: "undecided" | "guided" | "skip";
      brandInstagramUrl: string;
      brandWebsiteUrl: string;
      brandProfileSource: "url" | "manual" | "skip";
      brandLockLevel: "strict" | "balanced" | "loose";
      brandTone: string;
      brandColors: string;
      brandDos: string;
      brandDonts: string;
      breweryName: string;
      brandReferenceImageUrls: string[];
    }>,
  ) => {
    setSavingProfile(true);
    setProfileSaveMessage("");
    try {
      const refFromState = brandReferenceImageUrls
        .split(/\r?\n|,/)
        .map((item) => item.trim())
        .filter(Boolean)
        .slice(0, 10);
      const refUrls =
        overrides?.brandReferenceImageUrls !== undefined
          ? overrides.brandReferenceImageUrls.filter(Boolean).slice(0, 10)
          : refFromState;

      const payload = {
        profileName,
        breweryName: overrides?.breweryName ?? breweryName,
        profilePhone,
        emailNotifications,
        weeklySummary,
        brandProfileMode: overrides?.brandProfileMode ?? brandProfileMode,
        brandInstagramUrl: overrides?.brandInstagramUrl ?? brandInstagramUrl,
        brandWebsiteUrl: overrides?.brandWebsiteUrl ?? "",
        brandProfileSource: overrides?.brandProfileSource ?? "manual",
        brandLockLevel: overrides?.brandLockLevel ?? brandLockLevel,
        brandTone: overrides?.brandTone ?? brandTone,
        brandColors: overrides?.brandColors ?? brandColors,
        brandDos: overrides?.brandDos ?? brandDos,
        brandDonts: overrides?.brandDonts ?? brandDonts,
        brandReferenceImageUrls: refUrls,
      };
      const res = await fetch("/api/dashboard/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error ?? "Einstellungen konnten nicht gespeichert werden.");
      }
      setProfileSaveMessage("Einstellungen gespeichert.");
    } catch (error) {
      setProfileSaveMessage(error instanceof Error ? error.message : "Speichern fehlgeschlagen.");
    } finally {
      setSavingProfile(false);
    }
  };

  const applyBrandScanAndPersist = async (suggestion: BrandScanSuggestion) => {
    setBreweryName(suggestion.breweryName);
    setBrandTone(suggestion.brandTone);
    setBrandColors(suggestion.brandColors);
    setBrandDos(suggestion.brandDos);
    setBrandDonts(suggestion.brandDonts);
    setBrandInstagramUrl(suggestion.brandInstagramUrl);
    setBrandReferenceImageUrls(suggestion.referenceImageUrls.join("\n"));
    setBrandProfileMode("guided");
    setProfileSaveMessage("Markenprofil gespeichert und aktiviert.");
  };

  const deleteAccount = async () => {
    if (isDeletingAccount) return;
    if (deleteAccountConfirmation.trim() !== "KONTO LÖSCHEN") {
      setGlobalErrorMessage("Bitte gib exakt „KONTO LÖSCHEN“ ein, um fortzufahren.");
      return;
    }
    const confirmed = window.confirm(
      "Möchtest du dein Konto wirklich dauerhaft löschen? Dieser Vorgang kann nicht rückgängig gemacht werden.",
    );
    if (!confirmed) return;

    try {
      setGlobalErrorMessage("");
      setGlobalNoticeMessage("");
      setIsDeletingAccount(true);
      const res = await fetch("/api/account/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmation: deleteAccountConfirmation.trim() }),
      });
      const payload = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setGlobalErrorMessage(payload.error ?? "Konto konnte nicht gelöscht werden.");
        setIsDeletingAccount(false);
        return;
      }

      window.location.assign("/auth/signout");
    } catch (error) {
      setGlobalErrorMessage(error instanceof Error ? error.message : "Konto konnte nicht gelöscht werden.");
      setIsDeletingAccount(false);
    }
  };

  const fileToDataUrl = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ""));
      reader.onerror = () => reject(new Error("Referenzbild konnte nicht gelesen werden."));
      reader.readAsDataURL(file);
    });

  const refreshSummary = async () => {
    try {
      const res = await fetch("/api/dashboard/summary", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { summary?: DashboardSummary; activities?: ActivityItem[] };
      if (data.summary) setDashboardSummary(data.summary);
      if (Array.isArray(data.activities)) setActivityItems(data.activities);
    } catch {
      // ignore
    }
  };

  const generateContentWithKie = useCallback(
    async (prompt: string, files?: File[]) => {
      if (!brandProfileComplete) {
        setContentGenerationError(
          "Bitte unter Einstellungen im Abschnitt Markenprofil oben ein Profil anlegen oder die Nutzung ohne Markenprofil auswaehlen.",
        );
        return;
      }
      const finalPrompt = prompt.trim();
      if (!finalPrompt) return;
      const normalizedPrompt = finalPrompt.toLowerCase();
      const hasReferenceImages = Boolean(files?.length);
      const preset = contentCreationPreset;
      const mentionsWater = /(water|river|lake|ocean|sea|beach|shore|stream|coast)/i.test(normalizedPrompt);
      const mentionsBottleAndGlass = /(bottle|flasche)/i.test(normalizedPrompt) && /(glass|glas)/i.test(normalizedPrompt);
      const mentionsPouring = /(pour|pouring|einschenk|einschenken|stream|foam\s*head)/i.test(normalizedPrompt);
      const requestsBrandFidelity =
        /(label|etikett|logo|branding|brand|paulaner|hefeweizen|alkoholfrei|text on bottle|bottle text)/i.test(normalizedPrompt);

      const typeGuardrails: string[] = [];
      const negativeConstraints: string[] = [];

      if (preset === "product_cutout") {
        typeGuardrails.push(
          "Generate exactly one centered product cutout with full silhouette visible.",
          "Background must be transparent alpha only; no visible scene, no floor, no gradient background.",
          "No props, no people, no decorative objects, no typography overlays.",
          "Keep object edges clean and production-ready: no halo, no fringing, no jagged extraction artifacts.",
          "Preserve authentic branding and keep all visible label text crisp and readable.",
        );
        negativeConstraints.push(
          "no background",
          "no props",
          "no people",
          "no text overlays",
          "no edge halos",
          "no fringing",
          "no distorted labels",
        );
      } else if (preset === "product_studio") {
        typeGuardrails.push(
          "Create a controlled premium studio product hero visual with explicit key/fill/rim light behavior.",
          "Hero product and label must be tack-sharp and dominant in composition.",
          "Use an intentional studio backdrop with clean depth separation, not a random lifestyle environment.",
          "Allow only curated brewery-related companion elements near the product (e.g. hops, barley, citrus), with strict clutter control.",
          "No people in frame.",
        );
        negativeConstraints.push(
          "no chaotic background",
          "no random lifestyle environment",
          "no people",
          "no cluttered props",
          "no gibberish label text",
          "no warped typography",
        );
      } else {
        typeGuardrails.push(
          "Render all people as hyper-realistic adults with true anatomy and natural proportions.",
          "Skin realism is mandatory: visible pores, subtle blemishes, micro skin texture, natural under-eye detail, realistic lips and ears, no beauty-filter look.",
          "Hands and faces must be artifact-free: no extra fingers, no fused fingers, no asymmetry glitches, no warped teeth or uncanny expressions.",
          "Use physically plausible photography: coherent light direction, contact shadows, realistic reflections, natural dynamic range, no CGI/plastic rendering.",
          "Keep the scene specific and non-generic with concrete environmental details and believable material textures.",
          "Strictly forbid illustration, cartoon, painting, stylized ai-art and 3D render aesthetics.",
        );
        negativeConstraints.push(
          "no waxy/plastic skin",
          "no uncanny facial proportions",
          "no extra fingers, fused fingers, malformed hands, or duplicate limbs",
          "no distorted teeth, warped lips, or asymmetrical eye glitches",
          "no CGI/3D-render look",
          "no cartoon/illustration style",
        );
        if (mentionsWater) {
          typeGuardrails.push(
            "Water realism lock: physically correct ripples/reflections/refraction and depth layering; avoid flat, overly smooth, or synthetic water.",
          );
          negativeConstraints.push("no flat artificial water texture", "no synthetic smooth water surface");
        }
        if (mentionsBottleAndGlass && mentionsPouring) {
          typeGuardrails.push(
            "Liquid continuity lock: bottle level, poured volume, foam growth, and glass fill must be physically consistent throughout the scene.",
          );
        }
      }

      if (hasReferenceImages || requestsBrandFidelity) {
        typeGuardrails.push(
          hasReferenceImages
            ? "Reference brand lock: use the uploaded reference as the primary anchor; reproduce brand identity 1:1 (logo, typography, colors, crest placement, label geometry) without redesign."
            : "Brand lock: reproduce authentic brand identity for any bottles or packaging shown (logo, typography, colors, crest placement, label geometry) without redesign.",
          "Label text must be crisp and legible where visible. No gibberish text, no mirrored letters, no warped or melted typography, no fake substitute branding.",
          "Bottle readability lock: keep at least one hero bottle fully in focus with tack-sharp label detail, no motion blur on the label area, and clear edge contrast around logo and text.",
        );
        negativeConstraints.push("no gibberish label text", "no mirrored text", "no melted or stretched typography", "no fake substitute branding");
      }

      const finalPromptWithTypeLock = [
        finalPrompt,
        "",
        "Generation constraints:",
        ...typeGuardrails.map((line) => `- ${line}`),
        "",
        `Negative prompt: ${negativeConstraints.join(", ")}.`,
      ].join("\n");

      setContentIsGenerating(true);
      setContentGenerationProgress(6);
      setContentGenerationError("");
      setLastGenerationTokenSpend(null);
      setContentGeneratedPreviewUrls([]);

      try {
        const refCap = getPolicyForPreset(contentCreationPreset).upload.max;
        const referenceImageUrls = files?.length
          ? await Promise.all(files.slice(0, refCap).map((file) => fileToDataUrl(file)))
          : undefined;

        const perspectivePrompts = [
          "Camera angle lock: strict eye-level shot, 50mm natural perspective, centered torso framing, horizon at chest level.",
          "Camera angle lock: strict low-angle shot from just above water surface, 35mm lens look, upward perspective with clear foreground depth.",
          "Camera angle lock: strict high-angle / slight top-down shot (~35-45 degrees from above), visible top planes and downward perspective cues.",
        ];
        const identityContinuityLock =
          "Identity continuity lock (MANDATORY for multi-variant set): keep the exact same person identity, same face geometry, same hair color/style, same outfit, same body proportions, same bottle and glass branding. Only camera angle and composition may change between variants.";

        const previews: string[] = [];
        const createdItems: MediaLibraryItem[] = [];

        let consumedTotal = 0;
        let consumedImageCount = 0;
        let usedFreeTrial = false;
        for (let variantIdx = 0; variantIdx < contentVariantCount; variantIdx += 1) {
          setContentGenerationProgress((prev) => Math.max(prev, 8 + variantIdx * 18));
          const variantPrompt =
            contentUsePerspectiveSet && contentVariantCount > 1
              ? `${finalPromptWithTypeLock}\n\n${identityContinuityLock}\n\n${perspectivePrompts[variantIdx % perspectivePrompts.length]}`
              : finalPromptWithTypeLock;

          const createRes = await fetch("/api/kie/nano-banana/create-task", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              imageType: contentCreationPreset,
              prompt: variantPrompt,
              aspectRatio: contentAspectRatio,
              resolution: contentResolution,
              outputFormat: "png",
              referenceImageUrls,
              strictLabelMode: hasReferenceImages || requestsBrandFidelity,
            }),
          });

          const createData = (await createRes.json()) as {
            taskId?: string;
            error?: string;
            usedModel?: string;
            billing?: {
              monthlyTokens?: number;
              usedTokens?: number;
              remainingTokens?: number;
              consumed?: number;
              freeTrial?: boolean;
            };
          };
          if (!createRes.ok || !createData.taskId) {
            throw new Error(createData.error ?? "Kie Task konnte nicht erstellt werden.");
          }
          if (createData.billing) {
            applyBillingUpdateFromGeneration(createData.billing);
            if (typeof createData.billing.consumed === "number") {
              consumedTotal += createData.billing.consumed;
              consumedImageCount += 1;
            }
            if (createData.billing.freeTrial) usedFreeTrial = true;
          }

          const taskId = createData.taskId;
          let imageUrl: string | null = null;
          let doneWithoutImageChecks = 0;

          for (let i = 0; i < 180; i += 1) {
            const dynamicDelay = i < 25 ? 2000 : i < 80 ? 2600 : 3200;
            await new Promise((resolve) => setTimeout(resolve, dynamicDelay));
            const overallProgressBase = 18 + variantIdx * (62 / Math.max(contentVariantCount, 1));
            const overallProgressStep = Math.min(20, Math.floor((i / 180) * 20));
            setContentGenerationProgress((prev) => Math.max(prev, Math.min(94, Math.floor(overallProgressBase + overallProgressStep))));
            const statusRes = await fetch(`/api/kie/nano-banana/task-status?taskId=${encodeURIComponent(taskId)}`);
            const statusData = (await statusRes.json()) as {
              state?: string;
              imageUrl?: string | null;
              error?: string;
            };
            if (!statusRes.ok) {
              throw new Error(statusData.error ?? "Kie Statusabfrage fehlgeschlagen.");
            }
            if (statusData.imageUrl) {
              imageUrl = statusData.imageUrl;
              break;
            }
            const state = String(statusData.state ?? "").toLowerCase();
            if (["success", "succeeded", "done", "finished", "complete", "completed"].includes(state)) {
              doneWithoutImageChecks += 1;
              if (doneWithoutImageChecks >= 35) {
                throw new Error("KIE meldet fertig, liefert das Bild aber verzögert. Bitte erneut prüfen.");
              }
              continue;
            }
            if (["failed", "error", "cancelled", "canceled"].includes(state)) {
              throw new Error("Kie konnte das Bild nicht generieren.");
            }
          }

          if (!imageUrl) {
            throw new Error("Generierung dauert länger als erwartet. Bitte erneut versuchen.");
          }

          previews.push(`/api/kie/download?url=${encodeURIComponent(imageUrl)}&format=png&taskId=${encodeURIComponent(taskId)}`);
          createdItems.push({
            id: taskId,
            imageUrl,
            prompt: variantPrompt.slice(0, 240),
            createdAt: new Date().toISOString(),
            aspectRatio: contentAspectRatio,
            resolution: contentResolution,
            outputFormat: "png",
            model:
              createData.usedModel ??
              (hasReferenceImages ? "gpt-image-2-image-to-image" : "gpt-image-2-text-to-image"),
            referenceImageUrl: referenceImageUrls?.[0],
          });
          setContentGenerationProgress((prev) => Math.max(prev, 35 + Math.floor(((variantIdx + 1) / contentVariantCount) * 55)));
        }

        setContentGeneratedPreviewUrls(previews);
        if (usedFreeTrial) {
          setLastGenerationTokenSpend({ total: 0, imageCount: previews.length, source: "kie", freeTrial: true });
        } else {
          const strictLabelMode = hasReferenceImages || requestsBrandFidelity;
          const fallbackTotal = estimateTokenCost(hasReferenceImages, strictLabelMode) * previews.length;
          setLastGenerationTokenSpend({
            total: consumedTotal > 0 ? consumedTotal : fallbackTotal,
            imageCount: previews.length,
            source: "kie",
          });
        }
        setContentGenerationProgress(100);
        setMediaItems((prev) => [...createdItems, ...prev.filter((entry) => !createdItems.some((it) => it.id === entry.id))].slice(0, 12));
        void Promise.all(
          createdItems.map((item) =>
            fetch("/api/dashboard/media", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(item),
            }),
          ),
        )
          .then(() => refreshSummary())
          .catch(() => {
            setGlobalErrorMessage("Mindestens ein Bild wurde erstellt, konnte aber nicht vollständig in der Mediathek gespeichert werden.");
          });
      } catch (error) {
        setContentGenerationError(error instanceof Error ? error.message : "Bildgenerierung fehlgeschlagen.");
      } finally {
        setContentIsGenerating(false);
        setContentGenerationProgress(0);
      }
    },
    [applyBillingUpdateFromGeneration, brandProfileComplete, contentAspectRatio, contentCreationPreset, contentResolution, contentUsePerspectiveSet, contentVariantCount, estimateTokenCost, refreshSummary],
  );

  const generateWithOpenAiImage2 = useCallback(
    async ({
      prompt,
      files,
      strictLabelMode,
      campaignMode,
      headline,
      subline,
      cta,
    }: {
      prompt: string;
      files?: File[];
      strictLabelMode?: boolean;
      campaignMode?: boolean;
      headline?: string;
      subline?: string;
      cta?: string;
    }) => {
      const refCap = getPolicyForPreset(contentCreationPreset).upload.max;
      const referenceImageUrls = files?.length
        ? await Promise.all(files.slice(0, refCap).map((file) => fileToDataUrl(file)))
        : undefined;
      const res = await fetch("/api/openai/image2/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageType: contentCreationPreset,
          prompt,
          aspectRatio: contentAspectRatio,
          resolution: contentResolution,
          outputFormat: "png",
          referenceImageUrls,
          strictLabelMode: Boolean(strictLabelMode),
          plattform: campaignMode ? "Instagram Post" : "Website Hero",
          textImLabel: headline ?? "",
          campaignMode: Boolean(campaignMode),
          subline: subline ?? "",
          cta: cta ?? "",
        }),
      });
      const data = (await res.json()) as {
        generationId?: string;
        imageUrl?: string;
        usedModel?: string;
        error?: string;
        billing?: {
          monthlyTokens?: number;
          usedTokens?: number;
          remainingTokens?: number;
          consumed?: number;
          freeTrial?: boolean;
        };
      };
      if (!res.ok || !data.imageUrl) {
        throw new Error(data.error ?? "ChatGPT Image 2 Generierung fehlgeschlagen.");
      }
      if (data.billing) {
        applyBillingUpdateFromGeneration(data.billing);
      }
      const id = data.generationId ?? `openai-${Date.now()}`;
      const preview = `/api/kie/download?url=${encodeURIComponent(data.imageUrl)}&format=png&taskId=${encodeURIComponent(id)}`;
      const createdItem: MediaLibraryItem = {
        id,
        imageUrl: data.imageUrl,
        prompt: prompt.slice(0, 240),
        createdAt: new Date().toISOString(),
        aspectRatio: contentAspectRatio,
        resolution: contentResolution,
        outputFormat: "png",
        model: data.usedModel ?? "chatgpt-image-2",
        referenceImageUrl: referenceImageUrls?.[0],
      };
      return { preview, createdItem, billing: data.billing };
    },
    [applyBillingUpdateFromGeneration, contentAspectRatio, contentCreationPreset, contentResolution],
  );

  const generateContentWithOpenAiImage2 = useCallback(
    async (prompt: string, files?: File[]) => {
      if (!brandProfileComplete) {
        setContentGenerationError(
          "Bitte unter Einstellungen im Abschnitt Markenprofil oben ein Profil anlegen oder die Nutzung ohne Markenprofil auswaehlen.",
        );
        return;
      }
      const finalPrompt = prompt.trim();
      if (!finalPrompt) return;
      const normalizedPrompt = finalPrompt.toLowerCase();
      const hasReferenceImages = Boolean(files?.length);
      const requestsBrandFidelity =
        /(label|etikett|logo|branding|brand|text on bottle|bottle text|wortmarke|marke)/i.test(normalizedPrompt);
      const strictLabelMode = hasReferenceImages || requestsBrandFidelity || contentCreationPreset === "product_studio";
      const modelReadyPrompt =
        contentCreationPreset === "product_studio" && hasReferenceImages
          ? `${finalPrompt}\n\nReference lock: Reproduce the uploaded label/brand exactly 1:1 with sharp readable text and unchanged layout.`
          : finalPrompt;

      setContentIsGenerating(true);
      setContentGenerationProgress(10);
      setContentGenerationError("");
      setLastGenerationTokenSpend(null);
      setContentGeneratedPreviewUrls([]);
      try {
        const { preview, createdItem, billing } = await generateWithOpenAiImage2({
          prompt: modelReadyPrompt,
          files,
          strictLabelMode,
        });
        if (billing?.freeTrial) {
          setLastGenerationTokenSpend({ total: 0, imageCount: 1, source: "openai", freeTrial: true });
        } else {
          setLastGenerationTokenSpend({
            total:
              typeof billing?.consumed === "number"
                ? billing.consumed
                : estimateTokenCost(hasReferenceImages, strictLabelMode),
            imageCount: 1,
            source: "openai",
          });
        }
        setContentGenerationProgress(100);
        setContentGeneratedPreviewUrls([preview]);
        setMediaItems((prev) => [createdItem, ...prev.filter((entry) => entry.id !== createdItem.id)].slice(0, 12));
        try {
          await fetch("/api/dashboard/media", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(createdItem),
          });
          await refreshSummary();
        } catch {
          setGlobalErrorMessage("Das Bild wurde erstellt, konnte aber nicht vollständig in der Mediathek gespeichert werden.");
        }
      } catch (error) {
        setContentGenerationError(error instanceof Error ? error.message : "Bildgenerierung fehlgeschlagen.");
      } finally {
        setContentIsGenerating(false);
        setContentGenerationProgress(0);
      }
    },
    [brandProfileComplete, contentCreationPreset, estimateTokenCost, generateWithOpenAiImage2, refreshSummary],
  );

  const generateCampaignWithOpenAiImage2 = useCallback(
    async (
      scenePrompt: string,
      headline: string,
      subline: string,
      cta: string,
      files?: File[],
      opts?: { imageLedFromReferences?: boolean },
    ) => {
      if (!campaignBrandOk) {
        setContentGenerationError(
          "Kampagnenbild mit Text ist nur mit angelegtem Markenprofil moeglich (Einstellungen, nicht „ohne Markenprofil“).",
        );
        return;
      }
      const scene = scenePrompt.trim();
      if (!scene) return;
      const imageLed = Boolean(opts?.imageLedFromReferences);
      const campaignPrompt = imageLed
        ? applyContentPresetPrompt(buildCampaignCreativeFromReferencesPrompt(scene), "campaign_social")
        : applyContentPresetPrompt(buildCampaignCreativePrompt(scene, headline, subline, cta), "campaign_social");

      setContentIsGenerating(true);
      setContentGenerationProgress(8);
      setContentGenerationError("");
      setLastGenerationTokenSpend(null);
      setContentGeneratedPreviewUrls([]);

      try {
        const { preview, createdItem, billing } = await generateWithOpenAiImage2({
          prompt: campaignPrompt,
          files,
          strictLabelMode: true,
          campaignMode: true,
          headline: imageLed ? "" : headline,
          subline: imageLed ? "" : subline,
          cta: imageLed ? "" : cta,
        });
        const hasReferenceImages = Boolean(files?.length);
        if (billing?.freeTrial) {
          setLastGenerationTokenSpend({ total: 0, imageCount: 1, source: "openai", freeTrial: true });
        } else {
          setLastGenerationTokenSpend({
            total: typeof billing?.consumed === "number" ? billing.consumed : estimateTokenCost(hasReferenceImages, true),
            imageCount: 1,
            source: "openai",
          });
        }
        setContentGenerationProgress(100);
        setContentGeneratedPreviewUrls([preview]);
        setMediaItems((prev) => [createdItem, ...prev.filter((entry) => entry.id !== createdItem.id)].slice(0, 12));
        try {
          await fetch("/api/dashboard/media", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(createdItem),
          });
          await refreshSummary();
        } catch {
          setGlobalErrorMessage("Das Bild wurde erstellt, konnte aber nicht vollständig in der Mediathek gespeichert werden.");
        }
      } catch (error) {
        setContentGenerationError(error instanceof Error ? error.message : "Kampagnenbild fehlgeschlagen.");
      } finally {
        setContentIsGenerating(false);
        setContentGenerationProgress(0);
      }
    },
    [campaignBrandOk, estimateTokenCost, generateWithOpenAiImage2, refreshSummary],
  );

  const generateCampaignWithKie = useCallback(
    async (
      scenePrompt: string,
      headline: string,
      subline: string,
      cta: string,
      files?: File[],
      opts?: { imageLedFromReferences?: boolean },
    ) => {
      if (!campaignBrandOk) {
        setContentGenerationError(
          "Kampagnenbild mit Text ist nur mit angelegtem Markenprofil moeglich (Einstellungen, nicht „ohne Markenprofil“).",
        );
        return;
      }
      const scene = scenePrompt.trim();
      if (!scene) return;

      const imageLed = Boolean(opts?.imageLedFromReferences);
      const campaignPrompt = imageLed
        ? applyContentPresetPrompt(buildCampaignCreativeFromReferencesPrompt(scene), "campaign_social")
        : buildCampaignCreativePrompt(scene, headline, subline, cta);

      setContentIsGenerating(true);
      setContentGenerationProgress(8);
      setContentGenerationError("");
      setLastGenerationTokenSpend(null);
      setContentGeneratedPreviewUrls([]);

      try {
        const refCap = getPolicyForPreset(contentCreationPreset).upload.max;
        const referenceImageUrls =
          files?.length && files.length > 0
            ? await Promise.all(files.slice(0, refCap).map((file) => fileToDataUrl(file)))
            : undefined;

        setContentGenerationProgress(18);
        const createRes = await fetch("/api/kie/nano-banana/create-task", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            imageType: contentCreationPreset,
            prompt: campaignPrompt,
            aspectRatio: contentAspectRatio,
            resolution: contentResolution,
            outputFormat: "png",
            referenceImageUrls,
            strictLabelMode: true,
          }),
        });

        const createData = (await createRes.json()) as {
          taskId?: string;
          error?: string;
          usedModel?: string;
          billing?: {
            monthlyTokens?: number;
            usedTokens?: number;
            remainingTokens?: number;
            consumed?: number;
            freeTrial?: boolean;
          };
        };
        if (!createRes.ok || !createData.taskId) {
          throw new Error(createData.error ?? "Kie Task konnte nicht erstellt werden.");
        }
        if (createData.billing) {
          applyBillingUpdateFromGeneration(createData.billing);
        }

        const taskId = createData.taskId;
        let imageUrl: string | null = null;
        let doneWithoutImageChecks = 0;

        for (let i = 0; i < 180; i += 1) {
          const dynamicDelay = i < 25 ? 2000 : i < 80 ? 2600 : 3200;
          await new Promise((resolve) => setTimeout(resolve, dynamicDelay));
          const overallProgressBase = 22;
          const overallProgressStep = Math.min(20, Math.floor((i / 180) * 20));
          setContentGenerationProgress((prev) => Math.max(prev, Math.min(94, Math.floor(overallProgressBase + overallProgressStep))));
          const statusRes = await fetch(`/api/kie/nano-banana/task-status?taskId=${encodeURIComponent(taskId)}`);
          const statusData = (await statusRes.json()) as {
            state?: string;
            imageUrl?: string | null;
            error?: string;
          };
          if (!statusRes.ok) {
            throw new Error(statusData.error ?? "Kie Statusabfrage fehlgeschlagen.");
          }
          if (statusData.imageUrl) {
            imageUrl = statusData.imageUrl;
            break;
          }
          const state = String(statusData.state ?? "").toLowerCase();
          if (["success", "succeeded", "done", "finished", "complete", "completed"].includes(state)) {
            doneWithoutImageChecks += 1;
            if (doneWithoutImageChecks >= 35) {
              throw new Error("KIE meldet fertig, liefert das Bild aber verzögert. Bitte erneut prüfen.");
            }
            continue;
          }
          if (["failed", "error", "cancelled", "canceled"].includes(state)) {
            throw new Error("Kie konnte das Bild nicht generieren.");
          }
        }

        if (!imageUrl) {
          throw new Error("Generierung dauert länger als erwartet. Bitte erneut versuchen.");
        }

        const preview = `/api/kie/download?url=${encodeURIComponent(imageUrl)}&format=png&taskId=${encodeURIComponent(taskId)}`;


        const createdItem: MediaLibraryItem = {
          id: taskId,
          imageUrl,
          prompt: [`[Instagram-Kampagne] ${headline.trim() || "Text aus Referenz + Marke"}`, scene.slice(0, 180)]
            .filter(Boolean)
            .join(" — ")
            .slice(0, 240),
          createdAt: new Date().toISOString(),
          aspectRatio: contentAspectRatio,
          resolution: contentResolution,
          outputFormat: "png",
          model:
            createData.usedModel ??
            (referenceImageUrls?.length ? "gpt-image-2-image-to-image" : "gpt-image-2-text-to-image"),
          referenceImageUrl: referenceImageUrls?.[0],
        };

        setContentGeneratedPreviewUrls([preview]);
        if (createData.billing?.freeTrial) {
          setLastGenerationTokenSpend({ total: 0, imageCount: 1, source: "kie", freeTrial: true });
        } else {
          setLastGenerationTokenSpend({
            total:
              typeof createData.billing?.consumed === "number"
                ? createData.billing.consumed
                : estimateTokenCost(Boolean(referenceImageUrls?.length), true),
            imageCount: 1,
            source: "kie",
          });
        }
        setContentGenerationProgress(100);
        setMediaItems((prev) => [createdItem, ...prev.filter((entry) => entry.id !== createdItem.id)].slice(0, 12));

        try {
          await fetch("/api/dashboard/media", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(createdItem),
          });
          await refreshSummary();
        } catch {
          setGlobalErrorMessage("Das Bild wurde erstellt, konnte aber nicht vollständig in der Mediathek gespeichert werden.");
        }
      } catch (error) {
        setContentGenerationError(error instanceof Error ? error.message : "Kampagnenbild fehlgeschlagen.");
      } finally {
        setContentIsGenerating(false);
        setContentGenerationProgress(0);
      }
    },
    [applyBillingUpdateFromGeneration, campaignBrandOk, contentAspectRatio, contentCreationPreset, contentResolution, estimateTokenCost, refreshSummary],
  );

  const inviteTeamMember = async () => {
    setTeamMessage("");
    setTeamSaving(true);
    try {
      const res = await fetch("/api/dashboard/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: teamInviteEmail, name: teamInviteName, role: teamInviteRole }),
      });
      const data = (await res.json()) as { error?: string; members?: TeamMember[] };
      if (!res.ok) throw new Error(data.error ?? "Einladung fehlgeschlagen.");
      setTeamMembers(data.members ?? []);
      setTeamInviteEmail("");
      setTeamInviteName("");
      setTeamMessage("Einladung wurde per E-Mail versendet.");
      await refreshSummary();
    } catch (error) {
      setTeamMessage(error instanceof Error ? error.message : "Einladung fehlgeschlagen.");
    } finally {
      setTeamSaving(false);
    }
  };

  const updateTeamRole = async (memberId: string, role: "admin" | "editor" | "viewer") => {
    const res = await fetch("/api/dashboard/team", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberId, role }),
    });
    const data = (await res.json()) as { error?: string; members?: TeamMember[] };
    if (!res.ok) {
      setTeamMessage(data.error ?? "Rolle konnte nicht aktualisiert werden.");
      return;
    }
    setTeamMembers(data.members ?? []);
  };

  const removeTeamMember = async (memberId: string) => {
    const res = await fetch(`/api/dashboard/team?memberId=${encodeURIComponent(memberId)}`, { method: "DELETE" });
    const data = (await res.json()) as { error?: string; members?: TeamMember[] };
    if (!res.ok) {
      setTeamMessage(data.error ?? "Mitglied konnte nicht entfernt werden.");
      return;
    }
    setTeamMembers(data.members ?? []);
    await refreshSummary();
  };

  const renderTabPanel = () => {
    if (selectedTab === "Dashboard") {
      return (
        <>
          <div data-onboarding="dashboard-overview" className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-white/12 bg-[linear-gradient(180deg,#1a1f2a_0%,#161b24_100%)] p-6 shadow-[0_14px_34px_-24px_rgba(0,0,0,0.95)] transition duration-200 hover:-translate-y-0.5 hover:border-[#c8ff26]/25 hover:bg-[linear-gradient(180deg,#1d2430_0%,#181f2a_100%)]">
              <div className="mb-4 flex items-center justify-between">
                <div className="rounded-lg border border-orange-400/20 bg-orange-500/10 p-2">
                  <Sparkles className="h-5 w-5 text-orange-300" />
                </div>
              </div>
              <h3 className="mb-1 text-sm font-medium text-zinc-400">Verfügbare Tokens</h3>
              <p className="text-3xl font-bold text-white">
                {availableTokensDisplay.toLocaleString("de-DE")}
              </p>
              <p className="mt-1 text-sm text-emerald-300">
                {hasActiveBilling ? `${usedTokens.toLocaleString("de-DE")} verbraucht` : "kein Abo aktiv"}
              </p>
            </div>

            <div className="rounded-xl border border-white/12 bg-[linear-gradient(180deg,#1a1f2a_0%,#161b24_100%)] p-6 shadow-[0_14px_34px_-24px_rgba(0,0,0,0.95)] transition duration-200 hover:-translate-y-0.5 hover:border-[#c8ff26]/25 hover:bg-[linear-gradient(180deg,#1d2430_0%,#181f2a_100%)]">
              <div className="mb-4 flex items-center justify-between">
                <div className="rounded-lg border border-emerald-400/20 bg-emerald-500/10 p-2">
                  <FileText className="h-5 w-5 text-emerald-300" />
                </div>
              </div>
              <h3 className="mb-1 text-sm font-medium text-zinc-400">Posts diesen Monat</h3>
              <p className="text-3xl font-bold text-white">{dashboardSummary?.postsThisMonth ?? 0}</p>
              <p className="mt-1 text-sm text-emerald-300">aus deiner Mediathek berechnet</p>
            </div>

            <div className="rounded-xl border border-white/12 bg-[linear-gradient(180deg,#1a1f2a_0%,#161b24_100%)] p-6 shadow-[0_14px_34px_-24px_rgba(0,0,0,0.95)] transition duration-200 hover:-translate-y-0.5 hover:border-[#c8ff26]/25 hover:bg-[linear-gradient(180deg,#1d2430_0%,#181f2a_100%)]">
              <div className="mb-4 flex items-center justify-between">
                <div className="rounded-lg border border-violet-400/20 bg-violet-500/10 p-2">
                  <Beer className="h-5 w-5 text-violet-300" />
                </div>
              </div>
              <h3 className="mb-1 text-sm font-medium text-zinc-400">Kampagnen aktiv</h3>
              <p className="text-3xl font-bold text-white">{dashboardSummary?.activeCampaigns ?? 0}</p>
              <p className="mt-1 text-sm text-violet-300">automatisch aus Aktivität abgeleitet</p>
            </div>

            <div className="rounded-xl border border-white/12 bg-[linear-gradient(180deg,#1a1f2a_0%,#161b24_100%)] p-6 shadow-[0_14px_34px_-24px_rgba(0,0,0,0.95)] transition duration-200 hover:-translate-y-0.5 hover:border-[#c8ff26]/25 hover:bg-[linear-gradient(180deg,#1d2430_0%,#181f2a_100%)]">
              <div className="mb-4 flex items-center justify-between">
                <div className="rounded-lg border border-orange-400/20 bg-orange-500/10 p-2">
                  <Users className="h-5 w-5 text-orange-300" />
                </div>
              </div>
              <h3 className="mb-1 text-sm font-medium text-zinc-400">Teammitglieder</h3>
              <p className="text-3xl font-bold text-white">{dashboardSummary?.teamMembers ?? teamMembers.length}</p>
              <p className="mt-1 text-sm text-orange-300">
                {dashboardSummary?.openInvites ?? teamMembers.filter((member) => member.status === "invited").length} Einladung(en) offen
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <div className="rounded-xl border border-white/10 bg-[#171a20] p-6 shadow-sm">
                <div className="mb-6 flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Letzte Aktivitäten</h3>
                  <button
                    type="button"
                    onClick={() => setSelectedTab("Mediathek")}
                    className="text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                  >
                    Alle anzeigen
                  </button>
                </div>
                <div className="space-y-4">
                  {activityItems.map((activity) => {
                    const ActivityIcon = getActivityIcon(activity.type);
                    return (
                    <div key={activity.id} className="flex cursor-pointer items-center space-x-4 rounded-lg p-3 transition-colors hover:bg-gray-50 dark:hover:bg-gray-800">
                      <div
                        className={`rounded-lg p-2 ${
                          activity.color === "green"
                            ? "bg-green-50 dark:bg-green-900/20"
                            : activity.color === "blue"
                              ? "bg-blue-50 dark:bg-blue-900/20"
                              : activity.color === "purple"
                                ? "bg-purple-50 dark:bg-purple-900/20"
                                : "bg-orange-50 dark:bg-orange-900/20"
                        }`}
                      >
                        <ActivityIcon
                          className={`h-4 w-4 ${
                            activity.color === "green"
                              ? "text-green-600 dark:text-green-400"
                              : activity.color === "blue"
                                ? "text-blue-600 dark:text-blue-400"
                                : activity.color === "purple"
                                  ? "text-purple-600 dark:text-purple-400"
                                  : "text-orange-600 dark:text-orange-400"
                          }`}
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">{activity.title}</p>
                        <p className="truncate text-xs text-gray-500 dark:text-gray-400">{activity.desc}</p>
                      </div>
                      <div className="text-xs text-gray-400 dark:text-gray-500">{formatRelativeTime(activity.time)}</div>
                    </div>
                  );
                  })}
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="rounded-xl border border-white/10 bg-[#171a20] p-6 shadow-sm">
                <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">Schnellaktionen</h3>
                <div className="space-y-4">
                  <button
                    onClick={() => setSelectedTab("Bilder Erstellen")}
                    className="flex w-full items-center justify-between rounded-lg border border-white/10 bg-[#171a20] px-3 py-2 text-left text-sm transition-colors hover:bg-[#1e232b]"
                  >
                    <span>Neuen Social-Post erstellen</span>
                    <Wand2 className="h-4 w-4 text-gray-500" />
                  </button>
                  <button
                    onClick={() => setSelectedTab("Bilder Erstellen")}
                    className="flex w-full items-center justify-between rounded-lg border border-white/10 bg-[#171a20] px-3 py-2 text-left text-sm transition-colors hover:bg-[#1e232b]"
                  >
                    <span>Bild für Event generieren</span>
                    <Image className="h-4 w-4 text-gray-500" />
                  </button>
                  <button
                    onClick={() => setSelectedTab("Team")}
                    className="flex w-full items-center justify-between rounded-lg border border-white/10 bg-[#171a20] px-3 py-2 text-left text-sm transition-colors hover:bg-[#1e232b]"
                  >
                    <span>Teammitglied einladen</span>
                    <Users className="h-4 w-4 text-gray-500" />
                  </button>
                </div>
              </div>

              <div className="rounded-xl border border-white/10 bg-[#171a20] p-6 shadow-sm">
                <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">Aktiver Tarif</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">Du nutzt aktuell den Plan</p>
                <p className="mt-1 text-xl font-semibold text-gray-900 dark:text-gray-100">{activePlanLabel}</p>
                <p className="mt-2 text-sm text-emerald-600 dark:text-emerald-400">
                  {hasActiveBilling ? `${basePlanTokens.toLocaleString("de-DE")} Tokens / Monat` : "Bitte wähle einen Plan"}
                </p>
                {hasActiveBilling && purchasedExtraTokens > 0 ? (
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    +{purchasedExtraTokens.toLocaleString("de-DE")} Zusatz-Tokens verfügbar
                  </p>
                ) : null}
              </div>
            </div>
          </div>

        </>
      );
    }

    if (selectedTab === "Bilder Erstellen") {
      return (
        <section className="relative min-h-[calc(100vh-5.5rem)] overflow-x-hidden bg-transparent pb-[env(safe-area-inset-bottom)]">
          {contentIsGenerating ? (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#070b13]/70 backdrop-blur-[2px]">
              <div className="w-full max-w-sm rounded-2xl border border-white/15 bg-[#111827]/90 p-5 shadow-2xl">
                <div className="mb-3 flex items-center gap-3">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/35 border-t-[#c8ff26]" />
                  <p className="text-sm font-semibold text-white">Bilder werden erstellt ...</p>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-[#c8ff26] transition-all duration-300"
                    style={{ width: `${Math.max(6, Math.min(100, contentGenerationProgress))}%` }}
                  />
                </div>
                <p className="mt-2 text-xs text-zinc-300">
                  Das kann je nach Auslastung und Auflösung etwas dauern. Bitte kurz warten.
                </p>
              </div>
            </div>
          ) : null}
          <div
            data-onboarding="content-workflow"
            className="relative z-0 mx-auto flex min-h-0 max-w-5xl flex-col items-center justify-center px-4 pb-4 pt-1 text-center sm:min-h-[calc(100vh-5.5rem)] sm:justify-center sm:px-6 sm:pb-[min(22rem,40vh)] sm:pt-4"
          >
              {contentGeneratedPreviewUrls.length > 0 ? (
                <div data-onboarding="content-result" className="mb-3 w-full max-w-5xl rounded-2xl border border-white/15 bg-black/20 p-3 shadow-[0_18px_44px_-28px_rgba(0,0,0,0.85)]">
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {contentGeneratedPreviewUrls.map((url, idx) => (
                      <div key={url} className="overflow-hidden rounded-xl border border-white/10 bg-[#111827]/80">
                        <img src={url} alt={`Generiertes Ergebnis ${idx + 1}`} className="h-auto w-full object-cover" />
                        <div className="border-t border-white/10 p-2">
                          <button
                            type="button"
                            onClick={() => {
                              void downloadGeneratedPreview(url, idx);
                            }}
                            className="inline-flex h-8 items-center rounded-md border border-white/15 bg-white/5 px-2.5 text-xs font-medium text-white transition hover:bg-white/10"
                          >
                            Herunterladen
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
              {contentGeneratedPreviewUrls.length === 0 ? (
                <>
                  <div className="mt-1 mb-3 flex -space-x-3 sm:mt-1">
                    {["/public/ki-real-1.png", "/public/ki-real-2.png", "/public/ki-real-3.png"].map((src, i) => (
                      <div
                        key={src}
                        className={`h-24 w-24 overflow-hidden rounded-xl border border-white/20 shadow-[0_12px_28px_-18px_rgba(70,120,255,0.9)] sm:h-28 sm:w-28 ${
                          i === 1 ? "translate-y-1 rotate-0" : i === 0 ? "-rotate-12" : "rotate-12"
                        }`}
                      >
                        <img src={src} alt="" className="h-full w-full object-cover" />
                      </div>
                    ))}
                  </div>
                  <h2 className="text-2xl font-extrabold uppercase tracking-tight text-white sm:text-3xl">
                    Bilder Erstellen mit
                    <span className="mt-0.5 block text-white">deinem KI-Studio.</span>
                  </h2>
                  <p className="mt-2 max-w-xl text-sm leading-snug text-zinc-300 sm:text-base">
                    Wähle den Bildtyp im Composer, hänge bei Bedarf Referenzen an und beschreibe kurz Szene oder Stimmung — die KI erzeugt daraus fertige Motive für Social und Kampagnen (inkl. Text im Bild beim Typ „Kampagnenbild mit Text“).
                  </p>
                </>
              ) : null}
            </div>
          <div
            data-onboarding="content-brief"
            className={cn(
              "z-20 mx-auto w-auto max-w-5xl",
              contentGeneratedPreviewUrls.length > 0
                ? "relative mt-2 px-4 sm:px-5"
                : "relative mt-1 px-4 pb-20 sm:absolute sm:right-5 sm:bottom-24 sm:left-5 sm:mt-0 sm:px-0 sm:pb-0",
            )}
          >
            {!brandProfileComplete ? (
              <p className="mb-2 rounded-lg border border-amber-400/35 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
                Bitte unter <strong>Einstellungen</strong> im Abschnitt <strong>Markenprofil</strong> oben ein Profil anlegen oder die Nutzung ohne Markenprofil aktivieren.
              </p>
            ) : null}
            <p className="mb-2 text-left text-xs leading-snug text-zinc-500 sm:text-center">
              Konkrete Stichworte zu Licht, Getränk und Stimmung verbessern das Ergebnis. Referenzbilder dort nutzen, wo der gewählte Bildtyp sie unterstützt.
            </p>
            <PromptInputBox
              key={hybridCurrentQuestion ? "content-follow-up" : "content-typing"}
              value={contentDraftPrompt}
              onValueChange={setContentDraftPrompt}
              onFilesChange={setContentComposerFiles}
              maxReferenceImages={getPolicyForPreset(contentCreationPreset).upload.max}
              aspectRatio={contentAspectRatio}
              onAspectRatioChange={setContentAspectRatio}
              resolution={contentResolution}
              onResolutionChange={setContentResolution}
              sendButtonText={generateButtonText}
              variantCount={contentImageMode === "standard" && contentCreationPreset !== "product_cutout" ? contentVariantCount : undefined}
              onVariantCountChange={contentImageMode === "standard" && contentCreationPreset !== "product_cutout" ? setContentVariantCount : undefined}
              usePerspectiveSet={contentImageMode === "standard" && contentCreationPreset !== "product_cutout" ? contentUsePerspectiveSet : undefined}
              onUsePerspectiveSetChange={
                contentImageMode === "standard" && contentCreationPreset !== "product_cutout"
                  ? setContentUsePerspectiveSet
                  : undefined
              }
              presetButtonLabel={selectedContentPreset.title}
              onPresetButtonClick={() => setContentPresetPickerOpen(true)}
              placeholder={
                hybridCurrentQuestion
                  ? "Bitte eine Option unten auswählen..."
                  : contentCreationPreset === "product_cutout"
                    ? "Kein Prompt nötig - Produktbild hochladen und generieren."
                    : contentImageMode === "campaign"
                      ? "Optional: Zusätzliche Stimmung — leer lassen reicht mit Referenzbild(ern)."
                      : " "
              }
              enableTypingPlaceholder={!hybridCurrentQuestion}
              typingPhrases={getFlowTypingPhrases(contentCreationPreset, contentImageMode)}
              className="border-white/10 bg-[#131926]/80"
              isLoading={contentIsGenerating || hybridIsLoading}
              disabled={!brandProfileComplete}
              clearOnSend={false}
              onValidationError={setContentValidationError}
              onSend={(message, files) => {
                void submitContentFlowInput(message, files);
              }}
            />
            {contentPresetPickerOpen ? (
              <div className="fixed inset-0 z-[120] flex items-end justify-center bg-black/70 px-2 py-2 backdrop-blur-sm sm:items-center sm:px-3 sm:py-4">
                <div className="w-full max-w-5xl rounded-2xl border border-white/15 bg-[#0a0f16] p-3 shadow-[0_35px_90px_-40px_rgba(0,0,0,0.9)] sm:rounded-3xl sm:p-4">
                  <div className="mb-2 flex items-start justify-between gap-2 sm:mb-3">
                    <div>
                      <p className="text-xl font-extrabold uppercase tracking-tight text-white sm:text-3xl">Bildtyp auswählen</p>
                      <p className="mt-1 text-xs text-zinc-400 sm:text-sm">
                        Wähle den Stil. Wir bauen den Prompt danach automatisch passend auf.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setContentPresetPickerOpen(false)}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-zinc-200 transition hover:bg-white/10"
                      aria-label="Auswahl schließen"
                    >
                      ×
                    </button>
                  </div>
                  <div className="max-h-[min(78vh,40rem)] overflow-y-auto overscroll-contain pb-2 pr-1 sm:max-h-[85vh] sm:pb-1 sm:pr-0">
                    <div className="grid gap-1.5 sm:grid-cols-2 sm:gap-2 lg:grid-cols-4">
                    {CONTENT_CREATION_PRESETS.map((preset) => {
                      const active = preset.id === contentCreationPreset;
                      const campaignLocked = preset.id === "campaign_social" && !campaignBrandOk;
                      const previewTall = preset.id === "campaign_social";
                      return (
                        <button
                          key={preset.id}
                          type="button"
                          title={
                            campaignLocked
                              ? "Nur mit Markenprofil (Einstellungen, nicht ohne Profil)"
                              : undefined
                          }
                          onClick={() => {
                            if (campaignLocked) return;
                            setContentCreationPreset(preset.id);
                            setContentPresetPickerOpen(false);
                          }}
                          className={cn(
                            "rounded-xl border p-2.5 text-left transition sm:rounded-2xl sm:p-3",
                            active
                              ? "border-[#c8ff26]/50 bg-[#c8ff26]/12"
                              : "border-white/10 bg-black/25 hover:bg-white/10",
                            campaignLocked && "cursor-not-allowed opacity-45 hover:bg-black/25",
                          )}
                        >
                          <div
                            className={cn(
                              "mb-2 flex w-full items-center justify-center rounded-lg border border-white/10 bg-[#0f172a] p-2 sm:mb-3 sm:rounded-xl",
                              previewTall ? "min-h-[13rem] sm:min-h-[15rem]" : "min-h-[9.5rem] sm:min-h-[10.5rem]",
                            )}
                          >
                            <img
                              src={preset.previewSrc}
                              alt={preset.title}
                              className={cn(
                                "w-full object-contain object-center",
                                previewTall ? "max-h-[min(52vh,15.5rem)] sm:max-h-[17rem]" : "max-h-[min(28vh,10.5rem)] sm:max-h-[11rem]",
                              )}
                            />
                          </div>
                          <p className={cn("text-sm font-semibold leading-tight", active ? "text-[#d7ff6f]" : "text-zinc-100")}>
                            {preset.title}
                          </p>
                          <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-zinc-400 sm:text-xs">
                            {preset.description}
                          </p>
                        </button>
                      );
                    })}
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
            {hybridCurrentQuestion ? (
              <div className="mt-1.5 rounded-lg border border-[#c8ff26]/35 bg-[#c8ff26]/10 px-3 py-2 text-xs text-[#e8ff9a]">
                <p className="font-semibold uppercase tracking-wide">Rueckfrage</p>
                <p className="mt-1 text-sm normal-case text-zinc-100">{hybridCurrentQuestion}</p>
                {hybridCurrentOptions.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {hybridCurrentOptions.map((option) => (
                      <button
                        key={option}
                        type="button"
                        onClick={() => {
                          setContentDraftPrompt(option);
                          void submitContentFlowInput(option, contentPendingFiles);
                        }}
                        className="rounded-full border border-[#c8ff26]/45 bg-[#1a2b07] px-3 py-1.5 text-xs font-medium text-[#eaffb4] transition hover:bg-[#243d0a]"
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
            {lastGenerationTokenSpend ? (
              <p className="mt-1.5 text-xs text-[#c8ff26]">
                {lastGenerationTokenSpend.freeTrial
                  ? `Letzte Generierung (${lastGenerationTokenSpend.source === "kie" ? "KIE" : "GPT Image 2"}): Gratisbild genutzt (0 Tokens).`
                  : `Letzte Generierung (${lastGenerationTokenSpend.source === "kie" ? "KIE" : "GPT Image 2"}): ${lastGenerationTokenSpend.total} Tokens für ${lastGenerationTokenSpend.imageCount} Bild${lastGenerationTokenSpend.imageCount > 1 ? "er" : ""} verbraucht.`}
              </p>
            ) : null}
            {contentGenerationError ? (
              <p className="mt-1.5 text-sm text-red-300">{contentGenerationError}</p>
            ) : null}
            {contentValidationError ? <p className="mt-1 text-sm text-red-300">{contentValidationError}</p> : null}
            {hybridError ? <p className="mt-1 text-sm text-red-300">{hybridError}</p> : null}
          </div>
        </section>
      );
    }

    if (selectedTab === "Abo & Tokens") {
      return (
        <div className="space-y-6">
          <BrewerySubscriptionPlans
            activePlan={activeSubscription}
            onSelectPlan={BILLING_CHECKOUT_ENABLED ? handleSelectPlan : undefined}
            loadingPlan={loadingPlan}
            isLoading={BILLING_CHECKOUT_ENABLED ? isCheckoutLoading : false}
            checkoutEnabled={BILLING_CHECKOUT_ENABLED}
          />
          <section data-onboarding="billing-overview" className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Abo & Tokens</h2>
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                {hasActiveBilling ? `${activeSubscription?.toUpperCase()} aktiv` : "Kein Abo aktiv"}
              </span>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Verwalte deinen Tarif, sehe den aktuellen Verbrauch und wähle bei Bedarf einen neuen Plan.
            </p>
            {!BILLING_CHECKOUT_ENABLED ? (
              <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
                Testmodus aktiv: Abo-Abschlüsse und Token-Käufe sind aktuell deaktiviert.
              </div>
            ) : null}
            {BILLING_KLEINUNTERNEHMER_MODE ? (
              <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900 dark:border-blue-900/60 dark:bg-blue-900/20 dark:text-blue-200">
                Kleinunternehmer-Modus aktiv: Gemäß § 19 UStG wird keine Umsatzsteuer berechnet.
              </div>
            ) : null}
            <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs text-gray-700 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-300">
              <p>Tarif-Tokens pro Monat: {basePlanTokens.toLocaleString("de-DE")}</p>
              {purchasedExtraTokens > 0 ? (
                <p>Zusatz-Tokens (gekauft): {purchasedExtraTokens.toLocaleString("de-DE")}</p>
              ) : null}
              <p>Verbraucht: {usedTokens.toLocaleString("de-DE")}</p>
              <p className="font-semibold">Verfügbar: {availableTokensDisplay.toLocaleString("de-DE")}</p>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  void handleOpenBillingPortal();
                }}
                disabled={!hasActiveBilling || !BILLING_CHECKOUT_ENABLED}
                className="inline-flex h-9 items-center rounded-md border border-gray-300 px-3 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
              >
                Abo verwalten / kündigen
              </button>
              <button
                type="button"
                onClick={() => {
                  void handleBuyTokenPack("tokens_500");
                }}
                disabled={!hasActiveBilling || !BILLING_CHECKOUT_ENABLED}
                className="inline-flex h-9 items-center rounded-md bg-[#c65a20] px-3 text-sm font-medium text-white transition hover:bg-[#b14f1c] disabled:cursor-not-allowed disabled:opacity-50"
              >
                +500 Tokens kaufen
              </button>
              <button
                type="button"
                onClick={() => {
                  void handleBuyTokenPack("tokens_2000");
                }}
                disabled={!hasActiveBilling || !BILLING_CHECKOUT_ENABLED}
                className="inline-flex h-9 items-center rounded-md bg-[#7b4bf9] px-3 text-sm font-medium text-white transition hover:bg-[#6a3ee3] disabled:cursor-not-allowed disabled:opacity-50"
              >
                +2.000 Tokens kaufen
              </button>
            </div>
          </section>
        </div>
      );
    }

    if (selectedTab === "Mediathek") {
      const normalizedSearch = mediaSearch.trim().toLowerCase();
      const visibleMediaItems = mediaItems.filter((item) => {
        const matchesSearch =
          normalizedSearch.length === 0 ||
          item.prompt.toLowerCase().includes(normalizedSearch) ||
          item.aspectRatio.toLowerCase().includes(normalizedSearch) ||
          item.resolution.toLowerCase().includes(normalizedSearch);
        const matchesFavorites = !mediaShowFavoritesOnly || mediaFavoriteIds.includes(item.id);
        return matchesSearch && matchesFavorites;
      });

      return (
        <section data-onboarding="media-library" className="overflow-hidden rounded-2xl border border-white/10 bg-[#0f1218] shadow-sm">
          <div className="grid min-h-[560px] grid-cols-1 lg:grid-cols-[240px_1fr]">
            <aside className="border-r border-white/10 bg-[#0c1016] p-4">
              <div className="mb-4">
                <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-[#121824] px-3 py-2">
                  <span className="text-xs text-zinc-400">🔎</span>
                  <input
                    value={mediaSearch}
                    onChange={(e) => setMediaSearch(e.target.value)}
                    placeholder="Suchen"
                    className="w-full bg-transparent text-xs text-zinc-100 outline-none placeholder:text-zinc-500"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => setMediaShowFavoritesOnly(false)}
                  className={cn(
                    "flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs font-medium transition",
                    !mediaShowFavoritesOnly
                      ? "border border-white/15 bg-white/10 text-white"
                      : "text-zinc-300 hover:bg-white/5",
                  )}
                >
                  <span>Alle Medien</span>
                  <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[10px]">{mediaItems.length}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setMediaShowFavoritesOnly(true)}
                  className={cn(
                    "flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs font-medium transition",
                    mediaShowFavoritesOnly
                      ? "border border-white/15 bg-white/10 text-white"
                      : "text-zinc-300 hover:bg-white/5",
                  )}
                >
                  <span>Favoriten</span>
                  <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[10px]">{mediaFavoriteIds.length}</span>
                </button>
              </div>
              <div className="mt-6 border-t border-white/10 pt-4">
                <p className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Werkzeuge</p>
                <button
                  type="button"
                  className="flex w-full items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-left text-xs font-medium text-zinc-100"
                >
                  <span>Bilder</span>
                  <span className="text-[10px] text-zinc-400">{mediaItems.length}</span>
                </button>
              </div>
            </aside>
            <div className="p-5">
              <div className="mb-5 flex items-center justify-between">
                <h2 className="text-xl font-semibold text-zinc-100">Alle Medien</h2>
                <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-zinc-300">
                  {visibleMediaItems.length} Bilder
                </span>
              </div>
              {downloadErrorMessage ? (
                <p className="mb-3 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-200">
                  {downloadErrorMessage}
                </p>
              ) : null}
              {visibleMediaItems.length === 0 ? (
                <div className="rounded-lg border border-dashed border-white/15 bg-white/5 p-4 text-sm text-zinc-400">
                  Keine Bilder gefunden.
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  {visibleMediaItems.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setSelectedMediaItem(item);
                        const img = new window.Image();
                        img.onload = () =>
                          setMediaImageDimensions((prev) => ({
                            ...prev,
                            [item.id]: `${img.naturalWidth}x${img.naturalHeight}`,
                          }));
                        img.src = getMediaAssetUrl(item);
                      }}
                      className="group relative overflow-hidden rounded-xl border border-white/10 bg-[#121827] shadow-sm transition hover:scale-[1.01]"
                    >
                      <img src={getMediaAssetUrl(item)} alt="Mediathek Bild" className="h-48 w-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          {selectedMediaItem ? (
            <div className="fixed inset-0 z-[110] bg-black/70 backdrop-blur-sm">
              <div className="relative mx-auto flex h-full w-full max-w-[1300px] items-center gap-6 px-6 py-6">
                <button
                  type="button"
                  onClick={() => setSelectedMediaItem(null)}
                  className="absolute right-4 top-4 rounded-full border border-white/20 bg-black/35 px-2.5 py-1 text-xs text-white"
                >
                  Schließen
                </button>
                <div className="flex-1 rounded-2xl border border-white/15 bg-black/20 p-4">
                  <img src={getMediaAssetUrl(selectedMediaItem)} alt="Asset Vorschau" className="mx-auto max-h-[84vh] w-auto rounded-xl object-contain" />
                </div>
                <aside className="w-[320px] rounded-2xl border border-white/10 bg-[#12151b] p-4 text-white">
                  <div className="mb-4 flex items-center justify-between">
                    <p className="text-sm font-semibold">{displayName}</p>
                    <button
                      type="button"
                      onClick={() => setSelectedMediaItem(null)}
                      className="text-xs text-zinc-400 hover:text-white"
                    >
                      ✕
                    </button>
                  </div>
                  <div className="mb-4 rounded-xl border border-white/10 bg-white/5 p-3">
                    <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-400">Prompt</p>
                    <p className="text-xs text-zinc-200">{selectedMediaItem.prompt}</p>
                  </div>
                  <div className="mb-4 rounded-xl border border-white/10 bg-white/5 p-3">
                    <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-zinc-400">Information</p>
                    <div className="space-y-2 text-xs text-zinc-300">
                      <div className="flex items-center justify-between"><span>Modell</span><span>{selectedMediaItem.model ?? "Nano Banana Pro"}</span></div>
                      <div className="flex items-center justify-between"><span>Qualität</span><span>{selectedMediaItem.resolution}</span></div>
                      <div className="flex items-center justify-between"><span>Größe</span><span>{mediaImageDimensions[selectedMediaItem.id] ?? "Lädt..."}</span></div>
                    </div>
                  </div>
                  <div className="mb-4 rounded-xl border border-white/10 bg-white/5 p-3">
                    <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-zinc-400">Referenzbild</p>
                    {selectedMediaItem.referenceImageUrl ? (
                      <img src={selectedMediaItem.referenceImageUrl} alt="Referenzbild" className="h-24 w-24 rounded-lg object-cover" />
                    ) : (
                      <p className="text-xs text-zinc-500">Kein Referenzbild hinterlegt.</p>
                    )}
                  </div>
                  <div className="mb-4 rounded-xl border border-white/10 bg-white/5 p-3">
                    <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-zinc-400">Kommentare</p>
                    <div className="mb-2 max-h-24 space-y-1 overflow-auto">
                      {(mediaCommentsById[selectedMediaItem.id] ?? []).length === 0 ? (
                        <p className="text-xs text-zinc-500">Noch keine Kommentare.</p>
                      ) : (
                        (mediaCommentsById[selectedMediaItem.id] ?? []).map((comment, idx) => (
                          <p key={`${selectedMediaItem.id}-comment-${idx}`} className="text-xs text-zinc-300">
                            - {comment}
                          </p>
                        ))
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        value={mediaCommentInput}
                        onChange={(e) => setMediaCommentInput(e.target.value)}
                        placeholder="Kommentar hinzufügen..."
                        className="h-8 w-full rounded-md border border-white/10 bg-[#0f141e] px-2 text-xs text-zinc-100 outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const value = mediaCommentInput.trim();
                          if (!value) return;
                          setMediaCommentsById((prev) => ({
                            ...prev,
                            [selectedMediaItem.id]: [...(prev[selectedMediaItem.id] ?? []), value],
                          }));
                          setMediaCommentInput("");
                        }}
                        className="h-8 rounded-md border border-white/15 px-2 text-xs"
                      >
                        +
                      </button>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      void downloadMediaItem(selectedMediaItem);
                    }}
                    className="h-9 w-full rounded-lg border border-white/15 text-xs text-zinc-200"
                  >
                    Download
                  </button>
                </aside>
              </div>
            </div>
          ) : null}
        </section>
      );
    }

    if (selectedTab === "Einstellungen") {
      const markenprofilButtonLabel =
        brandProfileMode === "guided" && brandProfileComplete ? "Markenprofil bearbeiten" : "Markenprofil erstellen";
      return (
        <>
          <section className="mb-5 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Markenprofil</h2>
                <p className="mt-1 max-w-xl text-sm text-gray-600 dark:text-gray-300">
                  {brandProfileMode === "skip"
                    ? "Du nutzt EvGlab ohne Markenprofil. Ueber den Button kannst du jederzeit ein Profil aus fuenf Instagram-Post-Screenshots anlegen — die KI uebernimmt Tonality, Farben und Regeln fuer Texte auf Bildern."
                    : brandProfileComplete
                      ? "Dein Markenprofil ist aktiv. Zum Anpassen erneut fuenf aktuelle Instagram-Posts hochladen und auswerten lassen."
                      : "Lege dein Markenprofil fest: fuenf Screenshots deiner Instagram-Posts, dann wertet die KI Stil und Vorgaben aus."}
                </p>
              </div>
              <button
                type="button"
                data-onboarding="settings-brand-profile"
                onClick={() => {
                  setBrandProfileSetupOpen(true);
                }}
                className="inline-flex h-11 shrink-0 items-center justify-center rounded-lg bg-[#c65a20] px-5 text-sm font-semibold text-white transition hover:bg-[#b14f1c]"
              >
                {markenprofilButtonLabel}
              </button>
            </div>
          </section>
          <section data-onboarding="settings-overview" className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Profil-Einstellungen</h2>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
              Kontaktdaten und Benachrichtigungen — Markenprofil legst du im Abschnitt darueber fest.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <label className="space-y-1 text-sm">
              <span className="text-gray-700 dark:text-gray-300">Anzeigename</span>
              <input
                value={profileName}
                onChange={(e) => setProfileName(e.target.value)}
                className="h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-gray-900 focus:border-[#c65a20] focus:outline-none dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                placeholder="z. B. Anna Schmidt"
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-gray-700 dark:text-gray-300">Brauerei</span>
              <input
                value={breweryName}
                onChange={(e) => setBreweryName(e.target.value)}
                className="h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-gray-900 focus:border-[#c65a20] focus:outline-none dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                placeholder="z. B. Meine Marke"
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-gray-700 dark:text-gray-300">E-Mail</span>
              <input
                value={userEmail ?? ""}
                readOnly
                className="h-10 w-full rounded-md border border-gray-200 bg-gray-50 px-3 text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-gray-700 dark:text-gray-300">Telefon (optional)</span>
              <input
                value={profilePhone}
                onChange={(e) => setProfilePhone(e.target.value)}
                className="h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-gray-900 focus:border-[#c65a20] focus:outline-none dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                placeholder="+49 ..."
              />
            </label>
          </div>
          <div className="mt-6 space-y-3 rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-950">
            <label className="flex items-center justify-between gap-3 text-sm">
              <span className="text-gray-700 dark:text-gray-300">E-Mail-Benachrichtigungen</span>
              <input
                type="checkbox"
                checked={emailNotifications}
                onChange={(e) => setEmailNotifications(e.target.checked)}
                className="h-4 w-4 accent-[#c65a20]"
              />
            </label>
            <label className="flex items-center justify-between gap-3 text-sm">
              <span className="text-gray-700 dark:text-gray-300">Wöchentliche Zusammenfassung</span>
              <input
                type="checkbox"
                checked={weeklySummary}
                onChange={(e) => setWeeklySummary(e.target.checked)}
                className="h-4 w-4 accent-[#c65a20]"
              />
            </label>
          </div>
          <div className="mt-6 rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-950">
            <h3 className="mb-2 text-sm font-semibold text-gray-900 dark:text-gray-100">Markenprofil &amp; KI</h3>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Markenstil und Referenzbilder kommen aus dem Abschnitt{" "}
              <strong>Markenprofil</strong> oben (Instagram-Posts). Hier kannst du die Nutzung ohne Markenprofil
              freischalten, falls du nur schnell testen willst.
            </p>
            <label className="mt-3 block max-w-md space-y-1 text-sm">
              <span className="text-gray-700 dark:text-gray-300">Brand-Lock (nur mit aktivem Markenprofil)</span>
              <select
                value={brandLockLevel}
                onChange={(e) => setBrandLockLevel(e.target.value as "strict" | "balanced" | "loose")}
                disabled={brandProfileMode === "skip"}
                className="h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-gray-900 focus:border-[#c65a20] focus:outline-none disabled:opacity-50 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                aria-label="Brand-Lock Stufe"
              >
                <option value="strict">Strict — maximale Markentreue</option>
                <option value="balanced">Balanced — Markentreue mit Spielraum</option>
                <option value="loose">Loose — nur Stilrichtung</option>
              </select>
            </label>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleSkipBrandProfile}
                className="inline-flex h-9 items-center rounded-md border border-gray-300 px-3 text-xs font-medium text-gray-700 transition hover:bg-gray-100 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
              >
                Ohne Markenprofil nutzen
              </button>
            </div>
            {brandProfileMode === "skip" ? (
              <p className="mt-2 text-sm text-amber-700 dark:text-amber-300">
                KI-Bildgenerierung laeuft ohne Markenbindung. Zum Aktivieren oben &quot;Markenprofil erstellen&quot; waehlen.
              </p>
            ) : null}
          </div>
          <div className="mt-5 flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                void saveProfileSettings();
              }}
              disabled={savingProfile}
              className="inline-flex h-10 items-center rounded-md bg-[#c65a20] px-4 text-sm font-medium text-white transition hover:bg-[#b14f1c] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {savingProfile ? "Speichert..." : "Einstellungen speichern"}
            </button>
            {profileSaveMessage ? (
              <span className="text-sm text-gray-600 dark:text-gray-300">{profileSaveMessage}</span>
            ) : null}
          </div>
          <div className="mt-8 rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-900/50 dark:bg-red-950/30">
            <h3 className="text-sm font-semibold text-red-800 dark:text-red-200">Konto dauerhaft löschen</h3>
            <p className="mt-1 text-sm text-red-700 dark:text-red-300">
              Dieser Vorgang löscht dein Benutzerkonto endgültig. Bestehende Abos werden dabei beendet.
            </p>
            <label className="mt-3 block space-y-1 text-sm">
              <span className="text-red-800 dark:text-red-200">Zur Bestätigung „KONTO LÖSCHEN“ eingeben</span>
              <input
                value={deleteAccountConfirmation}
                onChange={(e) => setDeleteAccountConfirmation(e.target.value)}
                className="h-10 w-full rounded-md border border-red-300 bg-white px-3 text-red-900 focus:border-red-500 focus:outline-none dark:border-red-800 dark:bg-gray-950 dark:text-red-100"
                placeholder="KONTO LÖSCHEN"
              />
            </label>
            <button
              type="button"
              onClick={() => {
                void deleteAccount();
              }}
              disabled={isDeletingAccount || deleteAccountConfirmation.trim() !== "KONTO LÖSCHEN"}
              className="mt-3 inline-flex h-10 items-center rounded-md bg-red-600 px-4 text-sm font-medium text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isDeletingAccount ? "Konto wird gelöscht..." : "Konto löschen"}
            </button>
          </div>
        </section>
        </>
      );
    }

    if (selectedTab === "Team") {
      return (
        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Team verwalten</h2>
            <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-300">
              {teamMembers.length} Mitglieder
            </span>
          </div>
          <div className="grid gap-3 md:grid-cols-4">
            <input
              value={teamInviteEmail}
              onChange={(e) => setTeamInviteEmail(e.target.value)}
              placeholder="E-Mail"
              className="h-10 rounded-md border border-gray-300 px-3 text-sm dark:border-gray-700 dark:bg-gray-950"
            />
            <input
              value={teamInviteName}
              onChange={(e) => setTeamInviteName(e.target.value)}
              placeholder="Name (optional)"
              className="h-10 rounded-md border border-gray-300 px-3 text-sm dark:border-gray-700 dark:bg-gray-950"
            />
            <select
              value={teamInviteRole}
              onChange={(e) => setTeamInviteRole(e.target.value as "admin" | "editor" | "viewer")}
              className="h-10 rounded-md border border-gray-300 px-3 text-sm dark:border-gray-700 dark:bg-gray-950"
            >
              <option value="admin">Admin</option>
              <option value="editor">Editor</option>
              <option value="viewer">Viewer</option>
            </select>
            <button
              type="button"
              disabled={teamSaving || !teamInviteEmail}
              onClick={() => {
                void inviteTeamMember();
              }}
              className="h-10 rounded-md bg-[#c65a20] px-4 text-sm font-medium text-white hover:bg-[#b14f1c] disabled:opacity-50"
            >
              {teamSaving ? "Einladen..." : "Einladung senden"}
            </button>
          </div>
          {teamMessage ? <p className="mt-3 text-sm text-gray-600 dark:text-gray-300">{teamMessage}</p> : null}
          <div className="mt-6 space-y-3">
            {teamMembers.map((member) => (
              <article key={member.id} className="rounded-lg border border-gray-200 p-3 dark:border-gray-700">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{member.name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{member.email}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {member.status === "invited" ? "Einladung offen" : "Aktiv"} • {formatRelativeTime(member.invitedAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      disabled={member.role === "owner"}
                      value={member.role}
                      onChange={(e) => {
                        void updateTeamRole(member.id, e.target.value as "admin" | "editor" | "viewer");
                      }}
                      className="h-8 rounded-md border border-gray-300 px-2 text-xs dark:border-gray-700 dark:bg-gray-950"
                    >
                      <option value="owner">Owner</option>
                      <option value="admin">Admin</option>
                      <option value="editor">Editor</option>
                      <option value="viewer">Viewer</option>
                    </select>
                    {member.role !== "owner" ? (
                      <button
                        type="button"
                        onClick={() => {
                          void removeTeamMember(member.id);
                        }}
                        className="h-8 rounded-md border border-red-200 px-2 text-xs text-red-600 hover:bg-red-50 dark:border-red-900/50 dark:text-red-300"
                      >
                        Entfernen
                      </button>
                    ) : null}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      );
    }

    if (selectedTab === "Admin Center" && isAdmin) {
      return (
        <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <AdminDashboard />
        </section>
      );
    }

    if (selectedTab === "Hilfe & Support") {
      return (
        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <h2 className="mb-2 text-xl font-semibold text-gray-900 dark:text-gray-100">Hilfe & Support</h2>
          <p className="mb-6 text-sm text-gray-600 dark:text-gray-400">
            Erreiche den Support direkt oder nutze die Schnellhilfe für typische Fragen.
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            <a href="mailto:support@evglab.ai" className="rounded-lg border border-gray-200 p-4 text-sm hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800">
              <p className="font-semibold text-gray-900 dark:text-gray-100">E-Mail Support</p>
              <p className="mt-1 text-gray-600 dark:text-gray-400">support@evglab.ai</p>
            </a>
            <a href="/impressum" className="rounded-lg border border-gray-200 p-4 text-sm hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800">
              <p className="font-semibold text-gray-900 dark:text-gray-100">Kontakt & Impressum</p>
              <p className="mt-1 text-gray-600 dark:text-gray-400">Direkte Kontaktwege und Unternehmensdaten.</p>
            </a>
          </div>
          <div className="mt-6 rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-950">
            <p className="mb-2 text-sm font-semibold text-gray-900 dark:text-gray-100">Support-Nachricht senden</p>
            <input
              value={supportSubject}
              onChange={(e) => setSupportSubject(e.target.value)}
              placeholder="Betreff"
              className="mb-2 h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm dark:border-gray-700 dark:bg-gray-900"
            />
            <textarea
              value={supportMessage}
              onChange={(e) => setSupportMessage(e.target.value)}
              placeholder="Beschreibe kurz dein Anliegen..."
              className="h-28 w-full rounded-md border border-gray-300 bg-white p-3 text-sm dark:border-gray-700 dark:bg-gray-900"
            />
            <div className="mt-3 flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  if (!supportSubject || !supportMessage) {
                    setSupportInfoMessage("Bitte Betreff und Nachricht ausfüllen.");
                    return;
                  }
                  const mailto = `mailto:support@evglab.ai?subject=${encodeURIComponent(supportSubject)}&body=${encodeURIComponent(supportMessage)}`;
                  window.location.href = mailto;
                  setSupportInfoMessage("Mail-App wurde geöffnet.");
                }}
                className="h-9 rounded-md bg-[#c65a20] px-4 text-sm font-medium text-white hover:bg-[#b14f1c]"
              >
                Support kontaktieren
              </button>
              {supportInfoMessage ? <p className="text-xs text-gray-600 dark:text-gray-300">{supportInfoMessage}</p> : null}
            </div>
          </div>
        </section>
      );
    }

    return (
      <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">{selectedTab}</h2>
          <span className="rounded-full bg-orange-50 px-3 py-1 text-xs font-medium text-[#c65a20] dark:bg-orange-900/30 dark:text-orange-300">
            Neuer Bereich
          </span>
        </div>
        <p className="mb-6 max-w-3xl text-sm text-gray-600 dark:text-gray-400">{tabDescriptions[selectedTab]}</p>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-950/60">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Priorität</p>
            <p className="mt-2 text-sm font-semibold text-gray-900 dark:text-gray-100">Heute weiterarbeiten</p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">3 Aufgaben warten auf dich</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-950/60">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Status</p>
            <p className="mt-2 text-sm font-semibold text-gray-900 dark:text-gray-100">Alles synchron</p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Letztes Update vor 2 Minuten</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-950/60">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Nächster Schritt</p>
            <p className="mt-2 text-sm font-semibold text-gray-900 dark:text-gray-100">Bereich konfigurieren</p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Design bleibt konsistent zum Dashboard</p>
          </div>
        </div>
      </section>
    );
  };

  return (
    <div
      className={cn(
        "relative flex-1 overflow-auto px-3 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-2 sm:p-4 sm:pb-[calc(6.5rem+env(safe-area-inset-bottom))]",
        isCreationTab ? "bg-[#070b13]" : "bg-gray-50 dark:bg-gray-950",
      )}
    >
      {isCreationTab ? (
        <>
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_80%_at_50%_8%,rgba(112,78,255,0.30),transparent_48%),radial-gradient(90%_60%_at_50%_38%,rgba(44,108,255,0.16),transparent_55%),radial-gradient(90%_120%_at_50%_100%,rgba(98,56,196,0.2),transparent_62%)]" />
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,rgba(0,0,0,0.16),rgba(0,0,0,0.45))]" />
        </>
      ) : null}
      {isCheckoutLoading ? (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/55 px-4">
          <div className="w-full max-w-sm rounded-2xl border border-white/20 bg-gray-950/95 p-6 text-white shadow-2xl">
            <div className="mb-4 flex items-center gap-3">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              <p className="text-sm font-semibold">{checkoutMessage}</p>
            </div>
            <p className="text-xs text-gray-200">Bitte kurz warten. Stripe wird in einem Moment geöffnet.</p>
          </div>
        </div>
      ) : null}
      {showCreditsOffer ? (
        <div className="fixed inset-0 z-[125] flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-md rounded-2xl border border-orange-200 bg-white p-6 shadow-2xl dark:border-orange-900/40 dark:bg-gray-900">
            <div className="mb-3 inline-flex items-center rounded-full bg-orange-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-orange-700 dark:bg-orange-900/30 dark:text-orange-300">
              Willkommen-Bonus
            </div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Du bekommst 300 freie Credits</h3>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
              Klicke auf den Button, um deine Credits freizuschalten. Die Freischaltung erfolgt im Abo-Checkout.
            </p>
            <button
              type="button"
              onClick={() => {
                void handleClaimCredits();
              }}
              className="mt-5 inline-flex h-11 w-full items-center justify-center rounded-md bg-[#c65a20] px-4 text-sm font-semibold text-white transition hover:bg-[#b14f1c]"
            >
              300 Credits sichern und Abo starten
            </button>
          </div>
        </div>
      ) : null}
      <BrandProfileSetupModal
        open={brandProfileSetupOpen}
        onOpenChange={setBrandProfileSetupOpen}
        title={
          brandProfileMode === "guided" && brandProfileComplete ? "Markenprofil bearbeiten" : "Markenprofil erstellen"
        }
        onSaved={async (suggestion) => {
          await applyBrandScanAndPersist(suggestion);
        }}
      />
      {showBrandProfileChoice ? (
        <div className="fixed inset-0 z-[126] flex items-center justify-center bg-black/65 px-4">
          <div className="w-full max-w-lg rounded-2xl border border-white/15 bg-[#131926]/95 p-6 text-zinc-100 shadow-2xl">
            <h3 className="text-xl font-semibold text-white">Willst du deinen Markenstil fixieren?</h3>
            <p className="mt-2 text-sm text-zinc-300">
              Ueber fuenf Screenshots deiner Instagram-Posts erstellt die KI dein Markenprofil — damit Texte auf Bildern
              und Motive zu eurer Linie passen. Du kannst das spaeter unter Einstellungen jederzeit aendern.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleChooseBrandProfileGuided}
                className="inline-flex h-11 items-center rounded-md bg-[#c8ff26] px-5 text-sm font-semibold text-black transition hover:bg-[#b8ef22]"
              >
                Ja, Markenprofil anlegen
              </button>
              <button
                type="button"
                onClick={handleSkipBrandProfile}
                className="inline-flex h-11 items-center rounded-md border border-white/15 px-5 text-sm font-medium text-zinc-200 transition hover:bg-white/10"
              >
                Nein, direkt Bilder generieren
              </button>
            </div>
          </div>
        </div>
      ) : null}
      <OnboardingDialog
        open={showOnboarding}
        onClose={closeOnboarding}
        steps={DASHBOARD_ONBOARDING_STEPS}
        onStepChange={(step) => {
          const navStep = step.targetSelector.includes('data-onboarding-nav="');
          if (navStep) {
            setTopNavMenuOpen(true);
          } else if (step.targetSelector.includes('data-onboarding-nav-toggle="main"')) {
            setTopNavMenuOpen(false);
          }
          if (step.tab) {
            window.requestAnimationFrame(() => {
              setSelectedTab(step.tab as DashboardTab);
            });
          }
        }}
      />
      <OnboardingDialog
        open={showContentTour}
        onClose={() => setShowContentTour(false)}
        steps={CONTENT_CREATION_TOUR_STEPS}
        onStepChange={(step) => {
          setTopNavMenuOpen(false);
          if (step.tab) {
            window.requestAnimationFrame(() => {
              setSelectedTab(step.tab as DashboardTab);
            });
          }
        }}
      />
      {globalErrorMessage ? (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-300">
          {globalErrorMessage}
        </div>
      ) : null}
      {globalNoticeMessage ? (
        <div className="mb-4 flex items-start justify-between gap-3 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800 dark:border-blue-900/40 dark:bg-blue-900/20 dark:text-blue-200">
          <span>{globalNoticeMessage}</span>
          <button
            type="button"
            onClick={() => setGlobalNoticeMessage("")}
            className="text-xs font-medium text-blue-700 hover:underline dark:text-blue-200"
            aria-label="Hinweis schließen"
          >
            Schließen
          </button>
        </div>
      ) : null}
      <div
        className={cn(
          "pointer-events-auto mb-3 sticky top-0 z-[90] flex w-full items-center justify-between gap-2 rounded-2xl px-3 pb-2 pt-[max(0.5rem,env(safe-area-inset-top))] sm:-mx-4 sm:mb-4 sm:rounded-none sm:px-4 sm:py-2.5",
          isCreationTab
            ? "border-b border-white/10 bg-black/[0.08] shadow-none backdrop-blur-2xl dark:bg-black/[0.08]"
            : "border-b border-gray-200/80 bg-gray-50/95 backdrop-blur dark:border-gray-800/80 dark:bg-gray-950/90",
        )}
      >
        <div className="flex min-w-0 items-center gap-2 whitespace-nowrap">
          <button
            type="button"
            onClick={() => {
              if (typeof window === "undefined") return;
              window.location.assign(MARKETING_SITE_URL);
            }}
            className="inline-flex h-10 shrink-0 items-center gap-2 rounded-xl border border-white/10 bg-[#171a20] px-2.5 text-sm font-medium text-white shadow-[0_8px_20px_-14px_rgba(0,0,0,0.7)] transition hover:bg-[#1e232b]"
            title="Zur Startseite"
          >
            <span className="font-semibold tracking-tight text-white">EvGLab</span>
            <span className="hidden text-xs text-zinc-300 sm:inline">Startseite</span>
          </button>
          <div
            className={cn(
              "hidden md:flex items-center gap-2 overflow-hidden transition-all duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)]",
              topNavMenuOpen ? "max-w-[1200px] translate-x-0 opacity-100" : "pointer-events-none max-w-0 -translate-x-2 opacity-0",
            )}
          >
            {topTabs.map(({ title, Icon, notifs }) => {
              const isActive = selectedTab === title;
              return (
                <button
                  key={title}
                  type="button"
                  onClick={() => setSelectedTab(title)}
                  data-onboarding-nav={
                    title === "Dashboard"
                      ? "dashboard"
                      : title === "Prompt-Erstellung"
                        ? "prompt"
                      : title === "Bilder Erstellen"
                        ? "content"
                        : title === "Mediathek"
                          ? "library"
                          : title === "Abo & Tokens"
                            ? "billing"
                            : title === "Team"
                              ? "team"
                              : title === "Einstellungen" || title === "Admin Center"
                                ? "settings"
                                : "support"
                  }
                  className={cn(
                    "relative inline-flex h-10 shrink-0 items-center gap-2 rounded-xl border px-3 text-sm font-medium leading-none whitespace-nowrap shadow-[0_8px_20px_-14px_rgba(0,0,0,0.7)] transition",
                    isActive
                      ? "border-[#2f66ff]/40 bg-[#1d2f6f] text-white"
                      : "border-white/10 bg-[#171a20] text-zinc-100 hover:bg-[#1e232b]",
                  )}
                >
                  <Icon className={cn("h-4 w-4", tabIconClassByTitle[title])} />
                  {title}
                  {notifs ? (
                    <span className="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[#2f66ff] px-1.5 text-[10px] font-semibold text-white">
                      {notifs}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
          <div
            className={cn(
              "hidden md:block overflow-hidden transition-all duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)]",
              topNavMenuOpen ? "pointer-events-none max-w-0 opacity-0" : "max-w-[320px] opacity-100",
            )}
          >
            {(() => {
              const activeTab = topTabs.find((tab) => tab.title === selectedTab);
              const ActiveIcon = activeTab?.Icon ?? Home;
              return (
                <button
                  type="button"
                  className="relative inline-flex h-10 shrink-0 items-center gap-2 rounded-xl border border-[#2f66ff]/40 bg-[#1d2f6f] px-3 text-sm font-medium leading-none text-white shadow-[0_8px_20px_-14px_rgba(0,0,0,0.7)]"
                >
                  <ActiveIcon className={cn("h-4 w-4", tabIconClassByTitle[selectedTab])} />
                  {selectedTab}
                </button>
              );
            })()}
          </div>
        </div>
        <div className="flex h-10 shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => setTopNavMenuOpen((prev) => !prev)}
            data-onboarding-nav-toggle="main"
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-[#171a20] text-white shadow-[0_8px_20px_-14px_rgba(0,0,0,0.7)] transition hover:bg-[#1e232b]"
            aria-label="Navigation ein-/ausklappen"
            aria-expanded={topNavMenuOpen}
          >
            <ChevronDown className={cn("h-4 w-4 transition-transform duration-300 md:hidden", topNavMenuOpen ? "rotate-180" : "rotate-0")} />
            <ChevronsRight className={cn("hidden h-4 w-4 transition-transform duration-300 md:block", topNavMenuOpen ? "rotate-180" : "rotate-0")} />
          </button>
          <button
            type="button"
            onClick={() => setSelectedTab("Abo & Tokens")}
            data-onboarding-nav="billing"
            className="relative inline-flex h-10 items-center gap-1.5 rounded-xl border border-white/10 bg-[#171a20] px-3 text-sm font-medium leading-none text-white shadow-[0_8px_20px_-14px_rgba(0,0,0,0.7)] transition hover:bg-[#1e232b]"
          >
            <Gem className="h-3.5 w-3.5" />
            Pakete
          </button>
          <div className="relative" ref={bellMenuRef}>
            <button
              type="button"
              onClick={() => {
                setBellMenuOpen((prev) => !prev);
                setProfileMenuOpen(false);
              }}
              className="relative inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-[#171a20] leading-none text-white shadow-[0_8px_20px_-14px_rgba(0,0,0,0.7)] transition hover:bg-[#1e232b]"
              aria-label="Benachrichtigungen"
              aria-expanded={bellMenuOpen}
              aria-haspopup="menu"
            >
              <Bell className="h-4 w-4" />
              {bellUnreadCount > 0 ? (
                <span className="absolute -right-1 -top-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[#c8ff26] px-1 text-[10px] font-bold text-black">
                  {bellUnreadCount}
                </span>
              ) : null}
            </button>
            {bellMenuOpen ? (
              <div className="absolute right-0 top-[calc(100%+0.5rem)] z-50 w-80 overflow-hidden rounded-2xl border border-white/10 bg-[#12151b] text-white shadow-[0_24px_40px_-24px_rgba(0,0,0,0.9)]">
                <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
                  <p className="text-sm font-semibold">Updates</p>
                  <button
                    type="button"
                    onClick={() => setBellReadIds(bellNotifications.map((item) => item.id))}
                    className="text-xs font-medium text-zinc-300 transition hover:text-white"
                  >
                    Alle gelesen
                  </button>
                </div>
                <div className="max-h-80 overflow-auto p-2">
                  {bellNotifications.length === 0 ? (
                    <p className="rounded-lg bg-white/5 px-3 py-2 text-xs text-zinc-300">Keine neuen Updates.</p>
                  ) : (
                    bellNotifications.map((item) => (
                      <div key={item.id} className="mb-2 rounded-xl border border-white/10 bg-white/5 p-3 last:mb-0">
                        <div className="mb-1 flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-white">{item.title}</p>
                          {!bellReadIds.includes(item.id) ? (
                            <span
                              className={cn(
                                "inline-flex h-2.5 w-2.5 rounded-full",
                                item.tone === "warning"
                                  ? "bg-amber-300"
                                  : item.tone === "success"
                                    ? "bg-emerald-300"
                                    : item.tone === "info"
                                      ? "bg-sky-300"
                                      : "bg-zinc-300",
                              )}
                            />
                          ) : null}
                        </div>
                        <p className="text-xs text-zinc-300">{item.description}</p>
                        <button
                          type="button"
                          onClick={() => {
                            item.onAction();
                            setBellReadIds((prev) => (prev.includes(item.id) ? prev : [...prev, item.id]));
                            setBellMenuOpen(false);
                          }}
                          className="mt-2 inline-flex h-7 items-center rounded-md border border-white/15 bg-white/5 px-2.5 text-xs font-medium text-white transition hover:bg-white/10"
                        >
                          {item.actionLabel}
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ) : null}
          </div>
          <button
            ref={profileButtonRef}
            type="button"
            onClick={() => setProfileMenuOpen((prev) => !prev)}
            className="relative inline-flex h-10 w-10 items-center justify-center rounded-full p-[2px] leading-none transition hover:scale-[1.02]"
            style={{
              background: `conic-gradient(#c8ff26 0% ${creditFillPercent}%, rgba(255,255,255,0.16) ${creditFillPercent}% 100%)`,
              boxShadow:
                creditFillPercent > 0
                  ? "0 0 0 1px rgba(192,255,0,0.75), 0 0 14px rgba(192,255,0,0.45)"
                  : "0 0 0 1px rgba(255,255,255,0.18)",
            }}
            title="Profil-Menü öffnen"
            aria-expanded={profileMenuOpen}
            aria-haspopup="menu"
          >
            <span className="h-full w-full rounded-full border border-black/40 bg-[#d4ff37]" />
          </button>
        </div>
      </div>
      <div
        className={cn(
          "mb-4 overflow-hidden rounded-xl border border-white/10 bg-[#111827] md:hidden transition-all duration-300",
          topNavMenuOpen ? "max-h-[460px] p-2 opacity-100" : "pointer-events-none max-h-0 p-0 opacity-0 border-transparent",
        )}
      >
        <div className="grid grid-cols-1 gap-2">
          {topTabs.map(({ title, Icon, notifs }) => {
            const isActive = selectedTab === title;
            return (
              <button
                key={`mobile-${title}`}
                type="button"
                data-onboarding-nav={
                  title === "Dashboard"
                    ? "dashboard"
                    : title === "Prompt-Erstellung"
                      ? "prompt"
                      : title === "Bilder Erstellen"
                        ? "content"
                        : title === "Mediathek"
                          ? "library"
                          : title === "Abo & Tokens"
                            ? "billing"
                            : title === "Team"
                              ? "team"
                              : title === "Einstellungen" || title === "Admin Center"
                                ? "settings"
                                : "support"
                }
                onClick={() => {
                  setSelectedTab(title);
                  setTopNavMenuOpen(false);
                }}
                className={cn(
                  "flex h-10 items-center justify-between rounded-lg border px-3 text-left text-sm font-medium transition",
                  isActive
                    ? "border-[#2f66ff]/40 bg-[#1d2f6f] text-white"
                    : "border-white/10 bg-[#171a20] text-zinc-100 hover:bg-[#1e232b]",
                )}
              >
                <span className="inline-flex items-center gap-2">
                  <Icon className={cn("h-4 w-4", tabIconClassByTitle[title])} />
                  {title}
                </span>
                {notifs ? (
                  <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[#2f66ff] px-1.5 text-[10px] font-semibold text-white">
                    {notifs}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>
      <div
        className={cn(
          "mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-start sm:justify-between",
          selectedTab !== "Bilder Erstellen" && selectedTab !== "Abo & Tokens"
            ? ""
            : "justify-end",
        )}
      >
        {selectedTab !== "Bilder Erstellen" && selectedTab !== "Abo & Tokens" ? (
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 sm:text-3xl">{tabTitle}</h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400 sm:text-base">{tabDescriptions[selectedTab]}</p>
          {isAdmin ? (
            <p className="mt-1 inline-flex rounded-full bg-orange-50 px-2 py-0.5 text-xs font-medium text-[#c65a20] dark:bg-orange-900/30 dark:text-orange-300">
              Admin-Modus aktiv
            </p>
          ) : null}
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Angemeldet als {displayName}</p>
          {userEmail ? <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{userEmail}</p> : null}
        </div>
        ) : null}
        <div className="relative" ref={profileMenuRef}>
          {profileMenuOpen ? (
            <div className="fixed right-3 top-[calc(env(safe-area-inset-top)+3.75rem)] z-[130] w-[min(84vw,20rem)] overflow-hidden rounded-2xl border border-white/10 bg-[#12151b] text-white shadow-[0_24px_40px_-24px_rgba(0,0,0,0.9)] sm:right-4 sm:top-[calc(env(safe-area-inset-top)+4.25rem)] sm:w-64">
                <div className="border-b border-white/5 px-4 py-3">
                  <p className="truncate text-sm font-semibold text-white">{displayName}</p>
                  <p className="text-xs text-zinc-400">
                    {hasActiveBilling ? activePlanLabel : "Kein aktives Abo"}
                  </p>
                </div>
                <div className="border-b border-white/5 px-4 py-3">
                  <div className="mb-2 flex items-center justify-between text-sm font-semibold text-white">
                    <span>{availableTokensDisplay.toLocaleString("de-DE")} Tokens verfügbar</span>
                    <ChevronDown className="-rotate-90 h-3.5 w-3.5 text-zinc-500" />
                  </div>
                  <div className="h-2 rounded-full bg-white/10">
                    <div className="h-full rounded-full bg-[#c8ff26] transition-[width] duration-300" style={{ width: `${creditFillPercent}%` }} />
                  </div>
                </div>
                <div className="px-3 py-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedTab("Abo & Tokens");
                      setProfileMenuOpen(false);
                    }}
                    className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2 transition hover:bg-white/10"
                  >
                    <span className="inline-flex items-center gap-2 text-sm font-semibold text-white">
                      <Crown className="h-4 w-4 text-[#c8ff26]" />
                      {hasActiveBilling ? "Plan verwalten" : "Premium aktivieren"}
                    </span>
                    <span className="rounded-full bg-[#c8ff26] px-2 py-1 text-xs font-semibold text-black">
                      {hasActiveBilling ? "Aktiv" : "Upgraden"}
                    </span>
                  </button>
                </div>
                <div className="px-2 pb-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedTab("Einstellungen");
                      setProfileMenuOpen(false);
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm font-medium text-zinc-100 transition hover:bg-white/10"
                  >
                    <User className="h-4 w-4 text-zinc-300" />
                    Profil ansehen
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedTab("Einstellungen");
                      setProfileMenuOpen(false);
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm font-medium text-zinc-100 transition hover:bg-white/10"
                  >
                    <Settings className="h-4 w-4 text-zinc-300" />
                    Konto verwalten
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setProfileMenuOpen(false);
                      handleRestartOnboardingGlobal();
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm font-medium text-zinc-100 transition hover:bg-white/10"
                  >
                    <RotateCcw className="h-4 w-4 text-zinc-300" />
                    Onboarding neu starten
                  </button>
                  <div className="my-1 border-t border-white/10" />
                  <button
                    type="button"
                    onClick={async () => {
                      setProfileMenuOpen(false);
                      try {
                        const res = await fetch("/auth/signout", {
                          method: "POST",
                          credentials: "include",
                        });
                        window.location.href = res.redirected && res.url ? res.url : "/";
                      } catch {
                        window.location.href = "/";
                      }
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm font-semibold text-white transition hover:bg-white/10"
                  >
                    <LogOut className="h-4 w-4 text-zinc-300" />
                    Abmelden
                  </button>
                </div>
            </div>
          ) : null}
        </div>
      </div>

      {renderTabPanel()}
      <FloatingChatWidget
        isOpen={assistantOpen}
        onToggle={() => setAssistantOpen((prev) => !prev)}
        selectedAgent={assistantAgentId}
        agents={DEFAULT_HOPFEN_AGENTS}
        messages={assistantMessages}
        inputValue={assistantInput}
        onInputChange={setAssistantInput}
        onSubmit={() => {
          void submitAssistantMessage();
        }}
        loading={assistantLoading}
        onboardingAttr="hopfen-hugo"
      />
      <nav
        className="fixed inset-x-3 bottom-[max(0.6rem,env(safe-area-inset-bottom))] z-[95] rounded-2xl border border-white/10 bg-[#10141d]/95 px-2 pb-2 pt-1 shadow-[0_20px_44px_-24px_rgba(0,0,0,0.9)] backdrop-blur md:hidden"
        aria-label="Mobile Dashboard Navigation"
      >
        <div className="grid grid-cols-4 items-end gap-1 pt-8">
          <button
            type="button"
            onClick={() => {
              setSelectedTab("Dashboard");
              setTopNavMenuOpen(false);
              setProfileMenuOpen(false);
            }}
            className={cn(
              "inline-flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl px-2 text-[11px] font-medium transition",
              selectedTab === "Dashboard" ? "bg-white/10 text-white" : "text-zinc-400 hover:text-zinc-200",
            )}
          >
            <Home className="h-4 w-4" />
            Dashboard
          </button>
          <button
            type="button"
            onClick={() => {
              setSelectedTab("Bilder Erstellen");
              setTopNavMenuOpen(false);
              setProfileMenuOpen(false);
            }}
            className="inline-flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl px-2 text-[11px] font-medium text-zinc-300 transition hover:text-zinc-100"
          >
            <Wand2 className="h-4 w-4" />
            Generieren
          </button>
          <button
            type="button"
            onClick={() => {
              setSelectedTab("Mediathek");
              setTopNavMenuOpen(false);
              setProfileMenuOpen(false);
            }}
            className={cn(
              "inline-flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl px-2 text-[11px] font-medium transition",
              selectedTab === "Mediathek" ? "bg-white/10 text-white" : "text-zinc-400 hover:text-zinc-200",
            )}
          >
            <Image className="h-4 w-4" />
            Mediathek
          </button>
          <button
            type="button"
            onClick={() => {
              setProfileMenuOpen((prev) => !prev);
              setTopNavMenuOpen(false);
            }}
            className={cn(
              "inline-flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl px-2 text-[11px] font-medium transition",
              profileMenuOpen ? "bg-white/10 text-white" : "text-zinc-400 hover:text-zinc-200",
            )}
          >
            <User className="h-4 w-4" />
            Profil
          </button>
        </div>
        <button
          type="button"
          onClick={() => {
            setSelectedTab("Bilder Erstellen");
            setTopNavMenuOpen(false);
            setProfileMenuOpen(false);
          }}
          className="pointer-events-auto absolute left-1/2 top-0 inline-flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-2xl bg-[#c8ff26] text-black shadow-[0_12px_30px_-16px_rgba(200,255,38,0.9)] transition hover:scale-[1.03]"
          aria-label="Direkt zu Bilder Erstellen"
        >
          <Sparkles className="h-5 w-5" />
        </button>
      </nav>
    </div>
  );
};

export default Example;
