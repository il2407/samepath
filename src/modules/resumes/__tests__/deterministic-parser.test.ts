import { describe, expect, it } from "vitest";
import { parseResumeText, type KnownLabel } from "@/modules/resumes/deterministic-parser";

const skillLabels: KnownLabel[] = [
  { id: "skill-ts", labelHe: "טייפסקריפט", labelEn: "TypeScript" },
  { id: "skill-pg", labelHe: "פוסטגרס", labelEn: "PostgreSQL" },
  { id: "skill-react", labelHe: "ריאקט", labelEn: "React" },
];

const targetRoleLabels: KnownLabel[] = [
  { id: "role-backend", labelHe: "מפתח/ת Backend", labelEn: "Backend Developer" },
  { id: "role-frontend", labelHe: "מפתח/ת Frontend", labelEn: "Frontend Developer" },
];

const regionLabels: KnownLabel[] = [
  { id: "region-center", labelHe: "מרכז", labelEn: "Center" },
  { id: "region-north", labelHe: "צפון", labelEn: "North" },
];

describe("parseResumeText", () => {
  it("extracts a position with an explicit month/year range", () => {
    const text = "Acme Corp - Backend Developer\n01/2020 - 05/2022";
    const result = parseResumeText(text, [], []);
    expect(result.positions).toHaveLength(1);
    expect(result.positions[0]).toMatchObject({
      companyRaw: "Acme Corp",
      title: "Backend Developer",
      startYear: 2020,
      startMonth: 1,
      endYear: 2022,
      endMonth: 5,
      isCurrent: false,
    });
  });

  it("splits company and title from the same line as the date range", () => {
    const text = "Acme Corp - Backend Developer 01/2020 - 05/2022";
    const result = parseResumeText(text, [], []);
    expect(result.positions[0]).toMatchObject({ companyRaw: "Acme Corp", title: "Backend Developer" });
  });

  it("marks a role as current when the end token is a present-word (Hebrew or English)", () => {
    const he = parseResumeText("Acme Corp - Backend Developer\n01/2020 - הווה", [], []);
    expect(he.positions[0]).toMatchObject({ isCurrent: true, endYear: null, endMonth: null });

    const en = parseResumeText("Acme Corp - Backend Developer\n01/2020 - Present", [], []);
    expect(en.positions[0]).toMatchObject({ isCurrent: true, endYear: null, endMonth: null });
  });

  it("sets currentRoleTitleGuess from the current position's title", () => {
    const text = "Acme Corp - Backend Developer\n01/2020 - Present";
    const result = parseResumeText(text, [], []);
    expect(result.currentRoleTitleGuess).toBe("Backend Developer");
  });

  it("falls back to a year-only range", () => {
    const text = "Initech - QA Engineer\n2018 - 2020";
    const result = parseResumeText(text, [], []);
    expect(result.positions[0]).toMatchObject({ startYear: 2018, startMonth: 1, endYear: 2020, endMonth: 1 });
  });

  it("parses a Hebrew textual month/year range", () => {
    const text = "Acme Corp - Backend Developer\nינואר 2020 - מרץ 2022";
    const result = parseResumeText(text, [], []);
    expect(result.positions[0]).toMatchObject({
      companyRaw: "Acme Corp",
      title: "Backend Developer",
      startYear: 2020,
      startMonth: 1,
      endYear: 2022,
      endMonth: 3,
      isCurrent: false,
    });
  });

  it("parses an English textual month/year range, both full names and abbreviations", () => {
    const full = parseResumeText("Acme Corp - Backend Developer\nJanuary 2020 - March 2022", [], []);
    expect(full.positions[0]).toMatchObject({ startYear: 2020, startMonth: 1, endYear: 2022, endMonth: 3 });

    const abbrev = parseResumeText("Acme Corp - Backend Developer\nJan 2020 - Mar 2022", [], []);
    expect(abbrev.positions[0]).toMatchObject({ startYear: 2020, startMonth: 1, endYear: 2022, endMonth: 3 });
  });

  it('accepts a comma between a textual month and year (e.g. "January, 2020")', () => {
    const text = "Acme Corp - Backend Developer\nJanuary, 2020 - Present";
    const result = parseResumeText(text, [], []);
    expect(result.positions[0]).toMatchObject({ startYear: 2020, startMonth: 1, isCurrent: true });
  });

  it("does not mistake a Hebrew textual month name for the company name (regression)", () => {
    // Before the textual-month fix, RANGE_RE could only match the "2020 -
    // כיום" portion of this date line (no digits at the start of "ינואר" for
    // it to latch onto), leaving "ינואר" behind as an unmatched remainder
    // that extractPositions then misread as the company name.
    const text = "Acme Corp - Backend Developer\nינואר 2020 - כיום";
    const result = parseResumeText(text, [], []);
    expect(result.positions[0]).toMatchObject({
      companyRaw: "Acme Corp",
      title: "Backend Developer",
      startYear: 2020,
      startMonth: 1,
      isCurrent: true,
    });
  });

  it("does not mistake an English textual month name for the company name (regression)", () => {
    const text = "Acme Corp - Backend Developer\nJanuary 2020 - Present";
    const result = parseResumeText(text, [], []);
    expect(result.positions[0]).toMatchObject({ companyRaw: "Acme Corp", title: "Backend Developer", isCurrent: true });
  });

  it("uses the previous non-empty line as context when the date line has nothing else on it", () => {
    const text = "Globex Inc - Frontend Developer\n\n01/2019 - 12/2019";
    const result = parseResumeText(text, [], []);
    expect(result.positions[0].companyRaw).toBe("Globex Inc");
    expect(result.positions[0].title).toBe("Frontend Developer");
  });

  it("keeps the whole context line as companyRaw with an empty title when no separator is found", () => {
    const text = "Umbrella Corporation\n01/2019 - 12/2019";
    const result = parseResumeText(text, [], []);
    expect(result.positions[0]).toMatchObject({ companyRaw: "Umbrella Corporation", title: "" });
  });

  it("sorts multiple positions by start date, most recent first", () => {
    const text = ["Initech - Dev\n2015 - 2017", "Acme - Senior Dev\n01/2020 - Present", "Globex - Dev II\n2017 - 2020"].join(
      "\n",
    );
    const result = parseResumeText(text, [], []);
    expect(result.positions.map((p) => p.companyRaw)).toEqual(["Acme", "Globex", "Initech"]);
  });

  it("caps the number of extracted positions", () => {
    const lines: string[] = [];
    for (let year = 2000; year < 2000 + 12; year++) {
      lines.push(`Company ${year} - Role\n${year} - ${year + 1}`);
    }
    const result = parseResumeText(lines.join("\n"), [], []);
    expect(result.positions.length).toBeLessThanOrEqual(8);
  });

  it("ignores lines with no recognizable date range", () => {
    const text = "This resume has no dates at all, just prose.";
    const result = parseResumeText(text, [], []);
    expect(result.positions).toHaveLength(0);
    expect(result.currentRoleTitleGuess).toBeNull();
  });

  it("matches known skill labels by Hebrew or English label, case-insensitively", () => {
    const text = "Experienced with TypeScript and פוסטגרס. Also some react work.";
    const result = parseResumeText(text, skillLabels, []);
    expect(result.matchedTagIds.sort()).toEqual(["skill-pg", "skill-react", "skill-ts"]);
  });


  it("does not match a skill label that never appears in the text", () => {
    const text = "No relevant technologies mentioned here.";
    const result = parseResumeText(text, skillLabels, []);
    expect(result.matchedTagIds).toEqual([]);
  });

  it("matches known target-role labels by Hebrew or English label", () => {
    const text = "Experienced Backend Developer looking for new opportunities.";
    const result = parseResumeText(text, [], targetRoleLabels, []);
    expect(result.matchedTargetRoleIds).toEqual(["role-backend"]);
  });

  it("returns an empty array of matched target roles when none appear in the text", () => {
    const text = "A resume with no recognizable target-role labels.";
    const result = parseResumeText(text, [], targetRoleLabels, []);
    expect(result.matchedTargetRoleIds).toEqual([]);
  });

  it("matches at most one region — the first known label found, since region is a single-select field", () => {
    const text = "גר במרכז הארץ, עבד גם בצפון.";
    const result = parseResumeText(text, [], [], regionLabels);
    expect(result.matchedRegionId).toBe("region-center");
  });

  it("returns null for matchedRegionId when no known region label appears in the text", () => {
    const text = "No location mentioned anywhere in this text.";
    const result = parseResumeText(text, [], [], regionLabels);
    expect(result.matchedRegionId).toBeNull();
  });

  it("drafts a short-intro guess from the line right after a recognized summary heading", () => {
    const text = ["Summary", "Backend engineer with 5 years of experience building real-time systems.", "Experience", "Acme - Dev\n2020-2022"].join(
      "\n",
    );
    const result = parseResumeText(text, [], []);
    expect(result.shortIntroGuess).toBe("Backend engineer with 5 years of experience building real-time systems.");
  });

  it("recognizes a Hebrew summary heading (תקציר) the same way", () => {
    const text = ["תקציר", "מפתח/ת Backend עם ניסיון במערכות בזמן אמת."].join("\n");
    const result = parseResumeText(text, [], []);
    expect(result.shortIntroGuess).toBe("מפתח/ת Backend עם ניסיון במערכות בזמן אמת.");
  });

  it("returns null for shortIntroGuess when no summary/about heading is found", () => {
    const text = "Acme Corp - Backend Developer\n01/2020 - Present";
    const result = parseResumeText(text, [], []);
    expect(result.shortIntroGuess).toBeNull();
  });

  it("returns null for shortIntroGuess when the heading has no following content", () => {
    const text = "Summary";
    const result = parseResumeText(text, [], []);
    expect(result.shortIntroGuess).toBeNull();
  });

  it("returns null for shortIntroGuess when the line after the heading is too short to be real content", () => {
    const text = ["About", "N/A"].join("\n");
    const result = parseResumeText(text, [], []);
    expect(result.shortIntroGuess).toBeNull();
  });

  it("drafts a fullNameGuess from an explicit Hebrew label", () => {
    const text = ["שם: דנה כהן", "Summary"].join("\n");
    const result = parseResumeText(text, [], []);
    expect(result.fullNameGuess).toBe("דנה כהן");
  });

  it("drafts a fullNameGuess from an explicit English label", () => {
    const text = ["Name: John Smith", "Summary"].join("\n");
    const result = parseResumeText(text, [], []);
    expect(result.fullNameGuess).toBe("John Smith");
  });

  it("falls back to the first line when it plausibly looks like a name", () => {
    const text = ["Dana Cohen", "Backend Developer", "Acme Corp - Backend Developer\n01/2020 - Present"].join("\n");
    const result = parseResumeText(text, [], []);
    expect(result.fullNameGuess).toBe("Dana Cohen");
  });

  it("returns null for fullNameGuess when no label is found and the first line doesn't look like a name", () => {
    const text = "Acme Corp - Backend Developer\n01/2020 - Present";
    const result = parseResumeText(text, [], []);
    expect(result.fullNameGuess).toBeNull();
  });

  it("extracts a valid Israeli mobile phone number", () => {
    const text = "Contact me: 052-1234567 or by email.";
    const result = parseResumeText(text, [], []);
    expect(result.phoneGuess).toBe("0521234567");
  });

  it("extracts a valid Israeli landline phone number", () => {
    const text = "Office: 02-1234567";
    const result = parseResumeText(text, [], []);
    expect(result.phoneGuess).toBe("021234567");
  });

  it("extracts a valid +972 phone number", () => {
    const text = "Phone: +972-52-1234567";
    const result = parseResumeText(text, [], []);
    expect(result.phoneGuess).toBe("+972521234567");
  });

  it("returns null for phoneGuess when a digit sequence doesn't match a known Israeli phone shape", () => {
    const text = "Call 555-123-4567 for a reference.";
    const result = parseResumeText(text, [], []);
    expect(result.phoneGuess).toBeNull();
  });

  it("returns null for phoneGuess when no phone-shaped substring is present", () => {
    const text = "No contact details here.";
    const result = parseResumeText(text, [], []);
    expect(result.phoneGuess).toBeNull();
  });

  it("extracts and normalizes a LinkedIn URL with a full https scheme", () => {
    const text = "LinkedIn: https://www.linkedin.com/in/dana-cohen/";
    const result = parseResumeText(text, [], []);
    expect(result.linkedInUrlGuess).toBe("https://www.linkedin.com/in/dana-cohen");
  });

  it("extracts and normalizes a LinkedIn URL with no scheme", () => {
    const text = "linkedin.com/in/dana-cohen";
    const result = parseResumeText(text, [], []);
    expect(result.linkedInUrlGuess).toBe("https://www.linkedin.com/in/dana-cohen");
  });

  it("extracts and normalizes a LinkedIn URL with a country subdomain", () => {
    const text = "il.linkedin.com/in/dana-cohen";
    const result = parseResumeText(text, [], []);
    expect(result.linkedInUrlGuess).toBe("https://www.linkedin.com/in/dana-cohen");
  });

  it("returns null for linkedInUrlGuess when no linkedin.com/in/ pattern is present", () => {
    const text = "Find me on GitHub instead.";
    const result = parseResumeText(text, [], []);
    expect(result.linkedInUrlGuess).toBeNull();
  });

  it("is robust to decomposed-form (NFD) Hebrew text when matching labels", () => {
    // A base letter followed by a separate combining diacritic (as some PDF
    // generators emit Hebrew) renders identically to the precomposed form
    // but is a different sequence of code points until NFC-normalized.
    const decomposed = "טייפסקריפט".normalize("NFD");
    const result = parseResumeText(decomposed, skillLabels, []);
    expect(result.matchedTagIds).toEqual(["skill-ts"]);
  });

  it("never crashes on malformed/adversarial input and always returns a well-formed result", () => {
    const inputs = ["", "\n\n\n", "  ", "a".repeat(10_000), "-".repeat(500)];
    for (const input of inputs) {
      const result = parseResumeText(input, skillLabels, targetRoleLabels, regionLabels);
      expect(Array.isArray(result.positions)).toBe(true);
      expect(Array.isArray(result.matchedTagIds)).toBe(true);
      expect(Array.isArray(result.matchedTargetRoleIds)).toBe(true);
      expect(result.fullNameGuess === null || typeof result.fullNameGuess === "string").toBe(true);
      expect(result.phoneGuess === null || typeof result.phoneGuess === "string").toBe(true);
      expect(result.linkedInUrlGuess === null || typeof result.linkedInUrlGuess === "string").toBe(true);
    }
  });
});
