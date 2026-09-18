import { resolveDevEmailForward, sendResendEmail } from "@/lib/email/resend";
import {
  EMAIL,
  emailButton,
  emailDevForwardNote,
  emailInfoBox,
  emailMutedLinkNote,
  emailParagraph,
  wrapEmailHtml,
} from "@/lib/email/layout";

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
};

function greetingName(name: string | undefined, email: string) {
  const trimmed = name?.trim();
  if (trimmed && trimmed.toLowerCase() !== email.toLowerCase()) return trimmed;
  return null;
}

function buildTeamInviteHtml(input: TeamInviteEmailInput & { forwardedFor?: string }) {
  const roleLabel = ROLE_LABEL[input.role];
  const name = greetingName(input.inviteeName, input.to);
  const who = input.inviterEmail?.trim()
    ? `<strong style="color:${EMAIL.text};">${input.inviterEmail.trim()}</strong>`
    : "Dein Team";
  const hello = name
    ? `Hallo <strong style="color:${EMAIL.text};">${name}</strong>,`
    : "Hallo,";

  const bodyHtml = [
    input.forwardedFor ? emailDevForwardNote(input.forwardedFor) : "",
    emailParagraph(hello),
    emailParagraph(
      `${who} lädt dich zu <strong style="color:${EMAIL.text};">BrewAI</strong> ein — gemeinsam Motive erstellen, Marke und Mediathek teilen.`,
    ),
    emailInfoBox(
      `<strong>E-Mail:</strong> ${input.to}<br /><strong>Rolle:</strong> ${roleLabel}<br /><span style="color:${EMAIL.muted};">Noch kein Konto? Lege eines mit genau dieser E-Mail an.</span>`,
    ),
    emailButton(input.inviteUrl, "Einladung annehmen"),
    emailParagraph("Der Link ist sieben Tage gültig."),
    emailMutedLinkNote(input.inviteUrl),
  ].join("");

  return wrapEmailHtml({
    title: "Du bist eingeladen",
    bodyHtml,
    footerNote:
      "Du erwartest diese Einladung nicht? Dann kannst du diese E-Mail einfach ignorieren.",
  });
}

function buildTeamInviteText(input: TeamInviteEmailInput & { forwardedFor?: string }) {
  const roleLabel = ROLE_LABEL[input.role];
  const name = greetingName(input.inviteeName, input.to);
  const who = input.inviterEmail?.trim() || "Dein Team";
  return [
    "BrewAI — Du bist eingeladen",
    "",
    ...(input.forwardedFor ? [`Dev-Weiterleitung: eigentlich an ${input.forwardedFor}`, ""] : []),
    name ? `Hallo ${name},` : "Hallo,",
    "",
    `${who} lädt dich zu BrewAI ein.`,
    `E-Mail: ${input.to}`,
    `Rolle: ${roleLabel}`,
    "",
    "Noch kein Konto? Lege eines mit genau dieser E-Mail an.",
    "Einladung annehmen:",
    input.inviteUrl,
    "",
    "Der Link ist sieben Tage gültig.",
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
