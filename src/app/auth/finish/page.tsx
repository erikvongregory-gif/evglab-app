import { Suspense } from "react";

import { redirect } from "next/navigation";

import { cookies } from "next/headers";

import {

  getPendingCookieName,

  getVerifiedCookieName,

  hasValidPending2FAForUser,

  isVerified2FAForUser,

} from "@/lib/admin/emailTwoFactor";

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

      const role =

        typeof user.user_metadata?.role === "string"

          ? String(user.user_metadata.role).toLowerCase()

          : "";

      if (role === "admin") {

        const cookieStore = await cookies();

        const pending = cookieStore.get(getPendingCookieName())?.value ?? null;

        const verified = cookieStore.get(getVerifiedCookieName())?.value ?? null;

        const needs2fa =

          hasValidPending2FAForUser(pending, user.id) && !isVerified2FAForUser(verified, user.id);

        redirect(needs2fa ? "/dashboard/2fa-email" : next);

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

