import { getDashboardMetadata, mergeDashboardMetadata } from "@/lib/dashboard/metadata";

export type StoredInstagramConnection = {
  igUserId: string;
  username: string;
  profileUrl: string;
  pageId: string;
  pageAccessToken: string;
  tokenExpiresAt: string;
  connectedAt: string;
};

export type PublicInstagramConnection = {
  connected: boolean;
  username?: string;
  profileUrl?: string;
  tokenExpiresAt?: string;
  connectedAt?: string;
  expired?: boolean;
};

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

export function getInstagramConnection(userMetadata: unknown): StoredInstagramConnection | null {
  const dashboard = getDashboardMetadata(userMetadata);
  const raw = asRecord(dashboard).instagramConnection ?? asRecord(userMetadata).instagramConnection;
  if (!raw || typeof raw !== "object") return null;

  const record = raw as Record<string, unknown>;
  const igUserId = typeof record.igUserId === "string" ? record.igUserId.trim() : "";
  const username = typeof record.username === "string" ? record.username.trim() : "";
  const profileUrl = typeof record.profileUrl === "string" ? record.profileUrl.trim() : "";
  const pageId = typeof record.pageId === "string" ? record.pageId.trim() : "";
  const pageAccessToken = typeof record.pageAccessToken === "string" ? record.pageAccessToken.trim() : "";
  const tokenExpiresAt = typeof record.tokenExpiresAt === "string" ? record.tokenExpiresAt.trim() : "";
  const connectedAt = typeof record.connectedAt === "string" ? record.connectedAt.trim() : "";

  if (!igUserId || !username || !pageAccessToken) return null;

  return {
    igUserId,
    username,
    profileUrl: profileUrl || `https://www.instagram.com/${username}/`,
    pageId,
    pageAccessToken,
    tokenExpiresAt,
    connectedAt: connectedAt || new Date().toISOString(),
  };
}

export function isInstagramConnectionExpired(connection: StoredInstagramConnection): boolean {
  if (!connection.tokenExpiresAt) return false;
  const expiresAt = new Date(connection.tokenExpiresAt).getTime();
  if (!Number.isFinite(expiresAt)) return false;
  return expiresAt <= Date.now() + 60_000;
}

export function toPublicInstagramConnection(connection: StoredInstagramConnection | null): PublicInstagramConnection {
  if (!connection) return { connected: false };
  return {
    connected: true,
    username: connection.username,
    profileUrl: connection.profileUrl,
    tokenExpiresAt: connection.tokenExpiresAt || undefined,
    connectedAt: connection.connectedAt,
    expired: isInstagramConnectionExpired(connection),
  };
}

export function mergeInstagramConnectionMetadata(
  userMetadata: unknown,
  connection: StoredInstagramConnection | null,
): Record<string, unknown> {
  const base = asRecord(userMetadata);
  const dashboard = asRecord(base.dashboard);
  const nextDashboard = { ...dashboard };
  if (connection) {
    nextDashboard.instagramConnection = connection;
  } else if ("instagramConnection" in nextDashboard) {
    delete nextDashboard.instagramConnection;
  }
  return { ...base, dashboard: nextDashboard };
}
