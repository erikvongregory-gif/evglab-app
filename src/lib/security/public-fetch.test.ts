import { describe,it,expect,vi,afterEach } from "vitest";
const mocks=vi.hoisted(()=>({lookup:vi.fn()}));
vi.mock("node:dns/promises",()=>({lookup:mocks.lookup}));
import { isPublicAddress,publicFetch } from "./public-fetch";
afterEach(()=>vi.clearAllMocks());
describe("public network boundary",()=>{
 it("rejects loopback, private, link-local, mapped and special addresses",()=>{
  for(const ip of ["127.1.2.3","10.1.1.1","172.20.1.1","192.168.1.1","169.254.169.254","100.64.0.1","0.1.2.3","224.0.0.1","::1","::ffff:127.0.0.1","fc00::1","fe80::1","2001:db8::1"])
   expect(isPublicAddress(ip),ip).toBe(false);
  expect(isPublicAddress("8.8.8.8")).toBe(true);
  expect(isPublicAddress("2001:4860:4860::8888")).toBe(true);
 });
 it("rejects mixed public/private DNS answers before opening a socket",async()=>{
  mocks.lookup.mockResolvedValue([{address:"8.8.8.8",family:4},{address:"127.0.0.1",family:4}]);
  await expect(publicFetch("https://example.com")).rejects.toThrow("Netzwerkadresse");
 });
 it("rejects credentials and nonstandard ports",async()=>{
  await expect(publicFetch("https://user:pass@example.com")).rejects.toThrow();
  await expect(publicFetch("http://example.com:2375")).rejects.toThrow();
  expect(mocks.lookup).not.toHaveBeenCalled();
 });
});
