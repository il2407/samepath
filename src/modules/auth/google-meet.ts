import "server-only";
import { env } from "@/shared/env";

// The scope for creating standalone Google Meet spaces via the Meet API v2
// (https://meet.googleapis.com/v2/spaces). Deliberately NOT a Calendar scope
// — spaces.create never touches Calendar, so generating a link here can
// never side-effect an auto-created calendar event. See meeting-link.ts and
// the GoogleMeetGrant doc comment in schema.prisma for the full rationale.
export const GOOGLE_MEET_SCOPE = "https://www.googleapis.com/auth/meetings.space.created";

export interface GoogleMeetTokens {
  refreshToken: string;
  accessToken: string;
  accessTokenExpiresAt: Date;
  scope: string;
}

export interface GoogleMeetRefreshedTokens {
  accessToken: string;
  accessTokenExpiresAt: Date;
}

export interface GoogleMeetClient {
  getAuthorizationUrl(state: string): string;
  exchangeCode(code: string): Promise<GoogleMeetTokens | null>;
  refreshAccessToken(refreshToken: string): Promise<GoogleMeetRefreshedTokens | null>;
  createSpace(accessToken: string): Promise<string | null>;
}

function redirectUri(): string {
  return `${env.APP_URL}/api/auth/google-meet/callback`;
}

/**
 * Real Google Meet integration: a separate, incremental-consent OAuth grant
 * (never bundled into the sign-in scope in google-oauth.ts) plus the Meet
 * API v2 `spaces.create` call. `access_type=offline&prompt=consent` is
 * required to reliably get a refresh_token back — without it, Google only
 * returns one on a user's very first-ever consent for this client.
 */
class RealGoogleMeetClient implements GoogleMeetClient {
  getAuthorizationUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID,
      redirect_uri: redirectUri(),
      response_type: "code",
      scope: GOOGLE_MEET_SCOPE,
      access_type: "offline",
      prompt: "consent",
      state,
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
  }

  async exchangeCode(code: string): Promise<GoogleMeetTokens | null> {
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
    const data = (await tokenRes.json()) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
      scope?: string;
    };
    if (!data.access_token || !data.refresh_token || !data.expires_in) return null;

    return {
      refreshToken: data.refresh_token,
      accessToken: data.access_token,
      accessTokenExpiresAt: new Date(Date.now() + data.expires_in * 1000),
      scope: data.scope ?? GOOGLE_MEET_SCOPE,
    };
  }

  async refreshAccessToken(refreshToken: string): Promise<GoogleMeetRefreshedTokens | null> {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        refresh_token: refreshToken,
        client_id: env.GOOGLE_CLIENT_ID,
        client_secret: env.GOOGLE_CLIENT_SECRET,
        grant_type: "refresh_token",
      }),
    });
    if (!tokenRes.ok) return null;
    const data = (await tokenRes.json()) as { access_token?: string; expires_in?: number };
    if (!data.access_token || !data.expires_in) return null;

    return { accessToken: data.access_token, accessTokenExpiresAt: new Date(Date.now() + data.expires_in * 1000) };
  }

  async createSpace(accessToken: string): Promise<string | null> {
    const res = await fetch("https://meet.googleapis.com/v2/spaces", {
      method: "POST",
      headers: {
        authorization: `Bearer ${accessToken}`,
        "content-type": "application/json",
      },
      body: "{}",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { meetingUri?: string };
    return data.meetingUri ?? null;
  }
}

/**
 * Local, no-network client for development and automated tests — mirrors
 * FakeGoogleOAuthClient's spirit. Produces a deterministic, validly-shaped
 * `meet.google.com` link so downstream validation (validateMeetLink) and UI
 * flows can be exercised without real credentials.
 */
class FakeGoogleMeetClient implements GoogleMeetClient {
  getAuthorizationUrl(state: string): string {
    return `/api/auth/google-meet/callback?code=fake&state=${state}`;
  }

  async exchangeCode(): Promise<GoogleMeetTokens | null> {
    return {
      refreshToken: "fake-refresh-token",
      accessToken: "fake-access-token",
      accessTokenExpiresAt: new Date(Date.now() + 3600 * 1000),
      scope: GOOGLE_MEET_SCOPE,
    };
  }

  async refreshAccessToken(): Promise<GoogleMeetRefreshedTokens | null> {
    return { accessToken: "fake-access-token", accessTokenExpiresAt: new Date(Date.now() + 3600 * 1000) };
  }

  async createSpace(): Promise<string | null> {
    const code = Math.random().toString(36).slice(2, 12).padEnd(10, "a");
    return `https://meet.google.com/${code.slice(0, 3)}-${code.slice(3, 7)}-${code.slice(7, 10)}`;
  }
}

let client: GoogleMeetClient | null = null;

export function getGoogleMeetClient(): GoogleMeetClient {
  if (!client) {
    // Reuses GOOGLE_OAUTH_ADAPTER — one toggle per integration would be
    // overkill here, since "fake" already means "skip Google entirely for
    // local dev/tests" for the sign-in flow too.
    client = env.GOOGLE_OAUTH_ADAPTER === "fake" ? new FakeGoogleMeetClient() : new RealGoogleMeetClient();
  }
  return client;
}
