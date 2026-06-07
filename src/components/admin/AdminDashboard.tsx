"use client";

import React, { useEffect, useState } from "react";
import { StudioButton, StudioCard, StudioChip } from "@/components/studio/ui";

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
    <StudioChip active={tab === value} onClick={() => setTab(value)} type="button">
      {label}
    </StudioChip>
  );

  const inputStyle: React.CSSProperties = {
    height: 40,
    width: "100%",
    borderRadius: 8,
    border: "1px solid var(--rule-strong, rgba(255,255,255,0.12))",
    background: "var(--bg-1, #1a1918)",
    color: "var(--tx-0, #f5f0e8)",
    padding: "0 12px",
    fontSize: 14,
  };

  const tableWrapStyle: React.CSSProperties = {
    overflowX: "auto",
    borderRadius: 12,
    border: "1px solid var(--rule, rgba(255,255,255,0.08))",
  };

  const thStyle: React.CSSProperties = {
    padding: "10px 12px",
    textAlign: "left",
    fontSize: 12,
    fontWeight: 600,
    color: "var(--tx-2, #a89f92)",
    borderBottom: "1px solid var(--rule, rgba(255,255,255,0.08))",
  };

  const tdStyle: React.CSSProperties = {
    padding: "10px 12px",
    fontSize: 13,
    color: "var(--tx-1, #d9d0c4)",
    borderTop: "1px solid var(--rule, rgba(255,255,255,0.06))",
  };

  const usersView = (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Suche nach E-Mail, Rolle, Brauerei..."
        style={inputStyle}
      />
      <div style={tableWrapStyle}>
        <table style={{ minWidth: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "var(--bg-2, #201f1d)" }}>
              <th style={thStyle}>E-Mail</th>
              <th style={thStyle}>Rolle</th>
              <th style={thStyle}>Brauerei</th>
              <th style={thStyle}>Aktion</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <td style={tdStyle}>{user.email}</td>
                <td style={tdStyle}>{user.role}</td>
                <td style={tdStyle}>{user.brewery || "—"}</td>
                <td style={tdStyle}>
                  <StudioButton
                    size="sm"
                    variant="soft"
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
                  >
                    {user.role === "admin" ? "Admin entfernen" : "Zu Admin machen"}
                  </StudioButton>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const billingView = (
    <div style={tableWrapStyle}>
      <table style={{ minWidth: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ background: "var(--bg-2, #201f1d)" }}>
            <th style={thStyle}>User ID</th>
            <th style={thStyle}>E-Mail</th>
            <th style={thStyle}>Plan</th>
            <th style={thStyle}>Monatlich</th>
            <th style={thStyle}>Verbraucht</th>
            <th style={thStyle}>Verfügbar</th>
            <th style={thStyle}>Status</th>
            <th style={thStyle}>Periode bis</th>
            <th style={thStyle}>Aktion</th>
          </tr>
        </thead>
        <tbody>
          {billingRows.map((row) => (
            <tr key={row.userId}>
              <td style={{ ...tdStyle, fontFamily: "monospace", fontSize: 11 }}>{row.userId}</td>
              <td style={tdStyle}>{row.email || "—"}</td>
              <td style={tdStyle}>{row.plan ?? "—"}</td>
              <td style={tdStyle}>{row.monthlyTokens.toLocaleString("de-DE")}</td>
              <td style={tdStyle}>{row.usedTokens.toLocaleString("de-DE")}</td>
              <td style={{ ...tdStyle, fontWeight: 600, color: "var(--acc, #c9a227)" }}>
                {row.remainingTokens.toLocaleString("de-DE")}
              </td>
              <td style={tdStyle}>{row.status}</td>
              <td style={tdStyle}>
                {row.currentPeriodEnd ? new Date(row.currentPeriodEnd).toLocaleString("de-DE") : "—"}
              </td>
              <td style={tdStyle}>
                <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, minWidth: "15rem" }}>
                  <select
                    value={billingPlanDrafts[row.userId] ?? "start"}
                    onChange={(e) =>
                      setBillingPlanDrafts((prev) => ({
                        ...prev,
                        [row.userId]: e.target.value as PlanOption,
                      }))
                    }
                    style={{ ...inputStyle, height: 32, width: "auto", fontSize: 12 }}
                    disabled={billingSavingUserId === row.userId}
                  >
                    <option value="start">Start</option>
                    <option value="growth">Growth</option>
                    <option value="pro">Pro</option>
                  </select>
                  <StudioButton
                    size="sm"
                    variant="soft"
                    disabled={billingSavingUserId === row.userId}
                    onClick={() => updateUserPlan(row.userId, billingPlanDrafts[row.userId] ?? "start")}
                  >
                    Freischalten
                  </StudioButton>
                  <StudioButton
                    size="sm"
                    variant="ghost"
                    disabled={billingSavingUserId === row.userId}
                    onClick={() => updateUserPlan(row.userId, null)}
                  >
                    Entziehen
                  </StudioButton>
                </div>
              </td>
            </tr>
          ))}
          {billingRows.length === 0 ? (
            <tr>
              <td colSpan={9} style={{ ...tdStyle, textAlign: "center", color: "var(--tx-2)" }}>
                Keine Billing-Daten gefunden.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );

  const genericTable = (rows: Array<Record<string, unknown>>) => (
    <div style={tableWrapStyle}>
      <pre
        style={{
          maxHeight: "60vh",
          overflow: "auto",
          padding: 12,
          fontSize: 11,
          color: "var(--tx-1)",
          margin: 0,
        }}
      >
        {JSON.stringify(rows, null, 2)}
      </pre>
    </div>
  );

  return (
    <StudioCard pad style={{ marginTop: 22 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
        {tabButton("users", "Nutzer")}
        {tabButton("billing", "Billing")}
        {tabButton("team", "Team/Invites")}
        {tabButton("content", "Inhalte")}
      </div>
      {loading ? <p style={{ fontSize: 14, color: "var(--tx-2)" }}>Lade Daten…</p> : null}
      {error ? (
        <p
          style={{
            marginBottom: 12,
            borderRadius: 8,
            border: "1px solid rgba(239,68,68,0.35)",
            background: "rgba(239,68,68,0.08)",
            padding: "10px 12px",
            fontSize: 14,
            color: "#fca5a5",
          }}
        >
          {error}
        </p>
      ) : null}
      {!loading && tab === "users" ? usersView : null}
      {!loading && tab === "billing" ? billingView : null}
      {!loading && tab === "team" ? genericTable(teamRows) : null}
      {!loading && tab === "content" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {contentRows.length > 0 ? (
            <StudioButton
              size="sm"
              variant="soft"
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
              Erstes Element entfernen (MVP)
            </StudioButton>
          ) : null}
          {genericTable(contentRows)}
        </div>
      ) : null}
    </StudioCard>
  );
}
