import { describe, expect, it } from "vitest";
import { formatAvailabilitySummary, toPostMatchDTO, toPreMatchDTO, type RawProfileForDto } from "@/modules/profiles/dto";

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
      shareLinkedInPostMatch: false,
      linkedInUrl: null,
      sharePreciseLocationPostMatch: false,
      shareEmailPostMatch: false,
      sharePhonePostMatch: false,
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
    const dto = toPreMatchDTO(raw());
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
      expect(toPreMatchDTO(raw()).cvVerified).toBe(false);
    });

    it("is true once cvVerifiedAt is set, regardless of when", () => {
      expect(toPreMatchDTO(raw({ cvVerifiedAt: new Date("2026-01-01") })).cvVerified).toBe(true);
    });
  });

  it("never includes name, photo, resume, email, phone, LinkedIn, or location keys at all", () => {
    const dto = toPreMatchDTO(raw()) as unknown as Record<string, unknown>;
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

  describe("company (the one opt-in pre-match exception)", () => {
    it("stays null when the candidate has not opted into shareCompanyPreMatch", () => {
      const dto = toPreMatchDTO(raw());
      expect(dto.company).toBeNull();
    });

    it("reveals the employer only once the candidate explicitly opts in", () => {
      const dto = toPreMatchDTO(
        raw({ disclosurePreference: { ...raw().disclosurePreference!, shareCompanyPreMatch: true } }),
      );
      expect(dto.company).toBe("Acme Corp");
    });

    it("stays null when opted in but there's no current company on record", () => {
      const dto = toPreMatchDTO(
        raw({
          company: null,
          disclosurePreference: { ...raw().disclosurePreference!, shareCompanyPreMatch: true },
        }),
      );
      expect(dto.company).toBeNull();
    });
  });
});

describe("toPostMatchDTO", () => {
  it("reveals nothing extra when the candidate opted out of everything", () => {
    const dto = toPostMatchDTO(raw());
    expect(dto.fullName).toBeNull();
    expect(dto.linkedInUrl).toBeNull();
    expect(dto.region).toBeNull();
    expect(dto.email).toBeNull();
    expect(dto.phoneNumber).toBeNull();
    expect(dto.company).toBeNull();
  });

  it("reveals only the fields the candidate explicitly opted into, and nothing more", () => {
    const dto = toPostMatchDTO(
      raw({
        disclosurePreference: {
          fullName: "מיכל כהן",
          shareCompanyPreMatch: true,
          shareFullNamePostMatch: true,
          photoStorageKey: null,
          photoMimeType: null,
          sharePhotoPostMatch: false,
          shareLinkedInPostMatch: false,
          linkedInUrl: "https://linkedin.com/in/michal",
          sharePreciseLocationPostMatch: false,
          shareEmailPostMatch: true,
          sharePhonePostMatch: false,
          phoneNumber: "050-0000000",
        },
      }),
    );
    expect(dto.fullName).toBe("מיכל כהן");
    expect(dto.email).toBe("michal@example.com");
    expect(dto.company).toBe("Acme Corp");
    // LinkedIn, location, and phone were NOT opted into — must stay hidden
    // even though the underlying data exists.
    expect(dto.linkedInUrl).toBeNull();
    expect(dto.region).toBeNull();
    expect(dto.phoneNumber).toBeNull();
  });

  it("still includes every pre-match field unchanged", () => {
    const dto = toPostMatchDTO(raw());
    expect(dto.targetRoles).toEqual(["מפתח/ת Backend"]);
    expect(dto.shortIntro).toBe("מפתח/ת עם ניסיון במערכות בזמן אמת.");
  });
});
