"use client";

import RuixenMoonChat from "@/components/ui/ruixen-moon-chat";

/** Moon-Chat füllt nur den Content unter der Kopfzeile — Header bleibt normal.
 *  Full-Bleed steuert die Shell per Pathname (`/inhalte-erstellen`), kein useEffect-Delay.
 */
export function InhalteErstellenMoonChatPage() {
  return (
    <div className="absolute inset-0 flex min-h-0 w-full flex-col">
      <RuixenMoonChat />
    </div>
  );
}
