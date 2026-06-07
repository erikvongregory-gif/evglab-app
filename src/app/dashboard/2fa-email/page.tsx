import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { StudioButton, StudioCard } from "@/components/studio/ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: {
    absolute: "EvGlab · Admin-Sicherheitscode",
  },
  robots: {
    index: false,
    follow: false,
    googleBot: { index: false, follow: false },
  },
};

type Props = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function readValue(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v;
}

export default async function DashboardEmail2FAPage({ searchParams }: Props) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const role =
    typeof user?.user_metadata?.role === "string"
      ? String(user.user_metadata.role).toLowerCase()
      : "";
  if (!user || role !== "admin") redirect("/dashboard");

  const params = (await searchParams) ?? {};
  const error = readValue(params.error);
  const notice = readValue(params.notice);

  return (
    <div className="evg-studio" style={{ minHeight: "100vh", background: "var(--bg-0, #131211)", padding: "32px 16px" }}>
      <section style={{ maxWidth: 420, margin: "64px auto 0" }}>
        <StudioCard pad>
          <h1 style={{ fontSize: 22, fontWeight: 600, color: "var(--tx-0)" }}>Admin-Sicherheitscode</h1>
          <p style={{ marginTop: 8, fontSize: 14, color: "var(--tx-2)", lineHeight: 1.5 }}>
            Wir haben dir einen 6-stelligen Code per E-Mail gesendet. Bestätige ihn, um den Admin-Bereich freizuschalten.
          </p>

          {notice === "resent" ? (
            <p
              style={{
                marginTop: 12,
                borderRadius: 8,
                border: "1px solid rgba(34,197,94,0.35)",
                background: "rgba(34,197,94,0.08)",
                padding: "10px 12px",
                fontSize: 14,
                color: "#86efac",
              }}
            >
              Neuer Code wurde gesendet.
            </p>
          ) : null}
          {error ? (
            <p
              style={{
                marginTop: 12,
                borderRadius: 8,
                border: "1px solid rgba(239,68,68,0.35)",
                background: "rgba(239,68,68,0.08)",
                padding: "10px 12px",
                fontSize: 14,
                color: "#fca5a5",
              }}
            >
              {error === "missing_code"
                ? "Bitte gib den Code ein."
                : error === "email_failed"
                  ? "Code konnte nicht erneut gesendet werden."
                  : "Code ungültig oder abgelaufen. Bitte erneut versuchen."}
            </p>
          ) : null}

          <form action="/auth/admin-2fa/verify" method="post" style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 12 }}>
            <label style={{ fontSize: 14, fontWeight: 500, color: "var(--tx-1)" }}>
              E-Mail-Code
              <input
                name="code"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="123456"
                required
                style={{
                  marginTop: 8,
                  height: 44,
                  width: "100%",
                  borderRadius: 8,
                  border: "1px solid var(--rule-strong)",
                  background: "var(--bg-1)",
                  color: "var(--tx-0)",
                  padding: "0 12px",
                }}
              />
            </label>
            <StudioButton type="submit" variant="primary" style={{ width: "100%" }}>
              Admin-Bereich freigeben
            </StudioButton>
          </form>

          <form action="/auth/admin-2fa/verify" method="post" style={{ marginTop: 8 }}>
            <input type="hidden" name="action" value="resend" />
            <StudioButton type="submit" variant="ghost" style={{ width: "100%" }}>
              Neuen Code senden
            </StudioButton>
          </form>
        </StudioCard>
      </section>
    </div>
  );
}
