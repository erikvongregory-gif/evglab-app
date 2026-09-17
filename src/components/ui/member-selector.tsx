"use client";

import * as React from "react";
import { motion, AnimatePresence, LayoutGroup } from "framer-motion";
import { Plus, Search, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface Member {
  id: string;
  name: string;
  email?: string;
  avatar?: string;
}

export interface MemberSelectorProps {
  members: Member[];
  selected: string[];
  onChange: (selected: string[]) => void;
  max?: number;
  maxVisible?: number;
  label?: string;
  className?: string;
  /** Optional: customize the add-button label (default "Add") */
  addLabel?: string;
  searchPlaceholder?: string;
  emptyLabel?: string;
  /** When set, + opens create flow instead of the pick-dropdown */
  onAddClick?: () => void;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

interface AvatarProps {
  member: Member;
  isSelected: boolean;
  onClick: () => void;
}

function Avatar({ member, isSelected, onClick }: AvatarProps) {
  return (
    <motion.button
      type="button"
      layoutId={`member-${member.id}`}
      onClick={onClick}
      className="group relative flex cursor-pointer flex-col items-center gap-1.5 outline-none"
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
    >
      <div
        className={cn(
          "relative h-12 w-12 overflow-hidden rounded-full transition-all duration-200",
          "group-focus-visible:ring-2 group-focus-visible:ring-ring group-focus-visible:ring-offset-2",
          !isSelected && "opacity-50 hover:opacity-75",
        )}
      >
        {member.avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={member.avatar}
            alt={member.name}
            className={cn(
              "h-full w-full object-cover transition-all duration-200",
              !isSelected && "grayscale",
            )}
          />
        ) : (
          <div
            className={cn(
              "flex h-full w-full items-center justify-center text-sm font-medium transition-colors duration-200",
              isSelected ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
            )}
          >
            {getInitials(member.name)}
          </div>
        )}
      </div>

      <AnimatePresence>
        {!isSelected && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 500, damping: 30 }}
            className="absolute right-0 bottom-5 flex h-4 w-4 items-center justify-center rounded-full bg-foreground shadow-sm dark:bg-white"
          >
            <Plus className="h-2.5 w-2.5 text-background dark:text-black" strokeWidth={2.5} />
          </motion.div>
        )}
      </AnimatePresence>

      <motion.span
        layoutId={`member-name-${member.id}`}
        className={cn(
          "max-w-[60px] truncate text-xs font-medium transition-colors duration-200",
          isSelected ? "text-foreground" : "text-muted-foreground",
        )}
      >
        {member.name.split(" ")[0]}
      </motion.span>
    </motion.button>
  );
}

interface AddButtonProps {
  onClick: () => void;
  isOpen: boolean;
  label: string;
}

function AddButton({ onClick, isOpen, label }: AddButtonProps) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      className="group flex cursor-pointer flex-col items-center gap-1.5 outline-none"
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
    >
      <div
        className={cn(
          "flex h-12 w-12 items-center justify-center rounded-full border-2 border-dashed transition-all duration-200",
          "group-focus-visible:ring-2 group-focus-visible:ring-ring group-focus-visible:ring-offset-2",
          isOpen
            ? "border-primary bg-primary/10"
            : "border-muted-foreground/40 hover:border-muted-foreground/60 hover:bg-muted/50",
        )}
      >
        <motion.div animate={{ rotate: isOpen ? 45 : 0 }} transition={{ duration: 0.2 }}>
          <Plus
            className={cn(
              "h-5 w-5 transition-colors duration-200",
              isOpen ? "text-primary" : "text-muted-foreground",
            )}
          />
        </motion.div>
      </div>
      <span
        className={cn(
          "text-xs font-medium transition-colors duration-200",
          isOpen ? "text-primary" : "text-muted-foreground",
        )}
      >
        {label}
      </span>
    </motion.button>
  );
}

interface DropdownProps {
  members: Member[];
  selected: string[];
  onSelect: (id: string) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  searchPlaceholder: string;
  emptyLabel: string;
}

function Dropdown({
  members,
  selected,
  onSelect,
  searchQuery,
  onSearchChange,
  searchPlaceholder,
  emptyLabel,
}: DropdownProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const filteredMembers = React.useMemo(() => {
    const query = searchQuery.toLowerCase();
    return members
      .filter(
        (m) =>
          m.name.toLowerCase().includes(query) ||
          m.email?.toLowerCase().includes(query),
      )
      .sort((a, b) => {
        const aSelected = selected.includes(a.id);
        const bSelected = selected.includes(b.id);
        if (aSelected && !bSelected) return -1;
        if (!aSelected && bSelected) return 1;
        return 0;
      });
  }, [members, selected, searchQuery]);

  return (
    <motion.div
      initial={{ opacity: 0, y: -10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.95 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className="absolute top-full right-0 z-50 mt-2 w-72 overflow-hidden rounded-xl border border-border bg-popover shadow-lg"
    >
      <div className="border-b border-border p-3">
        <div className="relative">
          <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            ref={inputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-full rounded-lg border border-transparent bg-muted/50 py-2 pr-3 pl-9 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary/50 focus:bg-background"
          />
        </div>
      </div>

      <div className="max-h-64 overflow-y-auto [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-muted-foreground/20 hover:[&::-webkit-scrollbar-thumb]:bg-muted-foreground/30 [&::-webkit-scrollbar-track]:bg-transparent">
        <AnimatePresence mode="popLayout">
          {filteredMembers.map((member, index) => {
            const isSelected = selected.includes(member.id);
            return (
              <motion.button
                key={member.id}
                type="button"
                layout
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                transition={{ delay: index * 0.02, duration: 0.15 }}
                onClick={() => onSelect(member.id)}
                className={cn(
                  "flex w-full cursor-pointer items-center gap-3 px-3 py-2.5 transition-colors",
                  isSelected ? "bg-primary/5 hover:bg-primary/10" : "hover:bg-muted/50",
                )}
              >
                <div
                  className={cn(
                    "h-9 w-9 flex-shrink-0 overflow-hidden rounded-full transition-all duration-200",
                    !isSelected && "opacity-60 grayscale",
                  )}
                >
                  {member.avatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={member.avatar} alt={member.name} className="h-full w-full object-cover" />
                  ) : (
                    <div
                      className={cn(
                        "flex h-full w-full items-center justify-center text-xs font-medium",
                        isSelected ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
                      )}
                    >
                      {getInitials(member.name)}
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1 text-left">
                  <div
                    className={cn(
                      "truncate text-sm font-medium transition-colors",
                      isSelected ? "text-foreground" : "text-foreground/80",
                    )}
                  >
                    {member.name}
                  </div>
                  {member.email ? (
                    <div className="truncate text-xs text-muted-foreground">{member.email}</div>
                  ) : null}
                </div>

                <div
                  className={cn(
                    "flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full transition-all duration-200",
                    isSelected ? "bg-primary" : "border-2 border-muted-foreground/30",
                  )}
                >
                  {isSelected ? (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", stiffness: 500, damping: 30 }}
                    >
                      <Check className="h-3 w-3 text-primary-foreground" strokeWidth={3} />
                    </motion.div>
                  ) : null}
                </div>
              </motion.button>
            );
          })}
        </AnimatePresence>

        {filteredMembers.length === 0 ? (
          <div className="px-3 py-8 text-center text-sm text-muted-foreground">{emptyLabel}</div>
        ) : null}
      </div>
    </motion.div>
  );
}

const MemberSelector = React.forwardRef<HTMLDivElement, MemberSelectorProps>(
  (
    {
      members,
      selected,
      onChange,
      max,
      maxVisible = 5,
      label,
      className,
      addLabel = "Add",
      searchPlaceholder = "Search members...",
      emptyLabel = "No members found",
      onAddClick,
    },
    ref,
  ) => {
    const [isOpen, setIsOpen] = React.useState(false);
    const [searchQuery, setSearchQuery] = React.useState("");
    const containerRef = React.useRef<HTMLDivElement>(null);
    const useCreateAdd = typeof onAddClick === "function";

    React.useEffect(() => {
      if (useCreateAdd) return;
      function handleClickOutside(event: MouseEvent) {
        if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
          setIsOpen(false);
          setSearchQuery("");
        }
      }

      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [useCreateAdd]);

    const sortedMembers = React.useMemo(() => {
      return [...members].sort((a, b) => {
        const aSelected = selected.includes(a.id);
        const bSelected = selected.includes(b.id);
        if (aSelected && !bSelected) return -1;
        if (!aSelected && bSelected) return 1;
        return 0;
      });
    }, [members, selected]);

    const visibleMembers = sortedMembers.slice(0, maxVisible);

    const toggleMember = (id: string) => {
      const isCurrentlySelected = selected.includes(id);

      if (isCurrentlySelected) {
        onChange(selected.filter((s) => s !== id));
      } else {
        if (max && selected.length >= max) return;
        onChange([...selected, id]);
      }
    };

    return (
      <div ref={ref} className={cn("relative", className)}>
        {label ? (
          <div className="mb-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            {label}
          </div>
        ) : null}
        <div ref={containerRef} className="flex flex-wrap items-start gap-4">
          <LayoutGroup>
            {visibleMembers.map((member) => (
              <Avatar
                key={member.id}
                member={member}
                isSelected={selected.includes(member.id)}
                onClick={() => toggleMember(member.id)}
              />
            ))}

            <div className="relative">
              <AddButton
                isOpen={useCreateAdd ? false : isOpen}
                onClick={() => {
                  if (useCreateAdd) {
                    onAddClick();
                    return;
                  }
                  setIsOpen(!isOpen);
                }}
                label={addLabel}
              />

              <AnimatePresence>
                {!useCreateAdd && isOpen ? (
                  <Dropdown
                    members={members}
                    selected={selected}
                    onSelect={toggleMember}
                    searchQuery={searchQuery}
                    onSearchChange={setSearchQuery}
                    searchPlaceholder={searchPlaceholder}
                    emptyLabel={emptyLabel}
                  />
                ) : null}
              </AnimatePresence>
            </div>
          </LayoutGroup>
        </div>
      </div>
    );
  },
);

MemberSelector.displayName = "MemberSelector";

export { MemberSelector };
