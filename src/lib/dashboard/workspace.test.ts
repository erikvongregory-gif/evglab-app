import { afterEach,beforeEach,expect,it,vi } from "vitest";
const mock=vi.hoisted(()=>({from:vi.fn()}));
vi.mock("@/lib/supabase/admin",()=>({createAdminClient:()=>({from:mock.from})}));
vi.mock("@/lib/auth/owner",()=>({isPortalOperatorUserId:async()=>false}));
vi.mock("@/lib/supabase/privateAssets",()=>({hydratePrivateAssets:async(x:unknown)=>x}));
import { getWorkspace } from "./workspace";
function query(result:unknown){return {select(){return this;},eq(){return this;},maybeSingle:async()=>result};}
beforeEach(()=>{vi.clearAllMocks();vi.stubEnv("NODE_ENV","production");});
afterEach(()=>vi.unstubAllEnvs());
it("does not bypass deletion checks on production database errors",async()=>{
 mock.from.mockReturnValue(query({data:null,error:{code:"42P01"}}));
 await expect(getWorkspace("actor")).rejects.toThrow("Löschstatus");
});
it("does not invent owner permissions when membership storage is missing",async()=>{
 mock.from.mockReturnValueOnce(query({data:null,error:null})).mockReturnValueOnce(query({data:null,error:{code:"42P01"}}));
 await expect(getWorkspace("actor")).rejects.toThrow("Teamzuordnung");
});
it("permits the existing local bootstrap fallback only outside production",async()=>{
 vi.stubEnv("NODE_ENV","development");mock.from.mockReturnValue(query({data:null,error:{code:"42P01"}}));
 expect(await getWorkspace("actor")).toEqual({ownerId:"actor",role:"owner"});
});
it("blocks an existing deletion job",async()=>{
 mock.from.mockReturnValue(query({data:{user_id:"actor"},error:null}));
 await expect(getWorkspace("actor")).rejects.toThrow("Löschung vorgemerkt");
});
