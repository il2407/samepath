import { describe, expect, it } from "vitest";
import {
  evaluatePrivacy,
  hasAvailabilityOverlap,
  type EligibilityProfile,
  type PrivacyCheckInput,
} from "@/modules/privacy/engine";

function profile(overrides: Partial<EligibilityProfile> = {}): EligibilityProfile {
  return {
    userId: "user-a",
    userStatus: "ACTIVE",
    profileStatus: "ACTIVE",
    emailVerified: true,
    accessExpired: false,
    currentCompanyId: null,
    currentCompanyConfirmed: false,
    currentCompanyCorporateGroupId: null,
    blockEntireCorporateGroup: true,
    blockedCompanyIds: [],
    blockedUserIds: [],
    connectionFormat: "BOTH",
    timezone: "Asia/Jerusalem",
    availability: [{ dayOfWeek: 2, startMinute: 600, endMinute: 720 }],
    gender: null,
    genderPreference: "BOTH",
    ...overrides,
  };
}

function input(overrides: Partial<PrivacyCheckInput> = {}): PrivacyCheckInput {
  return {
    subject: profile({ userId: "subject" }),
    candidate: profile({ userId: "candidate" }),
    candidateNeverAgainBySubject: false,
    subjectNeverAgainByCandidate: false,
    ...overrides,
  };
}

describe("evaluatePrivacy — a fully compatible pair", () => {
  it("is allowed when nothing conflicts", () => {
    expect(evaluatePrivacy(input())).toEqual({ allowed: true });
  });
});

describe("evaluatePrivacy — each hard filter wins even when everything else is perfect", () => {
  it("rejects matching a user to themselves", () => {
    const subject = profile({ userId: "same" });
    const result = evaluatePrivacy(input({ subject, candidate: { ...subject } }));
    expect(result).toEqual({ allowed: false, reasonCode: "same_user" });
  });

  it("rejects a suspended candidate outright, regardless of other flags", () => {
    const result = evaluatePrivacy(
      input({ candidate: profile({ userId: "candidate", userStatus: "SUSPENDED" }) }),
    );
    expect(result).toEqual({ allowed: false, reasonCode: "safety_restriction" });
  });

  it("rejects a suspended subject", () => {
    const result = evaluatePrivacy(
      input({ subject: profile({ userId: "subject", userStatus: "SUSPENDED" }) }),
    );
    expect(result).toEqual({ allowed: false, reasonCode: "safety_restriction" });
  });

  it("rejects a paused candidate profile", () => {
    const result = evaluatePrivacy(
      input({ candidate: profile({ userId: "candidate", profileStatus: "PAUSED" }) }),
    );
    expect(result).toEqual({ allowed: false, reasonCode: "candidate_ineligible" });
  });

  it("rejects a draft/incomplete subject profile", () => {
    const result = evaluatePrivacy(
      input({ subject: profile({ userId: "subject", profileStatus: "INCOMPLETE" }) }),
    );
    expect(result).toEqual({ allowed: false, reasonCode: "subject_ineligible" });
  });

  it("rejects an unverified email", () => {
    const result = evaluatePrivacy(
      input({ candidate: profile({ userId: "candidate", emailVerified: false }) }),
    );
    expect(result).toEqual({ allowed: false, reasonCode: "candidate_ineligible" });
  });

  it("rejects a candidate whose access has expired", () => {
    const result = evaluatePrivacy(
      input({ candidate: profile({ userId: "candidate", accessExpired: true }) }),
    );
    expect(result).toEqual({ allowed: false, reasonCode: "candidate_ineligible" });
  });

  it("rejects two confirmed employees of the same current company", () => {
    const subject = profile({ userId: "subject", currentCompanyId: "co-1", currentCompanyConfirmed: true });
    const candidate = profile({ userId: "candidate", currentCompanyId: "co-1", currentCompanyConfirmed: true });
    expect(evaluatePrivacy(input({ subject, candidate }))).toEqual({
      allowed: false,
      reasonCode: "same_company",
    });
  });

  it("does NOT reject on company when neither side has confirmed their employer yet", () => {
    const subject = profile({ userId: "subject", currentCompanyId: "co-1", currentCompanyConfirmed: false });
    const candidate = profile({ userId: "candidate", currentCompanyId: "co-1", currentCompanyConfirmed: false });
    expect(evaluatePrivacy(input({ subject, candidate }))).toEqual({ allowed: true });
  });

  // Corporate-group blocking was removed (backlog item 6) — subsidiaries/
  // parents of a same-company match are no longer rejected on that basis
  // alone. The two tests that used to live here ("rejects subsidiaries of
  // the same corporate group when group-blocking is on" and "group-blocking
  // is a safe default") are superseded by the two tests immediately below,
  // which assert the new (opposite) behavior: different companies in the
  // same corporate group are now allowed, with or without
  // blockEntireCorporateGroup set — since evaluatePrivacy never reads that
  // field anymore.

  it("allows different companies in the same corporate group — corporate-group blocking was removed (backlog item 6)", () => {
    const subject = profile({
      userId: "subject",
      currentCompanyId: "co-1",
      currentCompanyConfirmed: true,
      currentCompanyCorporateGroupId: "group-x",
      blockEntireCorporateGroup: true,
    });
    const candidate = profile({
      userId: "candidate",
      currentCompanyId: "co-2",
      currentCompanyConfirmed: true,
      currentCompanyCorporateGroupId: "group-x",
      blockEntireCorporateGroup: true,
    });
    expect(evaluatePrivacy(input({ subject, candidate }))).toEqual({ allowed: true });
  });

  it("blockEntireCorporateGroup has no effect on the outcome, in any combination", () => {
    const base = { currentCompanyId: "co-1", currentCompanyConfirmed: true, currentCompanyCorporateGroupId: "group-x" };
    for (const subjectFlag of [true, false]) {
      for (const candidateFlag of [true, false]) {
        const subject = profile({ userId: "subject", ...base, blockEntireCorporateGroup: subjectFlag });
        const candidate = profile({
          userId: "candidate",
          ...base,
          currentCompanyId: "co-2",
          blockEntireCorporateGroup: candidateFlag,
        });
        expect(evaluatePrivacy(input({ subject, candidate }))).toEqual({ allowed: true });
      }
    }
  });

  it("does not reject different companies in different corporate groups", () => {
    const subject = profile({
      userId: "subject",
      currentCompanyId: "co-1",
      currentCompanyConfirmed: true,
      currentCompanyCorporateGroupId: "group-x",
    });
    const candidate = profile({
      userId: "candidate",
      currentCompanyId: "co-2",
      currentCompanyConfirmed: true,
      currentCompanyCorporateGroupId: "group-y",
    });
    expect(evaluatePrivacy(input({ subject, candidate }))).toEqual({ allowed: true });
  });

  it("rejects when the subject blocked the candidate's company", () => {
    const subject = profile({ userId: "subject", blockedCompanyIds: ["co-9"] });
    const candidate = profile({ userId: "candidate", currentCompanyId: "co-9", currentCompanyConfirmed: true });
    expect(evaluatePrivacy(input({ subject, candidate }))).toEqual({
      allowed: false,
      reasonCode: "company_blocked",
    });
  });

  it("rejects when the candidate blocked the subject's company (symmetric)", () => {
    const subject = profile({ userId: "subject", currentCompanyId: "co-9", currentCompanyConfirmed: true });
    const candidate = profile({ userId: "candidate", blockedCompanyIds: ["co-9"] });
    expect(evaluatePrivacy(input({ subject, candidate }))).toEqual({
      allowed: false,
      reasonCode: "company_blocked",
    });
  });

  it("rejects when the subject blocked the candidate user", () => {
    const subject = profile({ userId: "subject", blockedUserIds: ["candidate"] });
    const candidate = profile({ userId: "candidate" });
    expect(evaluatePrivacy(input({ subject, candidate }))).toEqual({
      allowed: false,
      reasonCode: "user_blocked",
    });
  });

  it("rejects when the candidate blocked the subject user (symmetric)", () => {
    const subject = profile({ userId: "subject" });
    const candidate = profile({ userId: "candidate", blockedUserIds: ["subject"] });
    expect(evaluatePrivacy(input({ subject, candidate }))).toEqual({
      allowed: false,
      reasonCode: "user_blocked",
    });
  });

  it("rejects when the subject previously said never-again about this candidate", () => {
    expect(evaluatePrivacy(input({ candidateNeverAgainBySubject: true }))).toEqual({
      allowed: false,
      reasonCode: "never_again",
    });
  });

  it("rejects when the candidate previously said never-again about this subject", () => {
    expect(evaluatePrivacy(input({ subjectNeverAgainByCandidate: true }))).toEqual({
      allowed: false,
      reasonCode: "never_again",
    });
  });

  it("rejects an incompatible connection-format requirement", () => {
    const subject = profile({ userId: "subject", connectionFormat: "ONE_ON_ONE" });
    const candidate = profile({ userId: "candidate", connectionFormat: "GROUP" });
    expect(evaluatePrivacy(input({ subject, candidate, requiredFormat: "ONE_ON_ONE" }))).toEqual({
      allowed: false,
      reasonCode: "incompatible_connection_type",
    });
  });

  it("allows BOTH-format users to satisfy any required format", () => {
    const subject = profile({ userId: "subject", connectionFormat: "BOTH" });
    const candidate = profile({ userId: "candidate", connectionFormat: "GROUP" });
    expect(evaluatePrivacy(input({ subject, candidate, requiredFormat: "GROUP" }))).toEqual({
      allowed: true,
    });
  });

  it("rejects same-timezone users with no overlapping availability", () => {
    const subject = profile({
      userId: "subject",
      availability: [{ dayOfWeek: 1, startMinute: 0, endMinute: 60 }],
    });
    const candidate = profile({
      userId: "candidate",
      availability: [{ dayOfWeek: 3, startMinute: 0, endMinute: 60 }],
    });
    expect(evaluatePrivacy(input({ subject, candidate }))).toEqual({
      allowed: false,
      reasonCode: "no_availability_overlap",
    });
  });

  it("does not reject on availability when either side hasn't set any yet", () => {
    const subject = profile({ userId: "subject", availability: [] });
    const candidate = profile({ userId: "candidate" });
    expect(evaluatePrivacy(input({ subject, candidate }))).toEqual({ allowed: true });
  });

  it("rejects a candidate whose gender doesn't match the subject's men/women-only preference", () => {
    const subject = profile({ userId: "subject", genderPreference: "FEMALE" });
    const candidate = profile({ userId: "candidate", gender: "MALE" });
    expect(evaluatePrivacy(input({ subject, candidate }))).toEqual({
      allowed: false,
      reasonCode: "incompatible_gender_preference",
    });
  });

  it("rejects a subject whose gender doesn't match the candidate's men/women-only preference (symmetric)", () => {
    const subject = profile({ userId: "subject", gender: "MALE" });
    const candidate = profile({ userId: "candidate", genderPreference: "FEMALE" });
    expect(evaluatePrivacy(input({ subject, candidate }))).toEqual({
      allowed: false,
      reasonCode: "incompatible_gender_preference",
    });
  });

  it("allows a candidate whose gender satisfies a men/women-only preference on both sides", () => {
    const subject = profile({ userId: "subject", gender: "FEMALE", genderPreference: "MALE" });
    const candidate = profile({ userId: "candidate", gender: "MALE", genderPreference: "FEMALE" });
    expect(evaluatePrivacy(input({ subject, candidate }))).toEqual({ allowed: true });
  });

  it("a BOTH preference (the default) applies no gender filter at all", () => {
    const subject = profile({ userId: "subject", gender: null, genderPreference: "BOTH" });
    const candidate = profile({ userId: "candidate", gender: "MALE", genderPreference: "BOTH" });
    expect(evaluatePrivacy(input({ subject, candidate }))).toEqual({ allowed: true });
  });

  it("rejects a men/women-only preference against an undisclosed (null) gender, since it can't be verified", () => {
    const subject = profile({ userId: "subject", genderPreference: "MALE" });
    const candidate = profile({ userId: "candidate", gender: null });
    expect(evaluatePrivacy(input({ subject, candidate }))).toEqual({
      allowed: false,
      reasonCode: "incompatible_gender_preference",
    });
  });
});

describe("evaluatePrivacy — privacy always wins over everything else", () => {
  it("still rejects a same-company pair even when every other signal is ideal", () => {
    // Same city, same language, perfect availability overlap, mutually
    // interested — a compatibility engine would score this pair very high.
    // The privacy gate must reject it regardless.
    const subject = profile({
      userId: "subject",
      currentCompanyId: "co-1",
      currentCompanyConfirmed: true,
      connectionFormat: "BOTH",
      availability: [{ dayOfWeek: 2, startMinute: 600, endMinute: 720 }],
    });
    const candidate = profile({
      userId: "candidate",
      currentCompanyId: "co-1",
      currentCompanyConfirmed: true,
      connectionFormat: "BOTH",
      availability: [{ dayOfWeek: 2, startMinute: 600, endMinute: 720 }],
    });
    expect(evaluatePrivacy(input({ subject, candidate })).allowed).toBe(false);
  });
});

describe("hasAvailabilityOverlap", () => {
  it("finds an overlap on the same day with intersecting time ranges", () => {
    expect(
      hasAvailabilityOverlap(
        "Asia/Jerusalem",
        [{ dayOfWeek: 2, startMinute: 600, endMinute: 720 }],
        "Asia/Jerusalem",
        [{ dayOfWeek: 2, startMinute: 660, endMinute: 780 }],
      ),
    ).toBe(true);
  });

  it("finds no overlap for adjacent, non-intersecting ranges on the same day", () => {
    expect(
      hasAvailabilityOverlap(
        "Asia/Jerusalem",
        [{ dayOfWeek: 2, startMinute: 600, endMinute: 720 }],
        "Asia/Jerusalem",
        [{ dayOfWeek: 2, startMinute: 720, endMinute: 840 }],
      ),
    ).toBe(false);
  });

  it("treats cross-timezone comparisons as indeterminate (passes)", () => {
    expect(
      hasAvailabilityOverlap(
        "Asia/Jerusalem",
        [{ dayOfWeek: 2, startMinute: 600, endMinute: 720 }],
        "America/New_York",
        [{ dayOfWeek: 5, startMinute: 0, endMinute: 60 }],
      ),
    ).toBe(true);
  });
});
