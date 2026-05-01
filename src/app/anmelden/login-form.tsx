"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface LoginFormProps {
  nextPath?: string;
  urlError?: string;
}

export function LoginForm({ nextPath = "/dashboard", urlError }: LoginFormProps) {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(
    urlError === "auth"
      ? "Anmeldung fehlgeschlagen. Bitte erneut versuchen."
      : urlError === "config"
        ? "Supabase ist auf diesem Deployment noch nicht konfiguriert."
      : urlError === "invite_required"
        ? "Registrierung ist nur mit Einladung möglich."
        : null,
  );
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const supabase = createClient();
      const { error: signError } = await supabase.auth.signInWithPassword({ email, password });
      if (signError) {
        setError(signError.message);
        setLoading(false);
        return;
      }
      router.push(nextPath.startsWith("/") ? nextPath : "/dashboard");
      router.refresh();
    } catch {
      setError("Unerwarteter Fehler. Bitte spaeter erneut versuchen.");
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-sm rounded-xl border bg-background p-6 shadow-lg shadow-black/5">
      <div className="mb-6 flex flex-col items-center gap-2">
        <div
          className="flex size-11 shrink-0 items-center justify-center rounded-full border border-border"
          aria-hidden="true"
        >
          <svg
            className="stroke-zinc-800 dark:stroke-zinc-100"
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 32 32"
            aria-hidden="true"
          >
            <circle cx="16" cy="16" r="12" fill="none" strokeWidth="8" />
          </svg>
        </div>
        <h1 className="text-lg font-semibold tracking-tight">Willkommen zurück</h1>
        <p className="text-center text-sm text-muted-foreground">
          Melde dich mit deinen Zugangsdaten an.
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-5">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="login-email">Email</Label>
            <Input
              id="login-email"
              placeholder="hi@yourcompany.com"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="login-password">Password</Label>
            <Input
              id="login-password"
              placeholder="Enter your password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
        </div>

        <div className="flex justify-between gap-2">
          <div className="flex items-center gap-2">
            <input
              id="remember-me"
              type="checkbox"
              className="size-4 rounded border border-input accent-[#c65a20]"
            />
            <Label htmlFor="remember-me" className="font-normal text-muted-foreground">
              Remember me
            </Label>
          </div>
          <a className="text-sm underline hover:no-underline" href="#">
            Forgot password?
          </a>
        </div>

        {error ? (
          <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
            {error}
          </p>
        ) : null}

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Wird angemeldet ..." : "Anmelden"}
        </Button>
      </form>

      <p className="mt-5 text-center text-sm text-muted-foreground">
        Noch kein Konto? Du brauchst eine Einladung.
      </p>
    </div>
  );
}
