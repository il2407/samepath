// Pure logic, no DB/framework import — backend validation for a Google Meet
// link, whether pasted manually or generated via the Meet API v2 (see
// src/modules/auth/google-meet.ts and generateMeetLink in service.ts). Every
// meetLink written to a MeetingProposal, regardless of source, is validated
// here first — never trust a frontend `type="url"` input, or the shape of an
// API response, alone (item 14.9).

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
// Still out of scope: real Calendar integration
// -----------------------------------------------------------------------
//
// Real Meet link generation is implemented (Meet API v2's spaces.create, via
// an incremental-consent grant — see src/modules/auth/google-meet.ts,
// GoogleMeetGrant in schema.prisma, and generateMeetLink in service.ts).
// What remains out of scope is the Calendar API: no calendar event or invite
// is auto-created for either participant, since that would require the
// separate, more sensitive Calendar scope and its own consent screen. The
// manually-pasted-link path above remains available as a fallback (e.g. for
// a Meet link created outside the app, or a user who declines the Google
// Meet consent screen).
