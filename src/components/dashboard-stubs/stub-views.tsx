"use client";

import { Badge } from "@/components/ui/badge";
import { Chat } from "@/components/dashboard-stubs/chat/chat";
import { conversations } from "@/components/dashboard-stubs/chat/data";
import { MailComponent } from "@/components/dashboard-stubs/mail/mail";
import { mails } from "@/components/dashboard-stubs/mail/data";
import { DEFAULT_MAIL_LAYOUT } from "@/components/dashboard-stubs/mail/mail-layout-config";
import { Roles } from "@/components/dashboard-stubs/roles/roles";
import { roles } from "@/components/dashboard-stubs/roles/roles-table/data";
import ProfilePage from "@/components/dashboard-stubs/profile/page";

function StubBanner({ title, note }: { title: string; note: string }) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-border bg-muted/40 px-3 py-2 text-sm">
      <Badge variant="secondary">Vorbereitung</Badge>
      <span className="font-medium">{title}</span>
      <span className="text-muted-foreground">{note}</span>
    </div>
  );
}

export function ChatStubView() {
  return (
    <div data-content-padding="false" className="-m-4 md:-m-6">
      <div className="px-4 pt-4 md:px-6">
        <StubBanner title="Chat" note="UI aus dem Template — Anbindung an BrewAI folgt später." />
      </div>
      <Chat conversations={conversations} />
    </div>
  );
}

export function MailStubView() {
  return (
    <div data-content-padding="false" className="-m-4 h-[min(78dvh,820px)] overflow-hidden md:-m-6">
      <div className="px-4 pt-4 md:px-6">
        <StubBanner title="E-Mail" note="Demo-Postfach ohne produktive Anbindung." />
      </div>
      <MailComponent mails={mails} defaultLayout={[...DEFAULT_MAIL_LAYOUT]} />
    </div>
  );
}

export function RolesStubView() {
  return (
    <div className="@container/main flex flex-col gap-4">
      <StubBanner title="Rollen" note="Rollenmodell vorbereitet — noch nicht mit BrewAI-Rechten verbunden." />
      <Roles roles={roles} />
    </div>
  );
}

export function ProfileStubView() {
  return (
    <div className="@container/main flex flex-col gap-4">
      <StubBanner title="Profil" note="Template-Profil als Vorschau — Session-Daten folgen in einem späteren Schritt." />
      <ProfilePage />
    </div>
  );
}
