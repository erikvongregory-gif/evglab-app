import { redirect } from "next/navigation";
import { AuthLandingRouter } from "@/components/auth/auth-landing-router";
import { hasAuthCallbackParams, resolveAuthCallbackRedirect } from "@/lib/supabase/authEntryRedirect";

export default async function HomePage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};

  if (hasAuthCallbackParams(params)) {
    redirect(resolveAuthCallbackRedirect(params)!);
  }

  return <AuthLandingRouter searchParams={params} />;
}
