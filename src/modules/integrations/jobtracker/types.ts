// Proposed shapes for a *future* JobTracker Pro integration (spec §9B).
// Types only — nothing here is imported by any route, action, service, or
// component in this app, no Prisma model backs it, and no client or sync
// job exists. See docs/jobtracker-integration.md for the privacy boundary
// this was designed against before building anything real.

/** What a user has explicitly opted to share — scoped consent, never all-or-nothing. */
export type JobTrackerSyncScope = "COMPANY_DIRECTORY" | "PUBLISHED_INTERVIEW_LIBRARY" | "OWN_PROFESSIONAL_BASICS";

/**
 * Records that a user connected their JobTracker Pro account. `tokenRef` is
 * a reference to wherever the real credential is stored (e.g. a secrets
 * manager key) — this shape deliberately never carries the token itself.
 */
export interface JobTrackerLinkedAccount {
  userId: string;
  tokenRef: string;
  grantedScopes: JobTrackerSyncScope[];
  linkedAt: Date;
  revokedAt: Date | null;
}

export interface JobTrackerCompanyDirectoryEntry {
  companyId: string;
  canonicalName: string;
  aliases: string[];
}

/** Only ever built from InterviewExperience rows already PUBLISHED and already author-anonymous — see the schema's authorId comment. */
export interface JobTrackerInterviewLibraryEntry {
  experienceId: string;
  companyName: string;
  periodYear: number;
  periodQuarter: number;
  processDescription: string;
  questionTexts: string[];
}

/** The requesting user's own selections only — never another user's, even if reachable through a match or group. */
export interface JobTrackerOwnProfessionalBasics {
  professionalFieldLabel: string;
  targetRoleLabels: string[];
  seniorityBandLabel: string | null;
}

/** The read-only payload SamePath would hand over for a given granted scope. Deliberately excludes anything from MatchSuggestion, Connection, Group, or PrivacyDecisionAudit — see docs/jobtracker-integration.md. */
export interface JobTrackerExportPayload {
  scope: JobTrackerSyncScope;
  companyDirectory?: JobTrackerCompanyDirectoryEntry[];
  interviewLibrary?: JobTrackerInterviewLibraryEntry[];
  ownProfessionalBasics?: JobTrackerOwnProfessionalBasics;
  exportedAt: Date;
}
