"use client";

import { useEffect, useState } from "react";

type AdminTab = "users" | "billing" | "team" | "content";

type AdminUser = {
  id: string;
  email: string;
  role: string;
  brewery: string;
  createdAt: string;
  lastSignInAt: string | null;
};

type BillingRow = {
  userId: string;
  email: string;
  plan: string | null;
  monthlyTokens: number;
  usedTokens: number;
  remainingTokens: number;
  status: string;
  currentPeriodEnd: string | null;
  hasStripeCustomer: boolean;
};

type PlanOption = "start" | "growth" | "pro";

export function AdminDashboard() {
  const [tab, setTab] = useState<AdminTab>("users");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [billingRows, setBillingRows] = useState<BillingRow[]>([]);
  const [billingPlanDrafts, setBillingPlanDrafts] = useState<Record<string, PlanOption>>({});
  const [billingSavingUserId, setBillingSavingUserId] = useState<string | null>(null);
  const [teamRows, setTeamRows] = useState<Array<Record<string, unknown>>>([]);
  const [contentRows, setContentRows] = useState<Array<Record<string, unknown>>>([]);

  const loadUsers = async () => {
    const res = await fetch(`/api/admin/users?q=${encodeURIComponent(q)}`, { cache: "no-store" });
    const data = (await res.json()) as { error?: string; users?: AdminUser[] };
    if (!res.ok) throw new Error(data.error ?? "Nutzer konnten nicht geladen werden.");
    setUsers(data.users ?? []);
  };

  const loadBilling = async () => {
    const res = await fetch("/api/admin/billing", { cache: "no-store" });
    const data = (await res.json()) as { error?: string; rows?: BillingRow[] };
    if (!res.ok) throw new Error(data.error ?? "Billing konnte nicht geladen werden.");
    const rows = data.rows ?? [];
    setBillingRows(rows);
    setBillingPlanDrafts((prev) => {
      const next = { ...prev };
      rows.forEach((row) => {
        if (row.plan === "start" || row.plan === "growth" || row.plan === "pro") {
          next[row.userId] = row.plan;
        } else if (!next[row.userId]) {
          next[row.userId] = "start";
        }
      });
      return next;
    });
  };

  const updateUserPlan = async (userId: string, plan: PlanOption | null) => {
    setBillingSavingUserId(userId);
    setError("");
    try {
      const res = await fetch("/api/admin/billing", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, plan }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        throw new Error(data.error ?? "Plan konnte nicht aktualisiert werden.");
      }
      await loadBilling();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Plan konnte nicht aktualisiert werden.");
    } finally {
      setBillingSavingUserId(null);
    }
  };

  const loadTeam = async () => {
    const res = await fetch("/api/admin/team", { cache: "no-store" });
    const data = (await res.json()) as { error?: string; rows?: Array<Record<string, unknown>> };
    if (!res.ok) throw new Error(data.error ?? "Teamdaten konnten nicht geladen werden.");
    setTeamRows(data.rows ?? []);
  };

  const loadContent = async () => {
    const res = await fetch("/api/admin/content", { cache: "no-store" });
    const data = (await res.json()) as { error?: string; rows?: Array<Record<string, unknown>> };
    if (!res.ok) throw new Error(data.error ?? "Inhalte konnten nicht geladen werden.");
    setContentRows(data.rows ?? []);
  };

  const loadActiveTab = async () => {
    setLoading(true);
    setError("");
    try {
      if (tab === "users") await loadUsers();
      else if (tab === "billing") await loadBilling();
      else if (tab === "team") await loadTeam();
      else await loadContent();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Laden fehlgeschlagen.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadActiveTab();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  useEffect(() => {
    if (tab !== "users") return;
    const id = window.setTimeout(() => {
      void loadUsers().catch((e) => setError(e instanceof Error ? e.message : "Suche fehlgeschlagen."));
    }, 250);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, tab]);

  const tabButton = (value: AdminTab, label: string) => (
    <button
      type="button"
      onClick={() => setTab(value)}
      className={`rounded-md px-3 py-2 text-sm font-medium transition ${
        tab === value
          ? "bg-[#c65a20] text-white"
          : "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
      }`}
    >
      {label}
    </button>
  );

  const usersView = (
    <div className="space-y-3">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Suche nach E-Mail, Rolle, Brauerei..."
        className="h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm dark:border-gray-700 dark:bg-gray-900"
      />
      <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-left dark:bg-gray-900">
            <tr>
              <th className="px-3 py-2">E-Mail</th>
              <th className="px-3 py-2">Rolle</th>
              <th className="px-3 py-2">Brauerei</th>
              <th className="px-3 py-2">Aktion</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-t border-gray-100 dark:border-gray-800">
                <td className="px-3 py-2">{user.email}</td>
                <td className="px-3 py-2">{user.role}</td>
                <td className="px-3 py-2">{user.brewery || "-"}</td>
                <td className="px-3 py-2">
                  <button
                    type="button"
                    onClick={async () => {
                      const nextRole = user.role === "admin" ? "user" : "admin";
                      const res = await fetch("/api/admin/users", {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ userId: user.id, role: nextRole }),
                      });
                      const data = (await res.json()) as { error?: string };
                      if (!res.ok) {
                        setError(data.error ?? "Rolle konnte nicht geändert werden.");
                        return;
                      }
                      await loadUsers();
                    }}
                    className="rounded-md border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
                  >
                    {user.role === "admin" ? "Admin entfernen" : "Zu Admin machen"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const billingView = (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-left dark:bg-gray-900">
            <tr>
              <th className="px-3 py-2">User ID</th>
              <th className="px-3 py-2">E-Mail</th>
              <th className="px-3 py-2">Plan</th>
              <th className="px-3 py-2">Monatlich</th>
              <th className="px-3 py-2">Verbraucht</th>
              <th className="px-3 py-2">Verfügbar</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Periode bis</th>
              <th className="px-3 py-2">Aktion</th>
            </tr>
          </thead>
          <tbody>
            {billingRows.map((row) => (
              <tr key={row.userId} className="border-t border-gray-100 dark:border-gray-800">
                <td className="px-3 py-2 font-mono text-xs">{row.userId}</td>
                <td className="px-3 py-2">{row.email || "-"}</td>
                <td className="px-3 py-2">{row.plan ?? "-"}</td>
                <td className="px-3 py-2">{row.monthlyTokens.toLocaleString("de-DE")}</td>
                <td className="px-3 py-2">{row.usedTokens.toLocaleString("de-DE")}</td>
                <td className="px-3 py-2 font-semibold text-emerald-700 dark:text-emerald-300">
                  {row.remainingTokens.toLocaleString("de-DE")}
                </td>
                <td className="px-3 py-2">{row.status}</td>
                <td className="px-3 py-2">{row.currentPeriodEnd ? new Date(row.currentPeriodEnd).toLocaleString("de-DE") : "-"}</td>
                <td className="px-3 py-2">
                  <div className="flex min-w-[15rem] items-center gap-2">
                    <select
                      value={billingPlanDrafts[row.userId] ?? "start"}
                      onChange={(e) =>
                        setBillingPlanDrafts((prev) => ({
                          ...prev,
                          [row.userId]: e.target.value as PlanOption,
                        }))
                      }
                      className="h-8 rounded-md border border-gray-300 bg-white px-2 text-xs dark:border-gray-700 dark:bg-gray-900"
                      disabled={billingSavingUserId === row.userId}
                    >
                      <option value="start">Start</option>
                      <option value="growth">Growth</option>
                      <option value="pro">Pro</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => updateUserPlan(row.userId, billingPlanDrafts[row.userId] ?? "start")}
                      disabled={billingSavingUserId === row.userId}
                      className="rounded-md border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-700 dark:hover:bg-gray-800"
                    >
                      Freischalten
                    </button>
                    <button
                      type="button"
                      onClick={() => updateUserPlan(row.userId, null)}
                      disabled={billingSavingUserId === row.userId}
                      className="rounded-md border border-red-300 px-2 py-1 text-xs text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950/40"
                    >
                      Entziehen
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {billingRows.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-3 py-6 text-center text-gray-500 dark:text-gray-400">
                  Keine Billing-Daten gefunden.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );

  const genericTable = (rows: Array<Record<string, unknown>>) => (
    <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
      <pre className="max-h-[60vh] overflow-auto p-3 text-xs">{JSON.stringify(rows, null, 2)}</pre>
    </div>
  );

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <div className="mb-4 flex flex-wrap gap-2">
        {tabButton("users", "Nutzer")}
        {tabButton("billing", "Billing")}
        {tabButton("team", "Team/Invites")}
        {tabButton("content", "Inhalte")}
      </div>
      {loading ? <p className="text-sm text-gray-500">Lade Daten…</p> : null}
      {error ? (
        <p className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      ) : null}
      {!loading && tab === "users" ? usersView : null}
      {!loading && tab === "billing" ? billingView : null}
      {!loading && tab === "team" ? genericTable(teamRows) : null}
      {!loading && tab === "content" ? (
        <div className="space-y-3">
          {contentRows.length > 0 ? (
            <button
              type="button"
              className="rounded-md border border-gray-300 px-3 py-2 text-xs hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
              onClick={async () => {
                const first = contentRows[0] as { ownerUserId?: string; id?: string };
                if (!first?.ownerUserId || !first?.id) return;
                const res = await fetch("/api/admin/content", {
                  method: "DELETE",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ ownerUserId: first.ownerUserId, mediaId: first.id }),
                });
                const data = (await res.json()) as { error?: string };
                if (!res.ok) {
                  setError(data.error ?? "Inhalt konnte nicht gelöscht werden.");
                  return;
                }
                await loadContent();
              }}
            >
              Erstes Element entfernen (MVP-Aktion)
            </button>
          ) : null}
          {genericTable(contentRows)}
        </div>
      ) : null}
    </section>
  );
}
