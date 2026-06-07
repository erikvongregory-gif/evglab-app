import { describe, expect, it } from "vitest";
import { mapSignInErrorCode } from "./signInErrors";

describe("mapSignInErrorCode", () => {
  it("mappt ungültige Zugangsdaten", () => {
    expect(mapSignInErrorCode({ code: "invalid_credentials", message: "x" })).toBe("credentials");
    expect(mapSignInErrorCode({ message: "Invalid login credentials" })).toBe("credentials");
  });

  it("mappt unbestätigte E-Mail", () => {
    expect(mapSignInErrorCode({ code: "email_not_confirmed" })).toBe("email_not_confirmed");
  });
});
