import { describe, expect, it } from "vitest";
import { parseResumeText, type KnownLabel } from "@/modules/resumes/deterministic-parser";

const skillLabels: KnownLabel[] = [
  { id: "skill-ts", labelHe: "טייפסקריפט", labelEn: "TypeScript" },
  { id: "skill-pg", labelHe: "פוסטגרס", labelEn: "PostgreSQL" },
  { id: "skill-react", labelHe: "ריאקט", labelEn: "React" },
];

const languageLabels: KnownLabel[] = [
  { id: "lang-he", labelHe: "עברית", labelEn: "Hebrew" },
  { id: "lang-en", labelHe: "אנגלית", labelEn: "English" },
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

  it("matches known language labels", () => {
    const text = "שפות: עברית (שפת אם), English (fluent)";
    const result = parseResumeText(text, [], languageLabels);
    expect(result.matchedTagIds).toEqual([]);
    expect(result.matchedLanguageIds.sort()).toEqual(["lang-en", "lang-he"]);
  });

  it("does not match a skill label that never appears in the text", () => {
    const text = "No relevant technologies mentioned here.";
    const result = parseResumeText(text, skillLabels, []);
    expect(result.matchedTagIds).toEqual([]);
  });
});
