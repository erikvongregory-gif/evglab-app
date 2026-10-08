import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(), refreshSession: vi.fn(), twoFactor: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser: mocks.getUser, refreshSession: mocks.refreshSession } }),
}));
vi.mock("@/lib/supabase/env", () => ({ isSupabaseConfigured: () => true }));
vi.mock("@/lib/auth/twoFactorSession", () => ({ hasPassedTwoFactor: mocks.twoFactor }));
vi.mock("@/lib/dashboard/workspace", () => ({ workspaceResourceUser: async (user: unknown) => user }));

import { POST as repairSession } from "@/app/api/auth/repair-session/route";
import { GET as referenceImage } from "@/app/api/brand/reference-image/[id]/route";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.twoFactor.mockResolvedValue(true);
  mocks.refreshSession.mockResolvedValue({});
});

describe("security route boundaries", () => {
  it("rejects a foreign session repair before touching authentication", async () => {
    const response = await repairSession(new Request("https://app.brewai.de/api/auth/repair-session", {
      method: "POST", headers: { origin: "https://evil.example" },
    }));
    expect(response.status).toBe(403);
    expect(mocks.getUser).not.toHaveBeenCalled();
    expect(mocks.refreshSession).not.toHaveBeenCalled();
  });

  it("allows legitimate session repair", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: "actor", user_metadata: {} } } });
    const response = await repairSession(new Request("https://app.brewai.de/api/auth/repair-session", {
      method: "POST", headers: { origin: "https://app.brewai.de" },
    }));
    expect(response.status).toBe(200);
    expect(mocks.refreshSession).toHaveBeenCalledOnce();
  });

  it("refuses HTML metadata at the actual image route", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: "actor", user_metadata: {
      dashboard: { brandReferenceImages: { br_security123: {
        mime: "text/html", base64: Buffer.from("<script>alert(1)</script>").toString("base64"),
      } } },
    } } } });
    const response = await referenceImage(new Request("https://app.brewai.de/api/brand/reference-image/br_security123"), {
      params: Promise.resolve({ id: "br_security123" }),
    });
    expect(response.status).toBe(404);
  });

});
