import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SITE } from "@/lib/siteConfig";

export const metadata: Metadata = {
  title: {
    absolute: "BrewAI · Registrierung",
  },
  alternates: {
    canonical: `${SITE.baseUrl}/registrieren`,
  },
  robots: {
    index: false,
    follow: false,
    googleBot: { index: false, follow: false },
  },
};

export default async function RegistrierenPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  const q = new URLSearchParams();
  q.set("mode", "register");
  for (const [key, raw] of Object.entries(params)) {
    if (raw === undefined || key === "mode") continue;
    const vals = Array.isArray(raw) ? raw : [raw];
    for (const v of vals) q.append(key, v);
  }
  redirect(`/anmelden?${q.toString()}`);
}
