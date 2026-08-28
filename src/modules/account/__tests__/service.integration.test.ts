import { beforeEach, describe, expect, it } from "vitest";
import { resetTestDatabase } from "@/shared/test/db";
import { createTestUser } from "@/shared/test/fixtures";
import { prisma } from "@/shared/db";
import { deleteAccount, exportAccountData } from "@/modules/account/service";

beforeEach(async () => {
  await resetTestDatabase();
});

describe("exportAccountData", () => {
  it("includes the user's own data", async () => {
    const user = await createTestUser({ aliasText: "מ." });
    const data = await exportAccountData(user.user.id);
    expect(data.user.email).toBe(user.user.email);
    expect(data.profile?.disclosurePreference?.aliasText).toBe("מ.");
  });
});

describe("deleteAccount", () => {
  it("marks the user DELETED and revokes every session", async () => {
    const user = await createTestUser();
    await prisma.session.create({
      data: { userId: user.user.id, tokenHash: "hash1", expiresAt: new Date(Date.now() + 100000) },
    });

    await deleteAccount(user.user.id);

    const updated = await prisma.user.findUniqueOrThrow({ where: { id: user.user.id } });
    expect(updated.status).toBe("DELETED");
    expect(updated.deletedAt).not.toBeNull();

    const session = await prisma.session.findFirstOrThrow({ where: { userId: user.user.id } });
    expect(session.revokedAt).not.toBeNull();
  });

  it("scrubs identifying disclosure fields but leaves the profile record itself intact", async () => {
    const user = await createTestUser();
    await prisma.identityDisclosurePreference.update({
      where: { profileId: user.profile.id },
      data: { fullName: "ישראל ישראלי", phoneNumber: "050-0000000", linkedInUrl: "https://linkedin.com/in/x" },
    });

    await deleteAccount(user.user.id);

    const disclosure = await prisma.identityDisclosurePreference.findUniqueOrThrow({
      where: { profileId: user.profile.id },
    });
    expect(disclosure.fullName).toBeNull();
    expect(disclosure.phoneNumber).toBeNull();
    expect(disclosure.linkedInUrl).toBeNull();
    expect(disclosure.shareFullNamePostMatch).toBe(false);
  });

  it("does not remove published interview-library contributions", async () => {
    const acme = await prisma.company.create({ data: { canonicalName: "Acme" } });
    const user = await createTestUser();
    const experience = await prisma.interviewExperience.create({
      data: {
        authorId: user.user.id,
        companyId: acme.id,
        periodYear: 2025,
        periodQuarter: 1,
        processDescription: "x".repeat(30),
        status: "PUBLISHED",
        publishedAt: new Date(),
      },
    });

    await deleteAccount(user.user.id);

    const stillPublished = await prisma.interviewExperience.findUniqueOrThrow({ where: { id: experience.id } });
    expect(stillPublished.status).toBe("PUBLISHED");
  });
});
