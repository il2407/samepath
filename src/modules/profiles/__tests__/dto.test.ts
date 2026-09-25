import { describe, expect, it } from "vitest";
import {
  deriveFirstName,
  formatAvailabilitySummary,
  toMidStageDTO,
  toPostMatchDTO,
  toPreMatchDTO,
  type RawProfileForDto,
} from "@/modules/profiles/dto";

function raw(overrides: Partial<RawProfileForDto> = {}): RawProfileForDto {
  return {
    professionalField: { labelHe: "הנדסת תוכנה" },
    seniorityBand: { labelHe: "מידלוול" },
    targetRoles: [{ labelHe: "מפתח/ת Backend" }],
    tags: [{ labelHe: "TypeScript" }, { labelHe: "PostgreSQL" }],
    shortIntro: "מפתח/ת עם ניסיון במערכות בזמן אמת.",
    connectionPreference: { format: "BOTH", cadence: "BOTH", mode: "ONLINE", reasons: ["SHARE_JOB_SEARCH"] },
    availabilitySlots: [{ dayOfWeek: 2, startMinute: 600, endMinute: 720 }],
    region: { labelHe: "מרכז" },
    company: { canonicalName: "Acme Corp" },
    cvVerifiedAt: null,
    experienceMonths: 60,
    disclosurePreference: {
      fullName: "מיכל כהן",
      shareCompanyPreMatch: false,
      shareFullNamePostMatch: false,
      photoStorageKey: null,
      photoMimeType: null,
      sharePhotoPostMatch: false,
      phoneNumber: null,
      linkedInUrl: null,
      shareLinkedInPostMatch: false,
      shareEmailPostMatch: false,
      sharePhonePostMatch: false,
    },
    userEmail: "michal@example.com",
    ...overrides,
  };
}

describe("formatAvailabilitySummary", () => {
  it("maps day+minute slots to Hebrew day/block labels", () => {
    expect(formatAvailabilitySummary([{ dayOfWeek: 0, startMinute: 500, endMinute: 600 }])).toEqual(["ראשון בוקר"]);
    expect(formatAvailabilitySummary([{ dayOfWeek: 6, startMinute: 800, endMinute: 900 }])).toEqual(["שבת צהריים"]);
    expect(formatAvailabilitySummary([{ dayOfWeek: 3, startMinute: 1100, endMinute: 1200 }])).toEqual(["רביעי ערב"]);
  });

  it("de-duplicates repeated day/block combinations", () => {
    const summary = formatAvailabilitySummary([
      { dayOfWeek: 2, startMinute: 500, endMinute: 600 },
      { dayOfWeek: 2, startMinute: 550, endMinute: 650 },
    ]);
    expect(summary).toEqual(["שלישי בוקר"]);
  });
});

describe("toPreMatchDTO", () => {
  it("includes only the spec's allowed pre-match fields", () => {
    const dto = toPreMatchDTO(raw(), false);
    expect(dto).toEqual({
      professionalField: "הנדסת תוכנה",
      seniorityBand: "מידלוול",
      targetRoles: ["מפתח/ת Backend"],
      skillsAndDomains: ["TypeScript", "PostgreSQL"],
      shortIntro: "מפתח/ת עם ניסיון במערכות בזמן אמת.",
      connectionFormat: "BOTH",
      connectionCadence: "BOTH",
      connectionMode: "ONLINE",
      reasons: ["SHARE_JOB_SEARCH"],
      availabilitySummary: ["שלישי בוקר"],
      company: null,
      cvVerified: false,
      yearsOfExperience: 5,
    });
  });

  describe("cvVerified", () => {
    it("is false when the candidate has no cvVerifiedAt on record", () => {
      expect(toPreMatchDTO(raw(), false).cvVerified).toBe(false);
    });

    it("is true once cvVerifiedAt is set, regardless of when", () => {
      expect(toPreMatchDTO(raw({ cvVerifiedAt: new Date("2026-01-01") }), false).cvVerified).toBe(true);
    });
  });

  it("never includes name, first name, photo, resume, email, phone, LinkedIn, or location keys at all", () => {
    const dto = toPreMatchDTO(raw(), true) as unknown as Record<string, unknown>;
    const forbiddenKeys = [
      "displayName",
      "fullName",
      "firstName",
      "photo",
      "photoUrl",
      "resume",
      "resumeUrl",
      "email",
      "phone",
      "phoneNumber",
      "linkedIn",
      "linkedInUrl",
      "region",
      "location",
    ];
    for (const key of forbiddenKeys) {
      expect(dto).not.toHaveProperty(key);
    }
  });

  describe("yearsOfExperience — unconditional, no employer names leaked", () => {
    it("rounds down whole months into years", () => {
      expect(toPreMatchDTO(raw({ experienceMonths: 47 }), false).yearsOfExperience).toBe(3);
    });

    it("is null when there is no recorded experience at all (0 months)", () => {
      expect(toPreMatchDTO(raw({ experienceMonths: 0 }), false).yearsOfExperience).toBeNull();
    });

    it("is shown regardless of shareCompanyPreMatch on either side", () => {
      expect(toPreMatchDTO(raw({ experienceMonths: 60 }), false).yearsOfExperience).toBe(5);
      expect(toPreMatchDTO(raw({ experienceMonths: 60 }), true).yearsOfExperience).toBe(5);
    });
  });

  describe("company — reciprocal visibility (backlog item 8)", () => {
    const sharingCandidate = () => raw({ disclosurePreference: { ...raw().disclosurePreference!, shareCompanyPreMatch: true } });

    it("stays null when neither side opted into shareCompanyPreMatch", () => {
      expect(toPreMatchDTO(raw(), false).company).toBeNull();
    });

    it("stays null when only the candidate opted in but the viewer did not", () => {
      expect(toPreMatchDTO(sharingCandidate(), false).company).toBeNull();
    });

    it("stays null when only the viewer opted in but the candidate did not", () => {
      expect(toPreMatchDTO(raw(), true).company).toBeNull();
    });

    it("reveals the employer only when BOTH the viewer and the candidate opted in", () => {
      expect(toPreMatchDTO(sharingCandidate(), true).company).toBe("Acme Corp");
    });

    it("stays null when both opted in but there's no current company on record", () => {
      const dto = toPreMatchDTO(
        raw({ company: null, disclosurePreference: { ...raw().disclosurePreference!, shareCompanyPreMatch: true } }),
        true,
      );
      expect(dto.company).toBeNull();
    });
  });
});

describe("deriveFirstName", () => {
  it("takes the first whitespace-separated token of a multi-word name", () => {
    expect(deriveFirstName("מיכל כהן")).toBe("מיכל");
    expect(deriveFirstName("Jane Q. Public")).toBe("Jane");
  });

  it("returns the whole value for a single-word name — nothing to split", () => {
    expect(deriveFirstName("Cher")).toBe("Cher");
  });

  it("collapses extra internal whitespace", () => {
    expect(deriveFirstName("  מיכל   כהן  ")).toBe("מיכל");
  });

  it("returns null for null, empty, or whitespace-only input — never an empty string", () => {
    expect(deriveFirstName(null)).toBeNull();
    expect(deriveFirstName("")).toBeNull();
    expect(deriveFirstName("   ")).toBeNull();
  });
});

describe("toMidStageDTO — the mutual-interest stage, before a real Connection exists", () => {
  it("includes everything toPreMatchDTO includes", () => {
    const dto = toMidStageDTO(raw(), false);
    expect(dto.targetRoles).toEqual(["מפתח/ת Backend"]);
    expect(dto.shortIntro).toBe("מפתח/ת עם ניסיון במערכות בזמן אמת.");
  });

  it("firstName is null when the candidate has not opted into shareFullNamePostMatch (the early-reveal gate)", () => {
    const dto = toMidStageDTO(raw({ disclosurePreference: { ...raw().disclosurePreference!, shareFullNamePostMatch: false } }), false);
    expect(dto.firstName).toBeNull();
  });

  it("firstName is the first name once the candidate opted in", () => {
    const dto = toMidStageDTO(
      raw({ disclosurePreference: { ...raw().disclosurePreference!, shareFullNamePostMatch: true, fullName: "מיכל כהן" } }),
      false,
    );
    expect(dto.firstName).toBe("מיכל");
  });

  it("firstName is null when opted in but fullName was never set (old account) — never an empty string", () => {
    const dto = toMidStageDTO(
      raw({ disclosurePreference: { ...raw().disclosurePreference!, shareFullNamePostMatch: true, fullName: null } }),
      false,
    );
    expect(dto.firstName).toBeNull();
  });

  it("firstName handles a single-word name gracefully", () => {
    const dto = toMidStageDTO(
      raw({ disclosurePreference: { ...raw().disclosurePreference!, shareFullNamePostMatch: true, fullName: "Cher" } }),
      false,
    );
    expect(dto.firstName).toBe("Cher");
  });

  it("still applies the reciprocal company-visibility rule, same as pre-match", () => {
    const bothShare = raw({
      disclosurePreference: { ...raw().disclosurePreference!, shareCompanyPreMatch: true },
    });
    expect(toMidStageDTO(bothShare, false).company).toBeNull();
    expect(toMidStageDTO(bothShare, true).company).toBe("Acme Corp");
  });

  it("never includes full name, email, phone, or LinkedIn keys — only firstName", () => {
    const dto = toMidStageDTO(raw(), true) as unknown as Record<string, unknown>;
    expect(dto).toHaveProperty("firstName");
    for (const key of ["fullName", "email", "phone", "phoneNumber", "linkedIn", "linkedInUrl", "region", "location"]) {
      expect(dto).not.toHaveProperty(key);
    }
  });
});

describe("toPostMatchDTO — the final CONNECTED stage (a real Connection exists)", () => {
  it("automatically reveals full name, employer, and location — no per-field toggle required (backlog item 10 design decision)", () => {
    const dto = toPostMatchDTO(raw());
    expect(dto.fullName).toBe("מיכל כהן");
    expect(dto.company).toBe("Acme Corp");
    expect(dto.region).toBe("מרכז");
  });

  describe("email — gated behind the owner's own shareEmailPostMatch, never automatic (contact-info carve-out)", () => {
    it("is null when the candidate has not opted into shareEmailPostMatch", () => {
      const dto = toPostMatchDTO(raw({ disclosurePreference: { ...raw().disclosurePreference!, shareEmailPostMatch: false } }));
      expect(dto.email).toBeNull();
    });

    it("is revealed once the candidate opts in", () => {
      const dto = toPostMatchDTO(raw({ disclosurePreference: { ...raw().disclosurePreference!, shareEmailPostMatch: true } }));
      expect(dto.email).toBe("michal@example.com");
    });
  });

  describe("phoneNumber — gated behind the owner's own sharePhonePostMatch, never automatic (contact-info carve-out)", () => {
    it("is null when a number is on file but the candidate has not opted into sharePhonePostMatch", () => {
      const dto = toPostMatchDTO(
        raw({ disclosurePreference: { ...raw().disclosurePreference!, phoneNumber: "050-0000000", sharePhonePostMatch: false } }),
      );
      expect(dto.phoneNumber).toBeNull();
    });

    it("is null when opted in but no number was ever entered — never fabricated", () => {
      const dto = toPostMatchDTO(
        raw({ disclosurePreference: { ...raw().disclosurePreference!, phoneNumber: null, sharePhonePostMatch: true } }),
      );
      expect(dto.phoneNumber).toBeNull();
    });

    it("is revealed once a number is on file and the candidate opted in", () => {
      const dto = toPostMatchDTO(
        raw({ disclosurePreference: { ...raw().disclosurePreference!, phoneNumber: "050-0000000", sharePhonePostMatch: true } }),
      );
      expect(dto.phoneNumber).toBe("050-0000000");
    });
  });

  it("company is null when there's simply no current company on record, automatic reveal notwithstanding", () => {
    expect(toPostMatchDTO(raw({ company: null })).company).toBeNull();
  });

  it("fullName is null for an old account that never set one — resolveDisplayName's nickname fallback (connections/service.ts) handles this", () => {
    expect(toPostMatchDTO(raw({ disclosurePreference: { ...raw().disclosurePreference!, fullName: null } })).fullName).toBeNull();
  });

  describe("linkedInUrl — automatic once a Connection exists, same as the other post-match fields", () => {
    it("is revealed automatically with no separate toggle, even when shareLinkedInPostMatch is false", () => {
      const dto = toPostMatchDTO(
        raw({ disclosurePreference: { ...raw().disclosurePreference!, linkedInUrl: "https://linkedin.com/in/michal", shareLinkedInPostMatch: false } }),
      );
      expect(dto.linkedInUrl).toBe("https://linkedin.com/in/michal");
    });

    it("stays null when no URL was ever entered — never fabricated", () => {
      const dto = toPostMatchDTO(
        raw({ disclosurePreference: { ...raw().disclosurePreference!, linkedInUrl: null, shareLinkedInPostMatch: true } }),
      );
      expect(dto.linkedInUrl).toBeNull();
    });

    it("is revealed when a URL is on file", () => {
      const dto = toPostMatchDTO(
        raw({ disclosurePreference: { ...raw().disclosurePreference!, linkedInUrl: "https://linkedin.com/in/michal", shareLinkedInPostMatch: true } }),
      );
      expect(dto.linkedInUrl).toBe("https://linkedin.com/in/michal");
    });
  });

  it("still never includes a linkedInUrl key pre-match or mid-stage — only once CONNECTED", () => {
    const preMatch = toPreMatchDTO(raw(), true) as unknown as Record<string, unknown>;
    const midStage = toMidStageDTO(raw(), true) as unknown as Record<string, unknown>;
    expect(preMatch).not.toHaveProperty("linkedInUrl");
    expect(midStage).not.toHaveProperty("linkedInUrl");
  });

  it("still includes every pre-match field unchanged", () => {
    const dto = toPostMatchDTO(raw());
    expect(dto.targetRoles).toEqual(["מפתח/ת Backend"]);
    expect(dto.shortIntro).toBe("מפתח/ת עם ניסיון במערכות בזמן אמת.");
  });
});
