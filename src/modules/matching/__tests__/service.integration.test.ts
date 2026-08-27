import { beforeEach, describe, expect, it } from "vitest";
import { resetTestDatabase } from "@/shared/test/db";
import { createTestCompany, createTestUser } from "@/shared/test/fixtures";
import { prisma } from "@/shared/db";
import {
  generateSuggestionsForUser,
  getActiveSuggestionsForUser,
  recordMatchDecision,
} from "@/modules/matching/service";

beforeEach(async () => {
  await resetTestDatabase();
});

async function seedRole() {
  const field = await prisma.professionalField.create({ data: { code: "software-engineering", labelHe: "x", labelEn: "x" } });
  const role = await prisma.targetRole.create({
    data: { code: "backend", professionalFieldId: field.id, labelHe: "Backend", labelEn: "Backend" },
  });
  return { field, role };
}

describe("generateSuggestionsForUser", () => {
  it("proposes eligible candidates and skips ones the privacy gate rejects", async () => {
    const { field, role } = await seedRole();
    const acme = await createTestCompany("Acme");

    const subject = await createTestUser({ professionalFieldId: field.id, targetRoleIds: [role.id] });
    const goodCandidate = await createTestUser({ professionalFieldId: field.id, targetRoleIds: [role.id] });
    const sameCompanyCandidate = await createTestUser({
      professionalFieldId: field.id,
      targetRoleIds: [role.id],
      companyId: acme.id,
      companyConfirmed: true,
    });
    await prisma.professionalProfile.update({
      where: { userId: subject.user.id },
      data: { currentCompanyId: acme.id, currentCompanyConfirmedAt: new Date() },
    });

    const created = await generateSuggestionsForUser(subject.user.id);
    expect(created).toBe(1);

    const suggestions = await prisma.matchSuggestion.findMany({
      where: { OR: [{ userAId: subject.user.id }, { userBId: subject.user.id }] },
    });
    const candidateIds = suggestions.map((s) => (s.userAId === subject.user.id ? s.userBId : s.userAId));
    expect(candidateIds).toContain(goodCandidate.user.id);
    expect(candidateIds).not.toContain(sameCompanyCandidate.user.id);
  });

  it("never proposes the same pair twice while a suggestion is still non-terminal", async () => {
    const { field, role } = await seedRole();
    const subject = await createTestUser({ professionalFieldId: field.id, targetRoleIds: [role.id] });
    await createTestUser({ professionalFieldId: field.id, targetRoleIds: [role.id] });

    await generateSuggestionsForUser(subject.user.id);
    const countAfterFirst = await prisma.matchSuggestion.count();
    await generateSuggestionsForUser(subject.user.id);
    const countAfterSecond = await prisma.matchSuggestion.count();

    expect(countAfterSecond).toBe(countAfterFirst);
  });
});

describe("getActiveSuggestionsForUser", () => {
  it("returns only pre-match-safe fields and safe reasons", async () => {
    const { field, role } = await seedRole();
    const subject = await createTestUser({ professionalFieldId: field.id, targetRoleIds: [role.id] });
    await createTestUser({ professionalFieldId: field.id, targetRoleIds: [role.id], aliasText: "ד." });

    await generateSuggestionsForUser(subject.user.id);
    const views = await getActiveSuggestionsForUser(subject.user.id);

    expect(views).toHaveLength(1);
    expect(views[0].candidate.displayName).toBe("ד.");
    expect(views[0].reasons.length).toBeGreaterThan(0);
    expect(views[0].status).toBe("PROPOSED");
  });

  it("hides (and blocks) a suggestion whose privacy status changed since it was created", async () => {
    const { field, role } = await seedRole();
    const acme = await createTestCompany("Acme");
    const subject = await createTestUser({
      professionalFieldId: field.id,
      targetRoleIds: [role.id],
      companyId: acme.id,
      companyConfirmed: true,
    });
    const candidate = await createTestUser({ professionalFieldId: field.id, targetRoleIds: [role.id] });

    await generateSuggestionsForUser(subject.user.id);
    expect(await getActiveSuggestionsForUser(subject.user.id)).toHaveLength(1);

    // candidate starts a job at the subject's company after the suggestion was made
    await prisma.professionalProfile.update({
      where: { userId: candidate.user.id },
      data: { currentCompanyId: acme.id, currentCompanyConfirmedAt: new Date() },
    });

    const views = await getActiveSuggestionsForUser(subject.user.id);
    expect(views).toHaveLength(0);

    const suggestion = await prisma.matchSuggestion.findFirstOrThrow({ where: { userAId: subject.user.id } });
    expect(suggestion.status).toBe("BLOCKED");
  });
});

describe("recordMatchDecision — the full state machine", () => {
  it("moves PROPOSED -> INTERESTED_BY_A when only one side is interested", async () => {
    const { field, role } = await seedRole();
    const a = await createTestUser({ professionalFieldId: field.id, targetRoleIds: [role.id] });
    await createTestUser({ professionalFieldId: field.id, targetRoleIds: [role.id] });
    await generateSuggestionsForUser(a.user.id);
    const suggestion = await prisma.matchSuggestion.findFirstOrThrow({ where: { userAId: a.user.id } });

    const result = await recordMatchDecision(a.user.id, suggestion.id, "INTERESTED");
    expect(result).toEqual({ status: "INTERESTED_BY_A", mutuallyAccepted: false });
  });

  it("reaches ACTIVE and creates a Connection when both sides say INTERESTED", async () => {
    const { field, role } = await seedRole();
    const a = await createTestUser({ professionalFieldId: field.id, targetRoleIds: [role.id] });
    const b = await createTestUser({ professionalFieldId: field.id, targetRoleIds: [role.id] });
    await generateSuggestionsForUser(a.user.id);
    const suggestion = await prisma.matchSuggestion.findFirstOrThrow({ where: { userAId: a.user.id } });

    await recordMatchDecision(a.user.id, suggestion.id, "INTERESTED");
    const result = await recordMatchDecision(b.user.id, suggestion.id, "INTERESTED");

    expect(result).toEqual({ status: "ACTIVE", mutuallyAccepted: true });

    const connection = await prisma.connection.findUnique({ where: { matchSuggestionId: suggestion.id } });
    expect(connection).not.toBeNull();
    expect([connection?.userAId, connection?.userBId].sort()).toEqual([a.user.id, b.user.id].sort());
  });

  it("declines on NOT_NOW without notifying or informing the other party of the reason", async () => {
    const { field, role } = await seedRole();
    const a = await createTestUser({ professionalFieldId: field.id, targetRoleIds: [role.id] });
    await createTestUser({ professionalFieldId: field.id, targetRoleIds: [role.id] });
    await generateSuggestionsForUser(a.user.id);
    const suggestion = await prisma.matchSuggestion.findFirstOrThrow({ where: { userAId: a.user.id } });

    const result = await recordMatchDecision(a.user.id, suggestion.id, "NOT_NOW");
    expect(result).toEqual({ status: "DECLINED", mutuallyAccepted: false });

    const notifications = await prisma.notificationLog.count();
    expect(notifications).toBe(0);
  });

  it("blocks a mutual match if privacy changed between the two INTERESTED decisions", async () => {
    const { field, role } = await seedRole();
    const acme = await createTestCompany("Acme");
    const a = await createTestUser({ professionalFieldId: field.id, targetRoleIds: [role.id] });
    const b = await createTestUser({ professionalFieldId: field.id, targetRoleIds: [role.id] });
    await generateSuggestionsForUser(a.user.id);
    const suggestion = await prisma.matchSuggestion.findFirstOrThrow({ where: { userAId: a.user.id } });

    await recordMatchDecision(a.user.id, suggestion.id, "INTERESTED");

    // a takes a job at the same company as b, right before b accepts
    await prisma.professionalProfile.update({
      where: { userId: b.user.id },
      data: { currentCompanyId: acme.id, currentCompanyConfirmedAt: new Date() },
    });
    await prisma.professionalProfile.update({
      where: { userId: a.user.id },
      data: { currentCompanyId: acme.id, currentCompanyConfirmedAt: new Date() },
    });

    const result = await recordMatchDecision(b.user.id, suggestion.id, "INTERESTED");
    expect(result).toEqual({ status: "BLOCKED", mutuallyAccepted: false });
    expect(await prisma.connection.count()).toBe(0);
  });

  it("files a Report and marks the suggestion REPORTED on the REPORT decision", async () => {
    const { field, role } = await seedRole();
    const a = await createTestUser({ professionalFieldId: field.id, targetRoleIds: [role.id] });
    await createTestUser({ professionalFieldId: field.id, targetRoleIds: [role.id] });
    await generateSuggestionsForUser(a.user.id);
    const suggestion = await prisma.matchSuggestion.findFirstOrThrow({ where: { userAId: a.user.id } });

    const result = await recordMatchDecision(a.user.id, suggestion.id, "REPORT", {
      category: "SAFETY_CONCERN",
      description: "לא מרגיש/ה בנוח",
    });
    expect(result.status).toBe("REPORTED");

    const report = await prisma.report.findFirstOrThrow({ where: { matchSuggestionId: suggestion.id } });
    expect(report.reporterId).toBe(a.user.id);
    expect(report.category).toBe("SAFETY_CONCERN");
  });

  it("rejects a decision from someone who isn't a participant", async () => {
    const { field, role } = await seedRole();
    const a = await createTestUser({ professionalFieldId: field.id, targetRoleIds: [role.id] });
    await createTestUser({ professionalFieldId: field.id, targetRoleIds: [role.id] });
    const outsider = await createTestUser({ professionalFieldId: field.id, targetRoleIds: [role.id] });
    await generateSuggestionsForUser(a.user.id);
    const suggestion = await prisma.matchSuggestion.findFirstOrThrow({ where: { userAId: a.user.id } });

    await expect(recordMatchDecision(outsider.user.id, suggestion.id, "INTERESTED")).rejects.toThrow();
  });

  it("does not resurface a NEVER_AGAIN pair in future suggestion generation", async () => {
    const { field, role } = await seedRole();
    const a = await createTestUser({ professionalFieldId: field.id, targetRoleIds: [role.id] });
    const b = await createTestUser({ professionalFieldId: field.id, targetRoleIds: [role.id] });
    await generateSuggestionsForUser(a.user.id);
    const suggestion = await prisma.matchSuggestion.findFirstOrThrow({ where: { userAId: a.user.id } });

    await recordMatchDecision(a.user.id, suggestion.id, "NEVER_AGAIN");

    // even directly targeting b, a fresh generation pass must not re-propose them
    await createTestUser({ professionalFieldId: field.id, targetRoleIds: [role.id] }); // noise
    await generateSuggestionsForUser(a.user.id);

    const suggestionsWithB = await prisma.matchSuggestion.findMany({
      where: {
        status: { not: "DECLINED" },
        OR: [
          { userAId: a.user.id, userBId: b.user.id },
          { userAId: b.user.id, userBId: a.user.id },
        ],
      },
    });
    expect(suggestionsWithB).toHaveLength(0);
  });
});
