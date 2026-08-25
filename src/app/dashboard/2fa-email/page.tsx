import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getPendingCookieName, hasValidPending2FAForUser } from "@/lib/admin/emailTwoFactor";
import { isOwnerUser } from "@/lib/auth/owner";
import { normalizeNextPath } from "@/lib/security/authResponses";
import { createClient } from "@/lib/supabase/server";
import { StudioButton, StudioCard } from "@/components/studio/ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: {
    absolute: "BrewAI · Sicherheitscode",
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

const inputStyle = {
  marginTop: 8,
  height: 46,
  width: "100%",
  borderRadius: 8,
  border: "1px solid var(--rule-strong)",
  background: "var(--bg-1)",
  color: "var(--tx-0)",
  padding: "0 12px",
  fontSize: 16,
} as const;

const bannerStyle = {
  marginTop: 12,
  borderRadius: 8,
  padding: "10px 12px",
  fontSize: 14,
} as const;

export default async function DashboardEmail2FAPage({ searchParams }: Props) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/anmelden");

  const params = (await searchParams) ?? {};
  const error = readValue(params.error);
  const notice = readValue(params.notice);
  const next = normalizeNextPath(readValue(params.next));

  const cookieStore = await cookies();
  const pendingToken = cookieStore.get(getPendingCookieName())?.value ?? null;
  const hasPendingCode = hasValidPending2FAForUser(pendingToken, user.id);
  const ownerHasBackupCode = isOwnerUser(user) && Boolean(process.env.OWNER_2FA_BACKUP_CODE);

  return (
    <div className="evg-studio" style={{ minHeight: "100vh", background: "var(--bg-0, #131211)", padding: "32px 16px" }}>
      <section style={{ maxWidth: 420, margin: "48px auto 0" }}>
        <StudioCard pad>
          <h1 style={{ fontSize: 22, fontWeight: 600, color: "var(--tx-0)" }}>Sicherheitscode</h1>
          <p style={{ marginTop: 8, fontSize: 14, color: "var(--tx-2)", lineHeight: 1.5 }}>
            {hasPendingCode ? (
              <>
                Wir haben einen 6-stelligen Code an <strong style={{ color: "var(--tx-1)" }}>{user.email}</strong>{" "}
                gesendet. Nach der Bestätigung merken wir uns dieses Gerät 30 Tage.
              </>
            ) : (
              <>
                Zum Schutz deines Kontos brauchen wir einen Code per E-Mail. Fordere ihn jetzt für{" "}
                <strong style={{ color: "var(--tx-1)" }}>{user.email}</strong> an.
              </>
            )}
          </p>

          {notice === "resent" ? (
            <p
              style={{
                ...bannerStyle,
                border: "1px solid rgba(34,197,94,0.35)",
                background: "rgba(34,197,94,0.08)",
                color: "#86efac",
              }}
            >
              Neuer Code wurde gesendet.
            </p>
          ) : null}
          {error ? (
            <p
              style={{
                ...bannerStyle,
                border: "1px solid rgba(239,68,68,0.35)",
                background: "rgba(239,68,68,0.08)",
                color: "#fca5a5",
              }}
            >
              {error === "missing_code"
                ? "Bitte gib den Code ein."
                : error === "email_failed"
                  ? "Code konnte nicht gesendet werden. Prüfe die E-Mail-Konfiguration oder versuch es erneut."
                  : "Code ungültig oder abgelaufen. Bitte fordere einen neuen Code an."}
            </p>
          ) : null}

          {hasPendingCode || ownerHasBackupCode ? (
            <form
              action="/auth/admin-2fa/verify"
              method="post"
              style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 12 }}
            >
              <input type="hidden" name="next" value={next} />
              <label style={{ fontSize: 14, fontWeight: 500, color: "var(--tx-1)" }}>
                {ownerHasBackupCode ? "E-Mail-Code oder Recovery-Code" : "E-Mail-Code"}
                <input
                  name="code"
                  inputMode={ownerHasBackupCode ? "text" : "numeric"}
                  autoComplete="one-time-code"
                  placeholder={ownerHasBackupCode ? "123456 oder Recovery-Code" : "123456"}
                  required
                  autoFocus
                  style={inputStyle}
                />
              </label>
              <StudioButton type="submit" variant="primary" style={{ width: "100%" }}>
                Bestätigen
              </StudioButton>
            </form>
          ) : null}

          <form
            action="/auth/admin-2fa/verify"
            method="post"
            style={{ marginTop: hasPendingCode || ownerHasBackupCode ? 8 : 20 }}
          >
            <input type="hidden" name="action" value="send" />
            <input type="hidden" name="next" value={next} />
            <StudioButton
              type="submit"
              variant={hasPendingCode || ownerHasBackupCode ? "ghost" : "primary"}
              style={{ width: "100%" }}
            >
              {hasPendingCode ? "Neuen Code senden" : "Code per E-Mail senden"}
            </StudioButton>
          </form>

          <form action="/auth/signout" method="post" style={{ marginTop: 16 }}>
            <StudioButton type="submit" variant="ghost" style={{ width: "100%" }}>
              Abmelden
            </StudioButton>
          </form>
        </StudioCard>
      </section>
    </div>
  );
}
