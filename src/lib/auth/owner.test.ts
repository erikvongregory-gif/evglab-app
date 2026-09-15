import { afterEach, describe, expect, it, vi } from "vitest";
import type { User } from "@supabase/supabase-js";
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
import { hasAdminAccess, isOwnerUser } from "./owner";
const user = (fields: Partial<User>) => ({ email:"user@example.com",email_confirmed_at:"2026-01-01",app_metadata:{},user_metadata:{},...fields }) as User;
afterEach(() => vi.unstubAllEnvs());
describe("trusted roles", () => {
  it("ignores self-assigned admin and owner profile roles", () => {
    for(const role of ["admin","owner"]) {
      const u=user({user_metadata:{role}});
      expect(hasAdminAccess(u)).toBe(false);expect(isOwnerUser(u)).toBe(false);
    }
  });
  it("accepts server roles", () => {
    expect(hasAdminAccess(user({app_metadata:{role:"admin"}}))).toBe(true);
    expect(isOwnerUser(user({app_metadata:{role:"owner"}}))).toBe(true);
  });
  it("requires verified email for configured owner addresses", () => {
    vi.stubEnv("OWNER_EMAILS","user@example.com");
    expect(isOwnerUser(user({email_confirmed_at:undefined}))).toBe(false);
    expect(isOwnerUser(user({}))).toBe(true);
  });
});
