import { describe, expect, it } from "vitest";
import crypto from "node:crypto";
import { verifyPkceS256 } from "@/lib/server/oauth-internal";

describe("oauth PKCE S256", () => {
  it("accepts matching verifier", () => {
    const verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"; // 43+ chars example shape
    const challenge = crypto.createHash("sha256").update(verifier, "ascii").digest("base64url");
    expect(verifyPkceS256(verifier, challenge)).toBe(true);
  });

  it("rejects wrong verifier", () => {
    const verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
    const challenge = crypto.createHash("sha256").update("other", "ascii").digest("base64url");
    expect(verifyPkceS256(verifier, challenge)).toBe(false);
  });
});
