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
    disclosurePreference: {
      preMatchDisplayMode: "ALIAS",
      aliasText: "מ.",
      firstName: null,
      fullName: "מיכל כהן",
      shareFullNamePostMatch: false,
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
      displayName: "מ.",
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
    });
  });

  it("never includes name, photo, employer, resume, email, phone, LinkedIn, or location keys at all", () => {
    const dto = toPreMatchDTO(raw()) as unknown as Record<string, unknown>;
    const forbiddenKeys = [
      "fullName",
      "firstName",
      "photo",
      "photoUrl",
      "employer",
      "currentCompany",
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

  it("shows the first name when that's the chosen pre-match display mode", () => {
    const dto = toPreMatchDTO(
      raw({
        disclosurePreference: {
          preMatchDisplayMode: "FIRST_NAME",
          aliasText: null,
          firstName: "מיכל",
          fullName: "מיכל כהן",
          shareFullNamePostMatch: false,
          sharePhotoPostMatch: false,
          shareLinkedInPostMatch: false,
          linkedInUrl: null,
          sharePreciseLocationPostMatch: false,
          shareEmailPostMatch: false,
          sharePhonePostMatch: false,
          phoneNumber: null,
        },
      }),
    );
    expect(dto.displayName).toBe("מיכל");
  });

  it("falls back to a generic label when no disclosure preference exists yet", () => {
    const dto = toPreMatchDTO(raw({ disclosurePreference: null }));
    expect(dto.displayName).toBe("משתמש/ת SamePath");
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
  });

  it("reveals only the fields the candidate explicitly opted into, and nothing more", () => {
    const dto = toPostMatchDTO(
      raw({
        disclosurePreference: {
          preMatchDisplayMode: "ALIAS",
          aliasText: "מ.",
          firstName: null,
          fullName: "מיכל כהן",
          shareFullNamePostMatch: true,
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
