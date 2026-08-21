import { SITE } from "@/lib/siteConfig";
import { resolveDevEmailForward, sendResendEmail } from "@/lib/email/resend";

function buildPasswordResetHtml(actionLink: string, forwardedFor?: string) {
  const forwardNote = forwardedFor
    ? `<p style="margin:0 0 16px;font-size:13px;line-height:1.6;color:#c8602a;">Dev-Weiterleitung: Reset-Link für <strong>${forwardedFor}</strong></p>`
    : "";
  const accent = "#c8602a";
  const bg = "#131211";
  const card = "#1a1816";
  const text = "#f4f1ec";
  const muted = "#8a837a";

  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="color-scheme" content="dark" />
  <title>Passwort zurücksetzen · BrewAI</title>
</head>
<body style="margin:0;padding:0;background:${bg};font-family:system-ui,-apple-system,'Segoe UI',sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${bg};padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:520px;background:${card};border:1px solid rgba(255,255,255,0.08);border-radius:12px;overflow:hidden;">
          <tr>
            <td style="padding:28px 32px 8px;">
              <p style="margin:0 0 8px;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:${accent};font-weight:600;">BrewAI</p>
              <h1 style="margin:0 0 12px;font-size:24px;line-height:1.25;color:${text};font-weight:600;">Passwort zurücksetzen</h1>
              ${forwardNote}
              <p style="margin:0;font-size:15px;line-height:1.6;color:${muted};">
                Du hast angefordert, dein Passwort für dein BrewAI-Konto zurückzusetzen. Klicke auf den Button — der Link ist 60 Minuten gültig.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 32px 8px;">
              <a href="${actionLink}" style="display:inline-block;background:${accent};color:#fff;text-decoration:none;font-size:15px;font-weight:600;padding:14px 22px;border-radius:10px;">
                Neues Passwort festlegen
              </a>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 32px 28px;">
              <p style="margin:0 0 12px;font-size:13px;line-height:1.6;color:${muted};">
                Falls der Button nicht funktioniert, kopiere diesen Link in deinen Browser:
              </p>
              <p style="margin:0;font-size:12px;line-height:1.5;word-break:break-all;color:${muted};">
                <a href="${actionLink}" style="color:${accent};">${actionLink}</a>
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 28px;border-top:1px solid rgba(255,255,255,0.06);">
              <p style="margin:16px 0 0;font-size:12px;line-height:1.6;color:${muted};">
                Du hast diese Anfrage nicht gestellt? Ignoriere diese E-Mail — dein Passwort bleibt unverändert.
              </p>
            </td>
          </tr>
        </table>
        <p style="margin:20px 0 0;font-size:11px;color:${muted};">
          BrewAI · ${SITE.baseUrl.replace(/^https?:\/\//, "")}
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function buildPasswordResetText(actionLink: string, forwardedFor?: string) {
  return [
    "BrewAI — Passwort zurücksetzen",
    "",
    ...(forwardedFor ? [`Dev-Weiterleitung: Reset-Link für ${forwardedFor}`, ""] : []),
    "Du hast angefordert, dein Passwort für dein BrewAI-Konto zurückzusetzen.",
    "Öffne den folgenden Link (60 Minuten gültig):",
    "",
    actionLink,
    "",
    "Du hast diese Anfrage nicht gestellt? Ignoriere diese E-Mail — dein Passwort bleibt unverändert.",
    "",
    `BrewAI · ${SITE.baseUrl}`,
  ].join("\n");
}

export async function sendPasswordResetEmail(input: { to: string; actionLink: string }) {
  const recipient = resolveDevEmailForward(input.to);
  await sendResendEmail({
    to: recipient.to,
    subject: "Dein Link zum Passwort zurücksetzen · BrewAI",
    html: buildPasswordResetHtml(input.actionLink, recipient.forwarded ? recipient.originalTo : undefined),
    text: buildPasswordResetText(input.actionLink, recipient.forwarded ? recipient.originalTo : undefined),
    replyTo: "kontakt@brewai.de",
    tag: "password-reset",
  });
}
