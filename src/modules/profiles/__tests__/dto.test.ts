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
    languages: [{ labelHe: "עברית" }],
    shortIntro: "מפתח/ת עם ניסיון במערכות בזמן אמת.",
    connectionPreference: { format: "BOTH", cadence: "BOTH", mode: "ONLINE", reasons: ["SHARE_JOB_SEARCH"] },
    availabilitySlots: [{ dayOfWeek: 2, startMinute: 600, endMinute: 720 }],
    region: { labelHe: "מרכז" },
    company: { canonicalName: "Acme Corp" },
    cvVerifiedAt: null,
    disclosurePreference: {
      fullName: "מיכל כהן",
      shareCompanyPreMatch: false,
      shareFullNamePostMatch: false,
      photoStorageKey: null,
      photoMimeType: null,
      sharePhotoPostMatch: false,
      phoneNumber: null,
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
      languages: ["עברית"],
      shortIntro: "מפתח/ת עם ניסיון במערכות בזמן אמת.",
      connectionFormat: "BOTH",
      connectionCadence: "BOTH",
      connectionMode: "ONLINE",
      reasons: ["SHARE_JOB_SEARCH"],
      availabilitySummary: ["שלישי בוקר"],
      company: null,
      cvVerified: false,
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
  it("automatically reveals full name, employer, location, email, and phone — no per-field toggle required (backlog item 10 design decision)", () => {
    const dto = toPostMatchDTO(raw());
    expect(dto.fullName).toBe("מיכל כהן");
    expect(dto.company).toBe("Acme Corp");
    expect(dto.region).toBe("מרכז");
    expect(dto.email).toBe("michal@example.com");
    // phoneNumber stays null here only because raw()'s default has no
    // phoneNumber on file at all — see the next test for the case where one exists.
    expect(dto.phoneNumber).toBeNull();
  });

  it("reveals a phone number automatically once one is on file, with no separate toggle", () => {
    const dto = toPostMatchDTO(raw({ disclosurePreference: { ...raw().disclosurePreference!, phoneNumber: "050-0000000" } }));
    expect(dto.phoneNumber).toBe("050-0000000");
  });

  it("company is null when there's simply no current company on record, automatic reveal notwithstanding", () => {
    expect(toPostMatchDTO(raw({ company: null })).company).toBeNull();
  });

  it("fullName is null for an old account that never set one — resolveDisplayName's nickname fallback (connections/service.ts) handles this", () => {
    expect(toPostMatchDTO(raw({ disclosurePreference: { ...raw().disclosurePreference!, fullName: null } })).fullName).toBeNull();
  });

  it("never includes a linkedInUrl key at all — LinkedIn is structurally removed, not merely hidden", () => {
    const dto = toPostMatchDTO(raw()) as unknown as Record<string, unknown>;
    expect(dto).not.toHaveProperty("linkedInUrl");
  });

  it("still includes every pre-match field unchanged", () => {
    const dto = toPostMatchDTO(raw());
    expect(dto.targetRoles).toEqual(["מפתח/ת Backend"]);
    expect(dto.shortIntro).toBe("מפתח/ת עם ניסיון במערכות בזמן אמת.");
  });
});
