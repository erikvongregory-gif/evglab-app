import type { NextResponse } from "next/server";

export function clearIncomingSupabaseAuthCookies(request: Request, response: NextResponse) {
  const names = new Set(
    (request.headers.get("cookie") ?? "")
      .split(";")
      .map((part) => part.slice(0, part.indexOf("=")).trim())
      .filter((name) => /^sb-[A-Za-z0-9_-]+-auth-token(?:-code-verifier)?(?:\.\d+)?$/.test(name))
      .slice(0, 16),
  );

  for (const name of names) {
    const options = {
      path: "/" as const,
      sameSite: "lax" as const,
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      maxAge: 0,
    };
    // Clear both cookie variants left by earlier host-only/shared-domain setups.
    response.cookies.set(name, "", options);
    if (process.env.NODE_ENV === "production") {
      response.cookies.set(name, "", { ...options, domain: "brewai.de" });
    }
  }
}
