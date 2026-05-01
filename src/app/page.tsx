import { redirect } from "next/navigation";

export default async function HomePage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  const q = new URLSearchParams();
  for (const [key, raw] of Object.entries(params)) {
    if (raw === undefined) continue;
    const vals = Array.isArray(raw) ? raw : [raw];
    for (const v of vals) q.append(key, v);
  }
  const qs = q.toString();
  redirect(qs ? `/anmelden?${qs}` : "/anmelden");
}
