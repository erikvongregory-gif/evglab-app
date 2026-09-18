type AuthLikeError = { message?: string; code?: string | number; status?: number };

export function mapSignupErrorCode(error: AuthLikeError): string {
  const code = String(error.code ?? "").toLowerCase();
  const message = String(error.message ?? "").toLowerCase();

  if (
    code === "email_exists" ||
    code === "user_already_exists" ||
    message.includes("already been registered") ||
    message.includes("already registered") ||
    message.includes("user already exists")
  ) {
    return "email_taken";
  }
  if (
    code === "weak_password" ||
    (message.includes("password") &&
      (message.includes("weak") || message.includes("least") || message.includes("short") || message.includes("pwned")))
  ) {
    return "weak_password";
  }
  if (message.includes("invalid") && message.includes("email")) {
    return "invalid_email";
  }
  if (message.includes("signup") && message.includes("disabled")) {
    return "signup_disabled";
  }
  return "auth";
}

export function signupErrorDetail(error: AuthLikeError): string | undefined {
  const message = String(error.message ?? "").trim();
  if (!message) return undefined;
  return message.slice(0, 160);
}
