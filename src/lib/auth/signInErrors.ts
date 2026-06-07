type AuthLikeError = { message?: string; code?: string | number };

export function mapSignInErrorCode(error: AuthLikeError): string {
  const code = String(error.code ?? "").toLowerCase();
  const message = String(error.message ?? "").toLowerCase();

  if (code === "invalid_credentials" || message.includes("invalid login credentials")) {
    return "credentials";
  }
  if (code === "email_not_confirmed" || message.includes("email not confirmed")) {
    return "email_not_confirmed";
  }
  if (code === "user_banned" || message.includes("user is banned")) {
    return "user_banned";
  }
  return "auth";
}

export function signInErrorDetail(error: AuthLikeError): string | undefined {
  const message = String(error.message ?? "").trim();
  if (!message) return undefined;
  return message.slice(0, 160);
}
