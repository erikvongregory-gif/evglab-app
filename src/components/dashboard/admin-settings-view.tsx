"use client";

import { useState } from "react";

import { brandLockLabel, formatDomain } from "@/lib/brand/brand-profile-display";
import { signOutAndRedirect } from "@/lib/auth/signOutClient";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export type AdminSettingsPayload = {
  profileName: string;
  profilePhone: string;
  breweryName: string;
  emailNotifications: boolean;
  weeklySummary: boolean;
  brandProfileMode: "undecided" | "guided" | "skip";
  brandWebsiteUrl: string;
  brandLockLevel: "strict" | "balanced" | "loose";
};

export function AdminSettingsView({
  value,
  onChange,
  loaded,
  loadError,
  brandProfileComplete,
  brandProfileNotice,
  onOpenBrandTab,
  onOpenBrandSetup,
  onSkipBrandProfile,
  onResetBrandProfile,
}: {
  value: AdminSettingsPayload | null;
  onChange: (v: AdminSettingsPayload) => void;
  loaded: boolean;
  loadError: string | null;
  brandProfileComplete: boolean;
  brandProfileNotice: string;
  onOpenBrandTab: () => void;
  onOpenBrandSetup: () => void;
  onSkipBrandProfile: () => void;
  onResetBrandProfile: () => void | Promise<void>;
}) {
  const [saving, setSaving] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const draft = value;

  const setField = <K extends keyof AdminSettingsPayload>(key: K, next: AdminSettingsPayload[K]) => {
    if (!draft) return;
    onChange({ ...draft, [key]: next });
  };

  const save = async () => {
    if (!draft) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/dashboard/settings", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify(draft),
      });
      const json = (await res.json().catch(() => null)) as
        | { ok?: boolean; error?: string; settings?: AdminSettingsPayload }
        | null;
      if (!res.ok) {
        setError(json?.error || "Einstellungen konnten nicht gespeichert werden.");
        return;
      }
      if (json?.settings) onChange(json.settings);
      const savedSettings = json?.settings ?? draft;
      window.dispatchEvent(
        new CustomEvent("evglab-profile-updated", {
          detail: {
            breweryName: savedSettings.breweryName ?? "",
            profileName: savedSettings.profileName ?? "",
          },
        }),
      );
      setNotice("Gespeichert.");
    } catch {
      setError("Einstellungen konnten nicht gespeichert werden.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="@container/main flex flex-col gap-4 md:gap-6">
      <div className="space-y-1">
        <h1 className="text-3xl leading-none tracking-tight">Einstellungen</h1>
        <p className="text-muted-foreground text-sm">
          Diese Angaben erscheinen in der Begrüßung und in Dashboard-Überschriften.
        </p>
      </div>

      {!draft ? (
        <Card>
          <CardContent className="pt-6 text-sm text-muted-foreground">
            {!loaded ? (
              "Lade Einstellungen…"
            ) : loadError ? (
              <span className="text-destructive">
                {loadError}{" "}
                <button type="button" className="underline" onClick={() => window.location.reload()}>
                  Erneut versuchen
                </button>
              </span>
            ) : (
              "Keine Einstellungen verfügbar."
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-4">
              <div className="space-y-1">
                <CardTitle>Markenprofil</CardTitle>
                <CardDescription>
                  {brandProfileComplete && draft.brandProfileMode !== "skip"
                    ? `${draft.brandWebsiteUrl ? formatDomain(draft.brandWebsiteUrl) : draft.breweryName || "Marke"} · Brand-Lock „${brandLockLabel(draft.brandLockLevel)}“`
                    : draft.brandProfileMode === "skip"
                      ? "Du nutzt BrewAI ohne Markenprofil."
                      : "Website-Link eingeben, KI wertet Stil und Vorgaben aus."}
                  {brandProfileNotice ? ` · ${brandProfileNotice}` : ""}
                </CardDescription>
              </div>
              <div className="flex flex-wrap gap-2">
                {brandProfileComplete && draft.brandProfileMode !== "skip" ? (
                  <>
                    <Button variant="outline" size="sm" onClick={onOpenBrandTab}>
                      Profil verwalten
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setResetConfirmOpen(true)}>
                      Generisch nutzen
                    </Button>
                  </>
                ) : (
                  <>
                    <Button size="sm" onClick={onOpenBrandSetup}>
                      Markenprofil erstellen
                    </Button>
                    {draft.brandProfileMode !== "skip" ? (
                      <Button variant="ghost" size="sm" onClick={onSkipBrandProfile}>
                        Ohne Markenprofil nutzen
                      </Button>
                    ) : null}
                  </>
                )}
              </div>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Profil</CardTitle>
              <CardDescription>Name und Marke für Begrüßung und Sidebar</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="settings-profile-name">Dein Name</Label>
                <Input
                  id="settings-profile-name"
                  value={draft.profileName}
                  onChange={(e) => setField("profileName", e.target.value)}
                  placeholder="z. B. Team"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="settings-profile-phone">Telefon</Label>
                <Input
                  id="settings-profile-phone"
                  value={draft.profilePhone}
                  onChange={(e) => setField("profilePhone", e.target.value)}
                />
              </div>
              <div className="grid gap-2 sm:col-span-2">
                <Label htmlFor="settings-brewery-name">Marke</Label>
                <Input
                  id="settings-brewery-name"
                  value={draft.breweryName}
                  onChange={(e) => setField("breweryName", e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Benachrichtigungen</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <p className="text-sm font-medium">E-Mail-Benachrichtigungen</p>
                  <p className="text-muted-foreground text-xs">Status zu Generierungen, Einladungen und Sicherheit.</p>
                </div>
                <Switch
                  checked={draft.emailNotifications}
                  onCheckedChange={(v) => setField("emailNotifications", v)}
                />
              </div>
              <div className="flex items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <p className="text-sm font-medium">Wochenzusammenfassung</p>
                  <p className="text-muted-foreground text-xs">Jeden Montag eine kurze E-Mail mit Highlights.</p>
                </div>
                <Switch checked={draft.weeklySummary} onCheckedChange={(v) => setField("weeklySummary", v)} />
              </div>
            </CardContent>
          </Card>

          <div className="flex flex-wrap items-center gap-3">
            <Button disabled={saving} onClick={() => void save()}>
              {saving ? "Speichert…" : "Speichern"}
            </Button>
            {notice ? <Badge variant="secondary">{notice}</Badge> : null}
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </div>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <div className="space-y-1">
                <CardTitle>Konto</CardTitle>
                <CardDescription>Sitzung auf diesem Gerät beenden</CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                disabled={signingOut}
                onClick={() => {
                  setSigningOut(true);
                  void signOutAndRedirect();
                }}
              >
                {signingOut ? "Abmelden …" : "Abmelden"}
              </Button>
            </CardHeader>
          </Card>

          <AlertDialog open={resetConfirmOpen} onOpenChange={setResetConfirmOpen}>
            <AlertDialogContent size="default">
              <AlertDialogHeader>
                <AlertDialogTitle>Markenprofil löschen?</AlertDialogTitle>
                <AlertDialogDescription>
                  Gespeicherte Stil-Vorgaben werden entfernt. Danach generierst du ohne festes Markenprofil.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                <AlertDialogAction variant="destructive" onClick={() => void onResetBrandProfile()}>
                  Profil löschen
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      )}
    </div>
  );
}
