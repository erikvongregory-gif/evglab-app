import Link from "next/link";

import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function SupportCard() {
  return (
    <Card size="sm" className="overflow-hidden shadow-none group-data-[collapsible=icon]:hidden">
      <CardHeader className="min-w-0 px-4">
        <CardTitle className="truncate text-sm">BrewAI Studio</CardTitle>
        <CardDescription className="line-clamp-3">
          Motive erzeugen, Marke steuern und Ergebnisse in der Mediathek verwalten.{" "}
          <Link href="/inhalte-erstellen" className="text-foreground hover:underline">
            Jetzt erstellen
          </Link>
          .
        </CardDescription>
      </CardHeader>
    </Card>
  );
}
