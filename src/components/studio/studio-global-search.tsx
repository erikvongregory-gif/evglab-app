"use client";

import { useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { getMediaDisplayTitle } from "@/lib/dashboard/metadata";

type MediaHit = {
  id: string;
  imageUrl: string;
  title?: string;
  prompt: string;
  aspectRatio: string;
  resolution: string;
};

type QuickLink = {
  id: string;
  label: string;
  href: string;
  hint?: string;
  keywords: string;
};

const QUICK_LINKS: QuickLink[] = [
  { id: "dashboard", label: "Dashboard", href: "/dashboard", hint: "Übersicht", keywords: "dashboard home start" },
  { id: "create", label: "Bilder Erstellen", href: "/inhalte-erstellen", hint: "KI-Bilder", keywords: "bilder generieren create inhalte" },
  { id: "videos", label: "Videos Erstellen", href: "/videos-erstellen", hint: "Demnächst", keywords: "video reels story ugc tiktok" },
  { id: "media", label: "Mediathek", href: "/dashboard?tab=media", hint: "Alle Motive", keywords: "mediathek medien gallery bilder" },
  { id: "brand", label: "Markenprofil", href: "/dashboard?tab=brand", hint: "Marke & Stil", keywords: "marke brand profil" },
  { id: "team", label: "Team", href: "/dashboard?tab=team", hint: "Einladungen", keywords: "team mitglieder" },
  { id: "settings", label: "Einstellungen", href: "/dashboard?tab=settings", hint: "Profil", keywords: "einstellungen settings konto" },
  { id: "pricing", label: "Abonnement", href: "/dashboard?tab=pricing", hint: "Tarif & Tokens", keywords: "abo pricing tokens tarif" },
];

type StudioSearchContextValue = {
  query: string;
  setQuery: (value: string) => void;
  open: boolean;
  setOpen: (value: boolean) => void;
  openSearch: () => void;
  close: () => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
  isMac: boolean;
  quickResults: QuickLink[];
  mediaResults: MediaHit[];
  navigate: (href: string) => void;
  normalizedQuery: string;
};

const StudioSearchContext = createContext<StudioSearchContextValue | null>(null);

function useStudioSearch(): StudioSearchContextValue {
  const ctx = useContext(StudioSearchContext);
  if (!ctx) throw new Error("StudioSearchProvider fehlt.");
  return ctx;
}

function normalizeQuery(value: string): string {
  return value.trim().toLowerCase();
}

function matchesQuery(text: string, query: string): boolean {
  if (!query) return true;
  return text.toLowerCase().includes(query);
}

export function StudioSearchProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [media, setMedia] = useState<MediaHit[]>([]);
  const [mediaLoaded, setMediaLoaded] = useState(false);
  const [isMac, setIsMac] = useState(false);

  const normalizedQuery = normalizeQuery(query);

  useEffect(() => {
    setIsMac(/Mac|iPhone|iPad/i.test(navigator.platform));
  }, []);

  useEffect(() => {
    if (!open || mediaLoaded) return;
    let ignore = false;
    void (async () => {
      try {
        const res = await fetch("/api/dashboard/media", { cache: "no-store", credentials: "include" });
        if (!res.ok) return;
        const json = (await res.json()) as { items?: MediaHit[] };
        if (!ignore && Array.isArray(json.items)) setMedia(json.items);
      } catch {
        /* ignore */
      } finally {
        if (!ignore) setMediaLoaded(true);
      }
    })();
    return () => {
      ignore = true;
    };
  }, [open, mediaLoaded]);

  const close = useCallback(() => setOpen(false), []);

  const openSearch = useCallback(() => {
    setOpen(true);
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }, []);

  const navigate = useCallback(
    (href: string) => {
      close();
      setQuery("");
      router.push(href);
    },
    [close, router],
  );

  const quickResults = useMemo(
    () =>
      QUICK_LINKS.filter(
        (item) =>
          matchesQuery(item.label, normalizedQuery) ||
          matchesQuery(item.hint ?? "", normalizedQuery) ||
          matchesQuery(item.keywords, normalizedQuery),
      ),
    [normalizedQuery],
  );

  const mediaResults = useMemo(
    () =>
      media.filter(
        (item) =>
          matchesQuery(getMediaDisplayTitle(item), normalizedQuery) ||
          matchesQuery(item.prompt, normalizedQuery) ||
          matchesQuery(item.aspectRatio, normalizedQuery) ||
          matchesQuery(item.resolution, normalizedQuery),
      ),
    [media, normalizedQuery],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const mod = isMac ? event.metaKey : event.ctrlKey;
      if (mod && event.key.toLowerCase() === "k") {
        event.preventDefault();
        openSearch();
        return;
      }
      if (event.key === "Escape") close();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [close, isMac, openSearch]);

  const value: StudioSearchContextValue = {
    query,
    setQuery,
    open,
    setOpen,
    openSearch,
    close,
    inputRef,
    isMac,
    quickResults,
    mediaResults,
    navigate,
    normalizedQuery,
  };

  return <StudioSearchContext.Provider value={value}>{children}</StudioSearchContext.Provider>;
}

function useMobileSearchViewport(): boolean {
  const [mobile, setMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1023px)");
    const update = () => setMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  return mobile;
}

function StudioSearchDropdown({ mobile = false }: { mobile?: boolean }) {
  const { open, query, normalizedQuery, quickResults, mediaResults, navigate } = useStudioSearch();
  if (!open) return null;

  const showEmpty = normalizedQuery.length > 0 && quickResults.length === 0 && mediaResults.length === 0;

  return (
    <div
      id="studio-global-search-results"
      className={mobile ? "evg-shell-search-dropdown evg-shell-search-dropdown--mobile" : "evg-shell-search-dropdown"}
      role="listbox"
    >
      {quickResults.length > 0 ? (
        <div className="evg-shell-search-section">
          <div className="evg-shell-search-section-label">Bereiche</div>
          {quickResults.map((item) => (
            <button key={item.id} type="button" className="evg-shell-search-item" onClick={() => navigate(item.href)}>
              <span>{item.label}</span>
              {item.hint ? <span className="evg-shell-search-item-hint">{item.hint}</span> : null}
            </button>
          ))}
        </div>
      ) : null}

      {mediaResults.length > 0 ? (
        <div className="evg-shell-search-section">
          <div className="evg-shell-search-section-label">Mediathek</div>
          {mediaResults.slice(0, 6).map((item) => (
            <button
              key={item.id}
              type="button"
              className="evg-shell-search-item evg-shell-search-item--media"
              onClick={() => navigate(`/dashboard?tab=media&q=${encodeURIComponent(getMediaDisplayTitle(item).slice(0, 80))}`)}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={item.imageUrl} alt="" className="evg-shell-search-thumb" />
              <span className="evg-shell-search-media-copy">
                <span className="evg-shell-search-media-prompt">{getMediaDisplayTitle(item)}</span>
                <span className="evg-shell-search-item-hint">
                  {item.resolution} · {item.aspectRatio}
                </span>
              </span>
            </button>
          ))}
        </div>
      ) : null}

      {showEmpty ? <div className="evg-shell-search-empty">Keine Treffer für „{query.trim()}“.</div> : null}

      {!normalizedQuery && quickResults.length === QUICK_LINKS.length ? (
        <div className="evg-shell-search-empty">Tippe, um Bereiche und Motive zu filtern.</div>
      ) : null}
    </div>
  );
}

function StudioSearchField() {
  const { query, setQuery, setOpen, openSearch, inputRef, isMac, open } = useStudioSearch();

  return (
    <div className="evg-shell-topbar-search-field">
      <span className="evg-shell-topbar-search-icon" aria-hidden="true">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="7" cy="7" r="4.5" />
          <path d="M10.5 10.5 L13 13" strokeLinecap="round" />
        </svg>
      </span>
      <input
        ref={inputRef}
        className="studio-field evg-shell-topbar-search-input"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder="Suche · Posts, Bilder, Kampagnen …"
        aria-label="Suche"
        aria-expanded={open}
        aria-controls="studio-global-search-results"
        role="combobox"
        autoComplete="off"
      />
      <span className="evg-shell-topbar-search-kbd studio-mono" aria-hidden="true">
        {isMac ? "⌘K" : "Ctrl+K"}
      </span>
    </div>
  );
}

export function StudioTopbarSearchDesktop() {
  const rootRef = useRef<HTMLDivElement>(null);
  const { close, open } = useStudioSearch();

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) close();
    };
    window.addEventListener("mousedown", onPointerDown);
    return () => window.removeEventListener("mousedown", onPointerDown);
  }, [close, open]);

  return (
    <div ref={rootRef} data-tour="search" className="evg-shell-topbar-search evg-shell-topbar-search--desktop">
      <StudioSearchField />
      <StudioSearchDropdown />
    </div>
  );
}

export function StudioTopbarSearchMobile() {
  const isMobileViewport = useMobileSearchViewport();
  const { open, openSearch, close } = useStudioSearch();

  if (!isMobileViewport) return null;

  return (
    <>
      <button type="button" className="evg-shell-topbar-search-trigger" aria-label="Suche öffnen" onClick={openSearch}>
        <svg width="17" height="17" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
          <circle cx="7" cy="7" r="4.5" />
          <path d="M10.5 10.5 L13 13" strokeLinecap="round" />
        </svg>
      </button>
      {open ? (
        <div className="evg-shell-search-mobile-panel" onClick={close} role="presentation">
          <div className="evg-shell-search-mobile-panel-inner" onClick={(e) => e.stopPropagation()}>
            <StudioSearchField />
            <StudioSearchDropdown mobile />
          </div>
        </div>
      ) : null}
    </>
  );
}
