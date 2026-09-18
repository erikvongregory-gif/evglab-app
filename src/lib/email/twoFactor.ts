import {
  EMAIL,
  emailDevForwardNote,
  emailParagraph,
  wrapEmailHtml,
} from "@/lib/email/layout";

export function buildTwoFactorEmailHtml(input: { code: string; forwardedFor?: string }) {
  const codeBlock = `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:8px 0 20px;">
  <tr>
    <td align="center" style="padding:22px 16px;border-radius:8px;background:${EMAIL.tint};border:1px solid ${EMAIL.border};">
      <p style="margin:0;font-size:32px;line-height:1.2;letter-spacing:0.28em;font-weight:700;color:${EMAIL.text};font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;">${input.code}</p>
    </td>
  </tr>
</table>`;

  const bodyHtml = [
    input.forwardedFor ? emailDevForwardNote(input.forwardedFor) : "",
    emailParagraph(
      "Hier ist dein Code für die Anmeldung bei BrewAI. Gib ihn auf der Bestätigungsseite ein — danach bist du drin.",
    ),
    codeBlock,
    emailParagraph(
      `Der Code ist <strong style="color:${EMAIL.text};">10 Minuten</strong> gültig.`,
    ),
  ].join("");

  return wrapEmailHtml({
    title: "Dein Login-Code",
    bodyHtml,
    footerNote:
      "Du hast dich nicht angemeldet? Ignoriere diese E-Mail — ohne den Code passiert nichts.",
  });
}

export function buildTwoFactorEmailText(input: { code: string; forwardedFor?: string }) {
  return [
    "BrewAI — Dein Login-Code",
    "",
    ...(input.forwardedFor ? [`Dev-Weiterleitung: eigentlich an ${input.forwardedFor}`, ""] : []),
    "Hier ist dein Code für die Anmeldung bei BrewAI:",
    "",
    input.code,
    "",
    "Der Code ist 10 Minuten gültig.",
    "",
    "Du hast dich nicht angemeldet? Ignoriere diese E-Mail.",
  ].join("\n");
}
