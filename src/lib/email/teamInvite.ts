import { resolveDevEmailForward, sendResendEmail } from "@/lib/email/resend";
import { EMAIL, emailDevForwardNote } from "@/lib/email/layout";
import { SITE } from "@/lib/siteConfig";

const ROLE_LABEL: Record<"admin" | "editor" | "viewer", string> = {
  admin: "Administrator",
  editor: "Editor",
  viewer: "Viewer",
};

export type TeamInviteEmailInput = {
  to: string;
  inviteUrl: string;
  role: "admin" | "editor" | "viewer";
  inviteeName?: string;
  inviterEmail?: string | null;
  workspaceName?: string | null;
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function truncateUrl(url: string) {
  if (url.length <= 52) return url;
  return `${url.slice(0, 36)}…${url.slice(-8)}`;
}

function buildTeamInviteHtml(input: TeamInviteEmailInput & { forwardedFor?: string }) {
  const roleLabel = ROLE_LABEL[input.role];
  const inviter = input.inviterEmail?.trim() || "Dein Team";
  const workspace = input.workspaceName?.trim() || "BrewAI";
  const declineUrl = `${input.inviteUrl}${input.inviteUrl.includes("?") ? "&" : "?"}decline=1`;
  const host = SITE.baseUrl.replace(/^https?:\/\//, "");

  const {
    bg,
    card,
    text,
    muted,
    border,
    borderSoft,
    tint,
    accent,
  } = EMAIL;

  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="color-scheme" content="light" />
  <title>Du bist eingeladen · BrewAI</title>
</head>
<body style="margin:0;padding:0;background:${bg};font-family:system-ui,-apple-system,'Segoe UI',sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${bg};padding:40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:480px;background:${card};border:1px solid ${border};border-radius:16px;overflow:hidden;box-shadow:0 8px 24px rgba(24,20,15,0.06);">
          <tr>
            <td style="padding:28px 28px 8px;">
              ${input.forwardedFor ? emailDevForwardNote(input.forwardedFor) : ""}

              <table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 18px;">
                <tr>
                  <td style="padding:6px 12px;border-radius:999px;background:#F1F0EC;border:1px solid ${border};">
                    <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#2F7A4A;vertical-align:middle;margin-right:8px;"></span>
                    <span style="font-size:12px;font-weight:600;color:${muted};vertical-align:middle;">Einladung aktiv</span>
                  </td>
                </tr>
              </table>

              <h1 style="margin:0 0 12px;font-size:28px;line-height:1.2;color:${text};font-weight:700;letter-spacing:-0.02em;">Du bist eingeladen</h1>
              <p style="margin:0 0 22px;font-size:15px;line-height:1.55;color:${muted};">
                <strong style="color:${text};">${escapeHtml(inviter)}</strong> lädt dich in den Arbeitsbereich <strong style="color:${text};">${escapeHtml(workspace)}</strong> ein.
              </p>

              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 16px;border:1px solid ${border};border-radius:12px;overflow:hidden;">
                <tr>
                  <td style="padding:14px 16px;border-bottom:1px solid ${borderSoft};">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                      <tr>
                        <td style="font-size:13px;color:${muted};">E-Mail</td>
                        <td align="right" style="font-size:13px;font-weight:600;color:${text};">${escapeHtml(input.to)}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:14px 16px;border-bottom:1px solid ${borderSoft};">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                      <tr>
                        <td style="font-size:13px;color:${muted};">Rolle</td>
                        <td align="right">
                          <span style="display:inline-block;padding:4px 10px;border-radius:999px;background:${text};color:#fff;font-size:12px;font-weight:600;">${escapeHtml(roleLabel)}</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:14px 16px;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                      <tr>
                        <td style="font-size:13px;color:${muted};">Gültig bis</td>
                        <td align="right" style="font-size:13px;font-weight:600;color:${text};">7 Tage</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 22px;">
                <tr>
                  <td style="padding:14px 16px;border-radius:12px;background:${tint};border:1px solid rgba(199,105,30,0.28);font-size:13px;line-height:1.55;color:${text};">
                    Noch kein Konto? Beim Annehmen legst du eines mit genau dieser E-Mail an.
                  </td>
                </tr>
              </table>

              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 10px;">
                <tr>
                  <td align="center" style="border-radius:10px;background:${text};">
                    <a href="${escapeHtml(input.inviteUrl)}" style="display:block;padding:14px 18px;font-size:15px;font-weight:700;color:#fff;text-decoration:none;border-radius:10px;">Einladung annehmen</a>
                  </td>
                </tr>
              </table>

              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 24px;">
                <tr>
                  <td align="center" style="border-radius:10px;background:#F1F0EC;">
                    <a href="${escapeHtml(declineUrl)}" style="display:block;padding:13px 18px;font-size:14px;font-weight:600;color:${muted};text-decoration:none;border-radius:10px;">Ablehnen</a>
                  </td>
                </tr>
              </table>

              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-top:1px solid ${borderSoft};">
                <tr>
                  <td style="padding-top:18px;">
                    <p style="margin:0 0 10px;font-size:12px;line-height:1.5;color:${muted};">Falls der Button nicht funktioniert, kopiere diesen Link:</p>
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid ${border};border-radius:10px;background:#FAFAF8;">
                      <tr>
                        <td style="padding:12px 14px;font-size:12px;line-height:1.4;word-break:break-all;">
                          <a href="${escapeHtml(input.inviteUrl)}" style="color:${accent};text-decoration:none;">${escapeHtml(truncateUrl(input.inviteUrl))}</a>
                        </td>
                      </tr>
                    </table>
                    <p style="margin:16px 0 0;font-size:12px;line-height:1.55;color:${muted};">
                      Du erwartest diese Einladung nicht? Dann kannst du sie einfach ignorieren.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 28px 24px;"></td>
          </tr>
        </table>
        <p style="margin:18px 0 0;font-size:11px;color:${muted};">BrewAI · ${host}</p>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function buildTeamInviteText(input: TeamInviteEmailInput & { forwardedFor?: string }) {
  const roleLabel = ROLE_LABEL[input.role];
  const inviter = input.inviterEmail?.trim() || "Dein Team";
  const workspace = input.workspaceName?.trim() || "BrewAI";
  return [
    "BrewAI — Du bist eingeladen",
    "",
    ...(input.forwardedFor ? [`Dev-Weiterleitung: eigentlich an ${input.forwardedFor}`, ""] : []),
    `${inviter} lädt dich in den Arbeitsbereich ${workspace} ein.`,
    "",
    `E-Mail: ${input.to}`,
    `Rolle: ${roleLabel}`,
    "Gültig bis: 7 Tage",
    "",
    "Noch kein Konto? Beim Annehmen legst du eines mit genau dieser E-Mail an.",
    "",
    "Einladung annehmen:",
    input.inviteUrl,
    "",
    "Ablehnen:",
    `${input.inviteUrl}${input.inviteUrl.includes("?") ? "&" : "?"}decline=1`,
    "",
    "Du erwartest diese Einladung nicht? Dann kannst du sie einfach ignorieren.",
  ].join("\n");
}

export async function sendTeamInviteEmail(input: TeamInviteEmailInput) {
  const recipient = resolveDevEmailForward(input.to);
  const payload = {
    ...input,
    to: input.to,
    forwardedFor: recipient.forwarded ? recipient.originalTo : undefined,
  };
  await sendResendEmail({
    to: recipient.to,
    subject: "Du bist bei BrewAI eingeladen",
    html: buildTeamInviteHtml(payload),
    text: buildTeamInviteText(payload),
    replyTo: "kontakt@brewai.de",
    tag: "team-invite",
  });
}
