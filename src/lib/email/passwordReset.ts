import { SITE } from "@/lib/siteConfig";
import { resolveDevEmailForward, sendResendEmail } from "@/lib/email/resend";
import {
  emailButton,
  emailDevForwardNote,
  emailMutedLinkNote,
  emailParagraph,
  wrapEmailHtml,
} from "@/lib/email/layout";

function buildPasswordResetHtml(actionLink: string, forwardedFor?: string) {
  const bodyHtml = [
    forwardedFor ? emailDevForwardNote(forwardedFor) : "",
    emailParagraph(
      "Du hast angefordert, dein Passwort für dein BrewAI-Konto zurückzusetzen. Klicke auf den Button — der Link ist 60 Minuten gültig.",
    ),
    emailButton(actionLink, "Neues Passwort festlegen"),
    emailMutedLinkNote(actionLink),
  ].join("");

  return wrapEmailHtml({
    title: "Passwort zurücksetzen",
    bodyHtml,
    footerNote:
      "Du hast diese Anfrage nicht gestellt? Ignoriere diese E-Mail — dein Passwort bleibt unverändert.",
  });
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
