import { beforeEach, describe, expect, it } from "vitest";
import { resetTestDatabase } from "@/shared/test/db";
import { createTestCompany, createTestUser } from "@/shared/test/fixtures";
import { prisma } from "@/shared/db";
import {
  checkGroupEligibility,
  isGroupEligible,
  leaveGroup,
  listEligibleGroups,
  requestToJoinGroup,
} from "@/modules/groups/service";

beforeEach(async () => {
  await resetTestDatabase();
});

describe("isGroupEligible", () => {
  it("is true only when every check allowed", () => {
    expect(isGroupEligible([{ allowed: true }, { allowed: true }])).toBe(true);
    expect(isGroupEligible([{ allowed: true }, { allowed: false }])).toBe(false);
    expect(isGroupEligible([])).toBe(true);
  });
});

async function createGroup(capacityMax = 4) {
  return prisma.group.create({ data: { title: "קבוצת Backend", status: "OPEN", capacityMax, capacityMin: 3 } });
}

describe("checkGroupEligibility / listEligibleGroups", () => {
  it("hides a group whose only conflict is a blocked-company member, without revealing why", async () => {
    const acme = await createTestCompany("Acme");
    const candidate = await createTestUser();
    const memberAtBlockedCo = await createTestUser({ companyId: acme.id, companyConfirmed: true });
    const candidateWithBlock = await createTestUser({ blockedCompanyIds: [acme.id] });

    const group = await createGroup();
    await prisma.groupMembership.create({ data: { groupId: group.id, userId: memberAtBlockedCo.user.id, status: "ACTIVE" } });
    await prisma.groupMembership.create({ data: { groupId: group.id, userId: candidate.user.id, status: "ACTIVE" } });

    // candidateWithBlock has never joined, but blocks a company one member works at
    expect(await checkGroupEligibility(candidateWithBlock.user.id, group.id)).toBe(false);

    const groups = await listEligibleGroups(candidateWithBlock.user.id);
    expect(groups.map((g) => g.id)).not.toContain(group.id);
  });

  it("shows an eligible group with an aggregate member count but no member identities", async () => {
    const a = await createTestUser();
    const b = await createTestUser();
    const viewer = await createTestUser();

    const group = await createGroup();
    await prisma.groupMembership.create({ data: { groupId: group.id, userId: a.user.id, status: "ACTIVE" } });
    await prisma.groupMembership.create({ data: { groupId: group.id, userId: b.user.id, status: "ACTIVE" } });

    const groups = await listEligibleGroups(viewer.user.id);
    expect(groups).toHaveLength(1);
    expect(groups[0].memberCount).toBe(2);
    expect(JSON.stringify(groups[0])).not.toContain(a.user.id);
    expect(JSON.stringify(groups[0])).not.toContain(b.user.id);
  });

  it("still shows an existing member their own group even if a fellow member's status now conflicts with them", async () => {
    const acme = await createTestCompany("Acme");
    const memberA = await createTestUser({ companyId: acme.id, companyConfirmed: true });
    const memberB = await createTestUser({ companyId: acme.id, companyConfirmed: true });

    const group = await createGroup();
    await prisma.groupMembership.create({ data: { groupId: group.id, userId: memberA.user.id, status: "ACTIVE" } });
    await prisma.groupMembership.create({ data: { groupId: group.id, userId: memberB.user.id, status: "ACTIVE" } });

    // memberA and memberB are same-company (would fail a fresh eligibility
    // check against each other), but both are already legitimately in the
    // group — neither should lose access to it.
    const groupsForA = await listEligibleGroups(memberA.user.id);
    expect(groupsForA.map((g) => g.id)).toContain(group.id);
    const groupsForB = await listEligibleGroups(memberB.user.id);
    expect(groupsForB.map((g) => g.id)).toContain(group.id);
  });

  it("does not show DRAFT or ARCHIVED groups", async () => {
    const viewer = await createTestUser();
    await prisma.group.create({ data: { title: "טיוטה", status: "DRAFT", capacityMax: 4 } });
    await prisma.group.create({ data: { title: "בארכיון", status: "ARCHIVED", capacityMax: 4 } });
    expect(await listEligibleGroups(viewer.user.id)).toHaveLength(0);
  });
});

describe("requestToJoinGroup", () => {
  it("joins directly when there's room and the candidate is eligible", async () => {
    const user = await createTestUser();
    const group = await createGroup(4);
    const result = await requestToJoinGroup(user.user.id, group.id);
    expect(result).toBe("JOINED");

    const membership = await prisma.groupMembership.findUniqueOrThrow({
      where: { groupId_userId: { groupId: group.id, userId: user.user.id } },
    });
    expect(membership.status).toBe("ACTIVE");
  });

  it("waitlists instead of joining once the group is at capacity", async () => {
    const group = await createGroup(1);
    const first = await createTestUser();
    const second = await createTestUser();

    expect(await requestToJoinGroup(first.user.id, group.id)).toBe("JOINED");
    expect(await requestToJoinGroup(second.user.id, group.id)).toBe("WAITLISTED");

    const waitlisted = await prisma.groupWaitlistEntry.findUnique({
      where: { groupId_userId: { groupId: group.id, userId: second.user.id } },
    });
    expect(waitlisted).not.toBeNull();

    const updatedGroup = await prisma.group.findUniqueOrThrow({ where: { id: group.id } });
    expect(updatedGroup.status).toBe("FULL");
  });

  it("rechecks privacy at join time even if the group looked eligible earlier", async () => {
    const acme = await createTestCompany("Acme");
    const member = await createTestUser({ companyId: acme.id, companyConfirmed: true });
    const joiner = await createTestUser();

    const group = await createGroup(4);
    await prisma.groupMembership.create({ data: { groupId: group.id, userId: member.user.id, status: "ACTIVE" } });

    // eligible before taking the job at Acme
    expect(await checkGroupEligibility(joiner.user.id, group.id)).toBe(true);

    await prisma.professionalProfile.update({
      where: { userId: joiner.user.id },
      data: { currentCompanyId: acme.id, currentCompanyConfirmedAt: new Date() },
    });

    expect(await requestToJoinGroup(joiner.user.id, group.id)).toBe("INELIGIBLE");
  });

  it("is idempotent for an already-active member", async () => {
    const user = await createTestUser();
    const group = await createGroup(4);
    await requestToJoinGroup(user.user.id, group.id);
    expect(await requestToJoinGroup(user.user.id, group.id)).toBe("ALREADY_MEMBER");
  });
});

describe("leaveGroup", () => {
  it("marks the membership LEFT and reopens a FULL group", async () => {
    const group = await createGroup(1);
    const user = await createTestUser();
    await requestToJoinGroup(user.user.id, group.id);
    expect((await prisma.group.findUniqueOrThrow({ where: { id: group.id } })).status).toBe("FULL");

    await leaveGroup(user.user.id, group.id);

    const membership = await prisma.groupMembership.findUniqueOrThrow({
      where: { groupId_userId: { groupId: group.id, userId: user.user.id } },
    });
    expect(membership.status).toBe("LEFT");
    expect((await prisma.group.findUniqueOrThrow({ where: { id: group.id } })).status).toBe("OPEN");
  });
});
