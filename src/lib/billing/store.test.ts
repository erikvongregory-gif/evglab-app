import { beforeEach, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ rpc: vi.fn(), owner: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ rpc: mock.rpc }) }));
vi.mock("@/lib/auth/owner", () => ({ OWNER_TOKEN_ALLOWANCE: 100000, isOwnerUserId: mock.owner }));
import { consumeTokens, refundTokens, grantTokenPackSession } from "./store";
beforeEach(() => { vi.clearAllMocks(); mock.owner.mockResolvedValue(false); });
it("fails closed when the migration/RPC is missing", async () => {
  mock.rpc.mockResolvedValue({ error: { code: "PGRST202", message: "RPC missing" }, data: null });
  expect(await consumeTokens("user", 10)).toEqual({ ok: false, error: "RPC missing" });
});
it("refunds for owner accounts do not modify a real balance", async () => {
  mock.owner.mockResolvedValue(true);
  expect((await refundTokens("owner", 10)).ok).toBe(true);
  expect(mock.rpc).not.toHaveBeenCalled();
});
it("propagates failed atomic grants rather than treating them as duplicates", async () => {
  mock.rpc.mockResolvedValue({ error: { message: "credit failed" }, data: null });
  await expect(grantTokenPackSession({ sessionId: "cs", userId: "user", packId: "p", tokens: 100, source: "webhook" })).rejects.toThrow("credit failed");
});
