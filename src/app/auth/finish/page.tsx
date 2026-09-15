import { Suspense } from "react";
import { redirect } from "next/navigation";
import { hasPassedTwoFactor, twoFactorRedirectPath } from "@/lib/auth/twoFactorSession";
import { getDashboardMetadata } from "@/lib/dashboard/metadata";
import {
  resolveStudioEntryPath,
  sanitizeStudioOnboardingState,
} from "@/lib/dashboard/onboarding";
import { normalizeNextPath } from "@/lib/security/authResponses";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { AuthFinishClient } from "./auth-finish-client";

export const dynamic = "force-dynamic";

function resolveNext(raw: string | undefined) {
  return normalizeNextPath(raw ?? null);
}

function entryPathForUser(
  userMetadata: Record<string, unknown> | undefined,
  preferred: string,
) {
  const onboarding = sanitizeStudioOnboardingState(
    getDashboardMetadata(userMetadata).onboarding,
  );
  // Deep-Links (Checkout, Tabs) nicht überschreiben — nur Default-Studio-Entry.
  if (preferred !== "/dashboard") return preferred;
  return resolveStudioEntryPath(onboarding, preferred);
}

export default async function AuthFinishPage({
  searchParams,
}: {
  searchParams?: Promise<{ next?: string | string[] }>;
}) {
  const params = (await searchParams) ?? {};
  const nextRaw = params.next;
  const preferred = resolveNext(Array.isArray(nextRaw) ? nextRaw[0] : nextRaw);

  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const next = entryPathForUser(user.user_metadata as Record<string, unknown> | undefined, preferred);
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
      <AuthFinishClient initialNext={preferred} />
    </Suspense>
  );
}
