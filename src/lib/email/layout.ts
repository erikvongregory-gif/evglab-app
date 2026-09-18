import { SITE } from "@/lib/siteConfig";

/** BrewAI transactional mail — light dashboard look (Studio / Admin). */
export const EMAIL = {
  accent: "#C7691E",
  accentInk: "#FFFFFF",
  bg: "#F6F6F4",
  card: "#FFFFFF",
  text: "#18140F",
  muted: "#5E574E",
  border: "#E5E3DE",
  borderSoft: "#EFEEEA",
  tint: "#FBEFE0",
} as const;

export type EmailBody = {
  title: string;
  eyebrow?: string;
  bodyHtml: string;
  footerNote?: string;
};

export function wrapEmailHtml({ title, eyebrow = "BrewAI", bodyHtml, footerNote }: EmailBody) {
  const { accent, bg, card, text, muted, border, borderSoft } = EMAIL;
  const host = SITE.baseUrl.replace(/^https?:\/\//, "");

  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="color-scheme" content="light" />
  <title>${title} · BrewAI</title>
</head>
<body style="margin:0;padding:0;background:${bg};font-family:system-ui,-apple-system,'Segoe UI',sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${bg};padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:520px;background:${card};border:1px solid ${border};border-radius:10px;overflow:hidden;box-shadow:0 1px 2px rgba(24,20,15,0.04);">
          <tr>
            <td style="padding:28px 32px 8px;">
              <p style="margin:0 0 8px;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:${accent};font-weight:600;">${eyebrow}</p>
              <h1 style="margin:0 0 16px;font-size:24px;line-height:1.25;color:${text};font-weight:600;">${title}</h1>
              ${bodyHtml}
            </td>
          </tr>
          ${
            footerNote
              ? `<tr>
            <td style="padding:8px 32px 28px;border-top:1px solid ${borderSoft};">
              <p style="margin:16px 0 0;font-size:12px;line-height:1.6;color:${muted};">${footerNote}</p>
            </td>
          </tr>`
              : `<tr><td style="padding:0 0 20px;"></td></tr>`
          }
        </table>
        <p style="margin:20px 0 0;font-size:11px;color:${muted};">
          BrewAI · ${host}
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function emailParagraph(html: string) {
  return `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:${EMAIL.muted};">${html}</p>`;
}

export function emailButton(href: string, label: string) {
  return `<table role="presentation" cellspacing="0" cellpadding="0" style="margin:8px 0 20px;">
  <tr>
    <td style="border-radius:8px;background:${EMAIL.accent};">
      <a href="${href}" style="display:inline-block;padding:14px 22px;font-size:15px;font-weight:600;color:${EMAIL.accentInk};text-decoration:none;border-radius:8px;">${label}</a>
    </td>
  </tr>
</table>`;
}

export function emailMutedLinkNote(href: string) {
  return `<p style="margin:0 0 8px;font-size:13px;line-height:1.6;color:${EMAIL.muted};">
  Falls der Button nicht funktioniert, kopiere diesen Link in deinen Browser:
</p>
<p style="margin:0 0 8px;font-size:12px;line-height:1.5;word-break:break-all;color:${EMAIL.muted};">
  <a href="${href}" style="color:${EMAIL.accent};">${href}</a>
</p>`;
}

export function emailDevForwardNote(originalTo: string) {
  return `<p style="margin:0 0 16px;font-size:13px;line-height:1.6;color:${EMAIL.accent};">Dev-Weiterleitung: eigentlich an <strong>${originalTo}</strong></p>`;
}

export function emailInfoBox(html: string) {
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 16px;">
  <tr>
    <td style="padding:14px 16px;border-radius:8px;background:${EMAIL.tint};border:1px solid ${EMAIL.border};font-size:14px;line-height:1.55;color:${EMAIL.text};">
      ${html}
    </td>
  </tr>
</table>`;
}
