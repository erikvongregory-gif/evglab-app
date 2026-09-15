import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  getUserById: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: mocks.from,
    auth: { admin: { getUserById: mocks.getUserById } },
  }),
}));

import { getWorkspace } from "./workspace";

function chain(result: { data: unknown; error: unknown }) {
  const api = {
    select: vi.fn(() => api),
    eq: vi.fn(() => api),
    maybeSingle: vi.fn(async () => result),
    single: vi.fn(async () => result),
    order: vi.fn(() => api),
  };
  return api;
}

describe("getWorkspace", () => {
  it("behandelt fehlende account_deletion_jobs nicht als Loeschvormerkung", async () => {
    mocks.from.mockImplementation((table: string) => {
      if (table === "account_deletion_jobs") {
        return chain({
          data: null,
          error: { code: "PGRST205", message: "Could not find the table 'public.account_deletion_jobs'" },
        });
      }
      if (table === "workspace_members") {
        return chain({ data: null, error: null });
      }
      throw new Error(`unexpected table ${table}`);
    });

    await expect(getWorkspace("user-1")).resolves.toEqual({ ownerId: "user-1", role: "owner" });
  });

  it("blockiert wenn ein Loeschjob existiert", async () => {
    mocks.from.mockImplementation((table: string) => {
      if (table === "account_deletion_jobs") {
        return chain({ data: { user_id: "user-1" }, error: null });
      }
      throw new Error(`unexpected table ${table}`);
    });

    await expect(getWorkspace("user-1")).rejects.toThrow(/Löschung vorgemerkt/);
  });
});
