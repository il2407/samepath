import { describe, expect, it, vi } from "vitest";
import type Anthropic from "@anthropic-ai/sdk";
import { AiResumeParser } from "@/modules/resumes/parser";
import type { KnownLabel } from "@/modules/resumes/deterministic-parser";

const knownTags: KnownLabel[] = [
  { id: "tag-1", labelHe: "פיתוח backend", labelEn: "Backend Development" },
  { id: "tag-2", labelHe: "עיצוב UX", labelEn: "UX Design" },
];
const knownTargetRoles: KnownLabel[] = [{ id: "role-1", labelHe: "מפתח/ת Backend", labelEn: "Backend Developer" }];
const knownRegions: KnownLabel[] = [{ id: "region-1", labelHe: "מרכז", labelEn: "Center" }];

const context = { knownTags, knownTargetRoles, knownRegions };

function fakeClient(toolInput: unknown) {
  const create = vi.fn().mockResolvedValue({
    content: [{ type: "tool_use", id: "toolu_1", name: "extract_resume_data", input: toolInput }],
  });
  return { messages: { create } } as unknown as Anthropic;
}

describe("AiResumeParser", () => {
  it("forwards a well-formed extraction and includes only known ids", async () => {
    const client = fakeClient({
      positions: [
        { companyRaw: "Acme Corp", title: "Backend Developer", startYear: 2020, startMonth: 1, endYear: null, endMonth: null, isCurrent: true },
      ],
      currentRoleTitleGuess: "Backend Developer",
      matchedTagIds: ["tag-1"],
      matchedTargetRoleIds: ["role-1"],
      matchedRegionId: "region-1",
      shortIntroGuess: "Backend developer with 5 years of experience.",
    });

    const result = await new AiResumeParser(client).parse("Acme Corp - Backend Developer\n01/2020 - Present", context);

    expect(result.positions).toEqual([
      { companyRaw: "Acme Corp", title: "Backend Developer", startYear: 2020, startMonth: 1, endYear: null, endMonth: null, isCurrent: true },
    ]);
    expect(result.matchedTagIds).toEqual(["tag-1"]);
    expect(result.matchedTargetRoleIds).toEqual(["role-1"]);
    expect(result.matchedRegionId).toBe("region-1");
    expect(result.shortIntroGuess).toBe("Backend developer with 5 years of experience.");
  });

  it("forwards a composed aiSummaryGuess distinct from shortIntroGuess, and caps it at 400 characters", async () => {
    const composed = "a".repeat(450);
    const client = fakeClient({
      positions: [],
      currentRoleTitleGuess: null,
      matchedTagIds: [],
      matchedTargetRoleIds: [],
      matchedRegionId: null,
      shortIntroGuess: null,
      aiSummaryGuess: composed,
    });

    const result = await new AiResumeParser(client).parse("some text", context);

    expect(result.aiSummaryGuess).toHaveLength(400);
    expect(result.aiSummaryGuess).toBe(composed.slice(0, 400));
  });

  it("leaves aiSummaryGuess null when the résumé is too sparse to compose one", async () => {
    const client = fakeClient({
      positions: [],
      currentRoleTitleGuess: null,
      matchedTagIds: [],
      matchedTargetRoleIds: [],
      matchedRegionId: null,
      shortIntroGuess: null,
      aiSummaryGuess: null,
    });

    const result = await new AiResumeParser(client).parse("some text", context);

    expect(result.aiSummaryGuess).toBeNull();
  });

  it("forwards a well-formed fullNameGuess, phoneGuess, and linkedInUrlGuess", async () => {
    const client = fakeClient({
      positions: [],
      currentRoleTitleGuess: null,
      matchedTagIds: [],
      matchedTargetRoleIds: [],
      matchedRegionId: null,
      shortIntroGuess: null,
      fullNameGuess: "Dana Cohen",
      phoneGuess: "052-1234567",
      linkedInUrlGuess: "https://www.linkedin.com/in/dana-cohen/",
    });

    const result = await new AiResumeParser(client).parse("some text", context);

    expect(result.fullNameGuess).toBe("Dana Cohen");
    expect(result.phoneGuess).toBe("0521234567");
    expect(result.linkedInUrlGuess).toBe("https://www.linkedin.com/in/dana-cohen");
  });

  it("re-validates phoneGuess and linkedInUrlGuess against strict patterns rather than trusting Claude's raw string", async () => {
    const client = fakeClient({
      positions: [],
      currentRoleTitleGuess: null,
      matchedTagIds: [],
      matchedTargetRoleIds: [],
      matchedRegionId: null,
      shortIntroGuess: null,
      fullNameGuess: null,
      phoneGuess: "555-123-4567",
      linkedInUrlGuess: "https://example.com/not-linkedin",
    });

    const result = await new AiResumeParser(client).parse("some text", context);

    expect(result.phoneGuess).toBeNull();
    expect(result.linkedInUrlGuess).toBeNull();
  });

  it("drops ids that are not in the known-label context, even if Claude returns them", async () => {
    const client = fakeClient({
      positions: [],
      currentRoleTitleGuess: null,
      matchedTagIds: ["tag-1", "hallucinated-tag"],
      matchedTargetRoleIds: [],
      matchedRegionId: "hallucinated-region",
      shortIntroGuess: null,
    });

    const result = await new AiResumeParser(client).parse("some text", context);

    expect(result.matchedTagIds).toEqual(["tag-1"]);
    expect(result.matchedRegionId).toBeNull();
  });

  it("dedupes matched ids even if Claude's tool-use output repeats one (e.g. a skill evidenced in multiple resume sections)", async () => {
    const client = fakeClient({
      positions: [],
      currentRoleTitleGuess: null,
      matchedTagIds: ["tag-1", "tag-2", "tag-1"],
      matchedTargetRoleIds: ["role-1", "role-1"],
      matchedRegionId: null,
      shortIntroGuess: null,
    });

    const result = await new AiResumeParser(client).parse("some text", context);

    expect(result.matchedTagIds).toEqual(["tag-1", "tag-2"]);
    expect(result.matchedTargetRoleIds).toEqual(["role-1"]);
  });

  it("caps positions at 8 even if the model returns more", async () => {
    const positions = Array.from({ length: 12 }, (_, i) => ({
      companyRaw: `Company ${i}`,
      title: "Engineer",
      startYear: 2010 + i,
      startMonth: 1,
      endYear: null,
      endMonth: null,
      isCurrent: false,
    }));
    const client = fakeClient({
      positions,
      currentRoleTitleGuess: null,
      matchedTagIds: [],
      matchedTargetRoleIds: [],
      matchedRegionId: null,
      shortIntroGuess: null,
    });

    const result = await new AiResumeParser(client).parse("some text", context);
    expect(result.positions).toHaveLength(8);
  });

  it("throws when the response contains no tool_use block", async () => {
    const client = { messages: { create: vi.fn().mockResolvedValue({ content: [{ type: "text", text: "oops" }] }) } } as unknown as Anthropic;
    await expect(new AiResumeParser(client).parse("some text", context)).rejects.toThrow(/tool_use/);
  });

  it("forces the extraction tool via tool_choice and sends a system prompt", async () => {
    const client = fakeClient({
      positions: [],
      currentRoleTitleGuess: null,
      matchedTagIds: [],
      matchedTargetRoleIds: [],
      matchedRegionId: null,
      shortIntroGuess: null,
    });

    await new AiResumeParser(client).parse("some text", context);

    const call = (client.messages.create as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.tool_choice).toEqual({ type: "tool", name: "extract_resume_data" });
    expect(typeof call.system).toBe("string");
    expect(call.tools).toHaveLength(1);
  });
});
