import { resolveDevEmailForward, sendResendEmail } from "@/lib/email/resend";
import {
  EMAIL,
  emailButton,
  emailDevForwardNote,
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
    : "dein Team";
  const hello = name
    ? `Hallo <strong style="color:${EMAIL.text};">${name}</strong>,`
    : "Hallo,";

  const bodyHtml = [
    input.forwardedFor ? emailDevForwardNote(input.forwardedFor) : "",
    emailParagraph(hello),
    emailParagraph(
      `${who} lädt dich ein, gemeinsam in <strong style="color:${EMAIL.text};">BrewAI</strong> Motive zu erstellen — Marke, Mediathek und Workflow teilen.`,
    ),
    emailParagraph(`Deine Rolle: <strong style="color:${EMAIL.text};">${roleLabel}</strong>`),
    emailButton(input.inviteUrl, "Einladung annehmen"),
    emailParagraph(
      `Melde dich mit <strong style="color:${EMAIL.text};">${input.to}</strong> an und bestätige den Link. Die Einladung ist sieben Tage gültig.`,
    ),
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
    `${who} lädt dich ein, gemeinsam in BrewAI Motive zu erstellen.`,
    `Deine Rolle: ${roleLabel}`,
    "",
    "Einladung annehmen:",
    input.inviteUrl,
    "",
    `Melde dich mit ${input.to} an. Die Einladung ist sieben Tage gültig.`,
    "",
    "Du erwartest diese Einladung nicht? Ignoriere diese E-Mail.",
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
