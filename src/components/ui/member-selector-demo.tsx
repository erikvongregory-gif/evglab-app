"use client";

import * as React from "react";
import { MemberSelector, type Member } from "@/components/ui/member-selector";

/** Demo / Story — Unsplash portraits for local preview */
function portrait(id: string) {
  return `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=128&h=128&q=80`;
}

export const members: Member[] = [
  {
    id: "1",
    name: "Thomas Braumeister",
    email: "Braumeister",
    avatar: portrait("1507003211169-0a1dd7228f2d"),
  },
  {
    id: "2",
    name: "Anna Kellerin",
    email: "Service",
    avatar: portrait("1494790108377-be9c29b29330"),
  },
  {
    id: "3",
    name: "Markus Gast",
    email: "Stammgast",
    avatar: portrait("1472099645785-5658abf4ff4e"),
  },
  {
    id: "4",
    name: "Sofia Hopfen",
    email: "Marketing",
    avatar: portrait("1438761681033-6461ffad8d80"),
  },
  {
    id: "5",
    name: "Jonas Malz",
    email: "Brauer",
    avatar: portrait("1500648767791-00dcc994a43e"),
  },
];

export function MemberSelectorDemo() {
  const [selected, setSelected] = React.useState<string[]>(["1", "2"]);

  return (
    <MemberSelector
      members={members}
      selected={selected}
      onChange={setSelected}
      maxVisible={5}
      label="Charakterauswahl"
      addLabel="Wählen"
      searchPlaceholder="Charakter suchen…"
      emptyLabel="Kein Charakter gefunden"
    />
  );
}

export default MemberSelectorDemo;
