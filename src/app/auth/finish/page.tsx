import { Suspense } from "react";
import { redirect } from "next/navigation";
import { hasPassedTwoFactor, twoFactorRedirectPath } from "@/lib/auth/twoFactorSession";
import { normalizeNextPath } from "@/lib/security/authResponses";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { AuthFinishClient } from "./auth-finish-client";

export const dynamic = "force-dynamic";

function resolveNext(raw: string | undefined) {
  return normalizeNextPath(raw ?? null);
}

export default async function AuthFinishPage({
  searchParams,
}: {
  searchParams?: Promise<{ next?: string | string[] }>;
}) {
  const params = (await searchParams) ?? {};
  const nextRaw = params.next;
  const next = resolveNext(Array.isArray(nextRaw) ? nextRaw[0] : nextRaw);

  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      if (!(await hasPassedTwoFactor(user.id))) {
        redirect(twoFactorRedirectPath(next));
      }
      redirect(next);
    }
  }

  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-[#131211] px-4">
          <p className="text-sm text-[#c4bdb3]">Anmeldung wird abgeschlossen …</p>
        </main>
      }
    >
      <AuthFinishClient initialNext={next} />
    </Suspense>
  );
}
