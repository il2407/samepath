import { beforeEach, describe, expect, it } from "vitest";
import { resetTestDatabase } from "@/shared/test/db";
import { createTestCompany, createTestUser } from "@/shared/test/fixtures";
import { prisma } from "@/shared/db";
import { checkPrivacy, loadEligibilityProfile } from "@/modules/privacy/context";

beforeEach(async () => {
  await resetTestDatabase();
});

describe("loadEligibilityProfile", () => {
  it("returns null for a user with no account", async () => {
    expect(await loadEligibilityProfile("does-not-exist")).toBeNull();
  });

  it("defaults sensibly for a user with no profile yet", async () => {
    const user = await prisma.user.create({ data: { email: "bare@example.com" } });
    const eligibility = await loadEligibilityProfile(user.id);
    expect(eligibility?.profileStatus).toBe("DRAFT");
    expect(eligibility?.blockEntireCorporateGroup).toBe(true);
    expect(eligibility?.availability).toEqual([]);
  });
});

describe("checkPrivacy — real database round trip", () => {
  it("allows two unrelated, eligible users and records an ALLOW audit row", async () => {
    const a = await createTestUser();
    const b = await createTestUser();

    const result = await checkPrivacy(a.user.id, b.user.id, { context: "MATCH" });
    expect(result).toEqual({ allowed: true });

    const audit = await prisma.privacyDecisionAudit.findFirst({
      where: { subjectUserId: a.user.id, candidateUserId: b.user.id },
    });
    expect(audit?.decision).toBe("ALLOW");
  });

  it("rejects two confirmed employees of the same company and audits the rejection", async () => {
    const acme = await createTestCompany("Acme");
    const a = await createTestUser({ companyId: acme.id, companyConfirmed: true });
    const b = await createTestUser({ companyId: acme.id, companyConfirmed: true });

    const result = await checkPrivacy(a.user.id, b.user.id, { context: "MATCH" });
    expect(result).toEqual({ allowed: false, reasonCode: "same_company" });

    const audit = await prisma.privacyDecisionAudit.findFirst({
      where: { subjectUserId: a.user.id, candidateUserId: b.user.id },
    });
    expect(audit?.decision).toBe("REJECT");
    expect(audit?.reasonCode).toBe("same_company");
  });

  it("rejects subsidiaries of the same corporate group", async () => {
    const group = await prisma.corporateGroup.create({ data: { name: "MegaCorp Group" } });
    const parent = await createTestCompany("MegaCorp", group.id);
    const subsidiary = await createTestCompany("MegaCorp Israel", group.id);
    const a = await createTestUser({ companyId: parent.id, companyConfirmed: true });
    const b = await createTestUser({ companyId: subsidiary.id, companyConfirmed: true });

    const result = await checkPrivacy(a.user.id, b.user.id, { context: "MATCH" });
    expect(result).toEqual({ allowed: false, reasonCode: "corporate_group_conflict" });
  });

  it("rejects when a company is blocked, in either direction", async () => {
    const formerEmployer = await createTestCompany("OldCo");
    const a = await createTestUser({ blockedCompanyIds: [formerEmployer.id] });
    const b = await createTestUser({ companyId: formerEmployer.id, companyConfirmed: true });

    expect(await checkPrivacy(a.user.id, b.user.id, { context: "MATCH" })).toEqual({
      allowed: false,
      reasonCode: "company_blocked",
    });
    // symmetric: b blocking a's company also rejects
    expect(await checkPrivacy(b.user.id, a.user.id, { context: "MATCH" })).toEqual({
      allowed: false,
      reasonCode: "company_blocked",
    });
  });

  it("rejects when one user has blocked the other", async () => {
    const a = await createTestUser();
    const b = await createTestUser({ blockedUserIds: [a.user.id] });

    expect(await checkPrivacy(a.user.id, b.user.id, { context: "MATCH" })).toEqual({
      allowed: false,
      reasonCode: "user_blocked",
    });
  });

  it("does not leak which side caused a rejection through the allowed result shape", async () => {
    const acme = await createTestCompany("Acme");
    const a = await createTestUser({ companyId: acme.id, companyConfirmed: true });
    const b = await createTestUser({ companyId: acme.id, companyConfirmed: true });

    const result = await checkPrivacy(a.user.id, b.user.id, { context: "MATCH" });
    // The only field a caller may forward to a user-facing response is `allowed`.
    expect(Object.keys(result)).not.toContain("reason");
    expect(result.allowed).toBe(false);
  });

  it("re-checks fresh from the database — a privacy change after profile load is respected", async () => {
    const acme = await createTestCompany("Acme");
    const a = await createTestUser();
    const b = await createTestUser();

    expect(await checkPrivacy(a.user.id, b.user.id, { context: "MATCH" })).toEqual({ allowed: true });

    // b starts a new job at a's company after the first check
    await prisma.professionalProfile.update({
      where: { userId: b.user.id },
      data: { currentCompanyId: acme.id, currentCompanyConfirmedAt: new Date() },
    });
    await prisma.professionalProfile.update({
      where: { userId: a.user.id },
      data: { currentCompanyId: acme.id, currentCompanyConfirmedAt: new Date() },
    });

    expect(await checkPrivacy(a.user.id, b.user.id, { context: "MATCH" })).toEqual({
      allowed: false,
      reasonCode: "same_company",
    });
  });
});
