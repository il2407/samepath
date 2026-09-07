// Pure logic, no DB/framework import — backend validation for the "paste an
// existing Google Meet link" fallback (WS7 backlog item 14). See README
// "Google Meet / Calendar" and docs/architecture-decisions.md: this app does
// NOT integrate with the real Google Calendar/Meet API (no OAuth scope for
// it, no auto-created events) — a manually pasted link, validated here, is
// the deliberately simpler v1. Full Calendar-API auto-creation is a
// documented, explicitly out-of-scope stretch phase — see the doc comment at
// the bottom of this file.

/**
 * Real Google Meet links look like `https://meet.google.com/xxx-xxxx-xxx`
 * (three groups of lowercase letters, 3-4-3, joined by hyphens), optionally
 * followed by query parameters Google itself appends in some contexts (e.g.
 * `?authuser=0`, `?hs=122`). Anything else — a different domain, a bare
 * meeting code with no scheme, a non-https scheme, or a shape that merely
 * *looks* URL-like — is rejected.
 */
const MEET_LINK_PATH_PATTERN = /^\/[a-z]{3}-[a-z]{4}-[a-z]{3}$/i;

export type MeetLinkValidationResult = { ok: true; url: string } | { ok: false; error: string };

/**
 * Validates a user-pasted Google Meet URL on the backend — never trust a
 * frontend `type="url"` input alone (item 14.9). Returns the trimmed,
 * validated URL string on success, or a Hebrew error message on failure.
 */
export function validateMeetLink(raw: string): MeetLinkValidationResult {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: false, error: "יש להזין קישור למפגש" };

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { ok: false, error: "הקישור שהוזן אינו כתובת אינטרנט תקינה" };
  }

  if (parsed.protocol !== "https:") {
    return { ok: false, error: "הקישור חייב להתחיל ב-https://" };
  }

  if (parsed.hostname.toLowerCase() !== "meet.google.com") {
    return { ok: false, error: "יש להזין קישור תקין ל-Google Meet (למשל https://meet.google.com/abc-defg-hij)" };
  }

  if (!MEET_LINK_PATH_PATTERN.test(parsed.pathname)) {
    return { ok: false, error: "כתובת ה-Meet אינה בפורמט הצפוי (למשל https://meet.google.com/abc-defg-hij)" };
  }

  return { ok: true, url: trimmed };
}

// -----------------------------------------------------------------------
// Documented, explicitly out-of-scope stretch phase: real Calendar/Meet
// integration
// -----------------------------------------------------------------------
//
// A future iteration could request the Google Calendar API scope (in
// addition to the current sign-in-only `openid email profile` — see
// src/modules/auth/google-oauth.ts), store a refresh token per user, and
// call calendar.events.insert with conferenceDataVersion: 1 to have Google
// auto-generate a real Meet link and calendar invites for both
// participants. That was deliberately NOT attempted this phase: it needs a
// consent screen for a new, more sensitive scope, secure refresh-token
// storage and rotation, and handling for token revocation/expiry — a
// meaningfully larger surface than this backlog item's scope. The
// manually-pasted-and-validated link above is the intentionally simpler
// fallback until that investment is made.
