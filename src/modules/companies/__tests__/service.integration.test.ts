import { beforeEach, describe, expect, it } from "vitest";
import { resetTestDatabase } from "@/shared/test/db";
import { prisma } from "@/shared/db";
import {
  createCompanyFromUserInput,
  getCorporateGroupCompanyIds,
  mergeCompanies,
  resolveCompanyId,
  searchCompanies,
} from "@/modules/companies/service";

beforeEach(async () => {
  await resetTestDatabase();
});

describe("searchCompanies", () => {
  it("finds a company by exact name", async () => {
    const google = await prisma.company.create({ data: { canonicalName: "Google" } });
    const results = await searchCompanies("Google");
    expect(results[0]).toMatchObject({ id: google.id, quality: "exact" });
  });

  it("finds a company via an alias (spelling/language variation)", async () => {
    const google = await prisma.company.create({
      data: { canonicalName: "Google", aliases: { create: [{ alias: "גוגל" }] } },
    });
    const results = await searchCompanies("גוגל");
    expect(results.map((r) => r.id)).toContain(google.id);
  });

  it("tolerates a small typo via fuzzy fallback", async () => {
    await prisma.company.create({ data: { canonicalName: "Microsoft" } });
    const results = await searchCompanies("Microsooft");
    expect(results.some((r) => r.canonicalName === "Microsoft")).toBe(true);
  });

  it("never returns a company that has been merged away", async () => {
    const target = await prisma.company.create({ data: { canonicalName: "Meta" } });
    await prisma.company.create({
      data: { canonicalName: "Facebook", mergedIntoId: target.id, normalizationStatus: "MERGED" },
    });
    const results = await searchCompanies("Facebook");
    expect(results.map((r) => r.canonicalName)).not.toContain("Facebook");
  });

  it("returns no results for a very short query", async () => {
    await prisma.company.create({ data: { canonicalName: "IBM" } });
    expect(await searchCompanies("I")).toEqual([]);
  });
});

describe("createCompanyFromUserInput", () => {
  it("creates a new company flagged for review", async () => {
    const company = await createCompanyFromUserInput("A Totally New Startup");
    const row = await prisma.company.findUniqueOrThrow({ where: { id: company.id } });
    expect(row.normalizationStatus).toBe("NEEDS_REVIEW");
    expect(row.canonicalName).toBe("A Totally New Startup");
  });
});

describe("mergeCompanies", () => {
  it("repoints employment history, current-employer links, and dedupes blocked-company rows", async () => {
    const target = await prisma.company.create({ data: { canonicalName: "Meta" } });
    const source = await prisma.company.create({ data: { canonicalName: "Facebook" } });

    const user = await prisma.user.create({ data: { email: "user@example.com" } });
    const profile = await prisma.professionalProfile.create({
      data: { userId: user.id, currentCompanyId: source.id },
    });
    await prisma.employmentPosition.create({
      data: { profileId: profile.id, companyId: source.id, companyRaw: "Facebook", title: "Engineer", startDate: new Date("2020-01-01") },
    });

    // this user already blocks BOTH the source and the target — merge must not
    // crash on the resulting duplicate-key conflict, and must leave exactly one block
    const blocker = await prisma.user.create({ data: { email: "blocker@example.com" } });
    await prisma.blockedCompany.createMany({
      data: [
        { userId: blocker.id, companyId: source.id, reason: "OTHER" },
        { userId: blocker.id, companyId: target.id, reason: "OTHER" },
      ],
    });

    await mergeCompanies(source.id, target.id);

    const mergedSource = await prisma.company.findUniqueOrThrow({ where: { id: source.id } });
    expect(mergedSource.mergedIntoId).toBe(target.id);
    expect(mergedSource.normalizationStatus).toBe("MERGED");

    const alias = await prisma.companyAlias.findFirst({ where: { companyId: target.id, alias: "Facebook" } });
    expect(alias).not.toBeNull();

    const updatedProfile = await prisma.professionalProfile.findUniqueOrThrow({ where: { userId: user.id } });
    expect(updatedProfile.currentCompanyId).toBe(target.id);

    const employment = await prisma.employmentPosition.findFirstOrThrow({ where: { profileId: profile.id } });
    expect(employment.companyId).toBe(target.id);

    const blocks = await prisma.blockedCompany.findMany({ where: { userId: blocker.id } });
    expect(blocks).toHaveLength(1);
    expect(blocks[0].companyId).toBe(target.id);
  });

  it("refuses to merge a company into itself", async () => {
    const company = await prisma.company.create({ data: { canonicalName: "Solo" } });
    await expect(mergeCompanies(company.id, company.id)).rejects.toThrow();
  });
});

describe("resolveCompanyId", () => {
  it("follows a merge to the live canonical company", async () => {
    const target = await prisma.company.create({ data: { canonicalName: "Meta" } });
    const source = await prisma.company.create({ data: { canonicalName: "Facebook" } });
    await mergeCompanies(source.id, target.id);
    expect(await resolveCompanyId(source.id)).toBe(target.id);
    expect(await resolveCompanyId(target.id)).toBe(target.id);
  });
});

describe("getCorporateGroupCompanyIds", () => {
  it("returns siblings in the same corporate group", async () => {
    const group = await prisma.corporateGroup.create({ data: { name: "MegaCorp" } });
    const parent = await prisma.company.create({ data: { canonicalName: "MegaCorp", corporateGroupId: group.id } });
    const sub = await prisma.company.create({ data: { canonicalName: "MegaCorp Israel", corporateGroupId: group.id } });
    const ids = await getCorporateGroupCompanyIds(parent.id);
    expect(ids.sort()).toEqual([parent.id, sub.id].sort());
  });

  it("returns just the company itself when it has no group", async () => {
    const standalone = await prisma.company.create({ data: { canonicalName: "Indie Co" } });
    expect(await getCorporateGroupCompanyIds(standalone.id)).toEqual([standalone.id]);
  });
});
