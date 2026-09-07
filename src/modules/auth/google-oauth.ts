import "server-only";
import { env } from "@/shared/env";

export interface GoogleProfile {
  sub: string;
  email: string;
  emailVerified: boolean;
  name: string | null;
}

export interface GoogleOAuthClient {
  getAuthorizationUrl(state: string): string;
  exchangeCode(code: string): Promise<GoogleProfile | null>;
}

function redirectUri(): string {
  return `${env.APP_URL}/api/auth/google/callback`;
}

/**
 * Real Google OAuth (authorization-code flow, confidential client). ID-token
 * verification uses Google's `tokeninfo` convenience endpoint (validates
 * signature + expiry, returns decoded claims) rather than local JWKS
 * verification — no JWT/JWKS library needed, at the cost of an extra network
 * round-trip. `aud` must still be checked here since tokeninfo doesn't know
 * which client asked. Fine at this app's scale; a JWKS-based library is a
 * reasonable upgrade if request volume grows.
 */
class RealGoogleOAuthClient implements GoogleOAuthClient {
  getAuthorizationUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID,
      redirect_uri: redirectUri(),
      response_type: "code",
      scope: "openid email profile",
      state,
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
  }

  async exchangeCode(code: string): Promise<GoogleProfile | null> {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: env.GOOGLE_CLIENT_ID,
        client_secret: env.GOOGLE_CLIENT_SECRET,
        redirect_uri: redirectUri(),
        grant_type: "authorization_code",
      }),
    });
    if (!tokenRes.ok) return null;
    const { id_token: idToken } = (await tokenRes.json()) as { id_token?: string };
    if (!idToken) return null;

    const infoRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${idToken}`);
    if (!infoRes.ok) return null;
    const claims = (await infoRes.json()) as {
      aud?: string;
      sub?: string;
      email?: string;
      email_verified?: string;
      name?: string;
    };
    if (!claims.sub || !claims.email || claims.aud !== env.GOOGLE_CLIENT_ID) return null;

    return {
      sub: claims.sub,
      email: claims.email,
      emailVerified: claims.email_verified === "true",
      name: claims.name ?? null,
    };
  }
}

/**
 * Local, no-network client for development and automated tests — skips
 * Google entirely. `code` doubles as the desired email so tests can control
 * which identity a "sign-in" resolves to, matching FakePaymentProvider's
 * spirit (src/modules/payments/provider.ts).
 */
class FakeGoogleOAuthClient implements GoogleOAuthClient {
  getAuthorizationUrl(state: string): string {
    return `/api/auth/google/callback?code=fake&state=${state}`;
  }

  async exchangeCode(code: string): Promise<GoogleProfile | null> {
    if (!code || code === "fake") {
      return { sub: "fake-sub-default", email: "fake-google-user@example.com", emailVerified: true, name: "Fake User" };
    }
    return { sub: `fake-sub-${code}`, email: code, emailVerified: true, name: "Fake User" };
  }
}

let client: GoogleOAuthClient | null = null;

export function getGoogleOAuthClient(): GoogleOAuthClient {
  if (!client) {
    // env.GOOGLE_OAUTH_ADAPTER is validated (src/shared/env.ts); a real
    // integration must be deliberately selected, mirroring getPaymentProvider.
    client = env.GOOGLE_OAUTH_ADAPTER === "fake" ? new FakeGoogleOAuthClient() : new RealGoogleOAuthClient();
  }
  return client;
}
