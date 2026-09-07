import { describe, expect, it } from "vitest";
import { getGoogleOAuthClient } from "@/modules/auth/google-oauth";

// env.test.example / .env.test set GOOGLE_OAUTH_ADAPTER=fake, so this
// exercises FakeGoogleOAuthClient — the real client's network calls are
// exchanged indirectly through service.integration.test.ts's
// findOrCreateUserFromGoogle tests, same pattern as FakePaymentProvider.
describe("getGoogleOAuthClient (fake adapter)", () => {
  it("returns a deterministic default profile for the canned 'fake' code", async () => {
    const client = getGoogleOAuthClient();
    const profile = await client.exchangeCode("fake");
    expect(profile).toEqual({
      sub: "fake-sub-default",
      email: "fake-google-user@example.com",
      emailVerified: true,
      name: "Fake User",
    });
  });

  it("treats the code as the desired email for any other value", async () => {
    const client = getGoogleOAuthClient();
    const profile = await client.exchangeCode("someone@example.com");
    expect(profile).toEqual({
      sub: "fake-sub-someone@example.com",
      email: "someone@example.com",
      emailVerified: true,
      name: "Fake User",
    });
  });

  it("builds a local authorization URL carrying the state through", () => {
    const client = getGoogleOAuthClient();
    const url = client.getAuthorizationUrl("test-state-123");
    expect(url).toContain("state=test-state-123");
  });
});
