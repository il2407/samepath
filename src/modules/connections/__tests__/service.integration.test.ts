import { beforeEach, describe, expect, it } from "vitest";
import { resetTestDatabase } from "@/shared/test/db";
import { createTestUser } from "@/shared/test/fixtures";
import { generateFriendlyNickname } from "@/modules/profiles/nickname";
import { prisma } from "@/shared/db";
import {
  clearConnectionGuide,
  createConnectionFromMatch,
  getConnectionDetail,
  listConnectionsForUser,
  selectConnectionGuide,
  setMySessionTypes,
  suggestGuideForConnection,
} from "@/modules/connections/service";

beforeEach(async () => {
  await resetTestDatabase();
});

async function createTestConnection(options: { aOptions?: Parameters<typeof createTestUser>[0]; bOptions?: Parameters<typeof createTestUser>[0] } = {}) {
  const a = await createTestUser(options.aOptions);
  const b = await createTestUser(options.bOptions);
  const suggestion = await prisma.matchSuggestion.create({
    data: {
      userAId: a.user.id,
      userBId: b.user.id,
      profileAId: a.profile.id,
      profileBId: b.profile.id,
      status: "ACTIVE",
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24),
    },
  });
  const connection = await createConnectionFromMatch(suggestion.id, a.user.id, b.user.id);
  return { a, b, connection };
}

async function createPublishedGuide(category: string, id: string) {
  return prisma.sessionGuide.create({
    data: {
      id,
      title: `Guide ${id}`,
      purpose: "test guide",
      suggestedDurationMinutes: 30,
      format: "ONE_ON_ONE",
      category,
      status: "PUBLISHED",
      steps: {
        create: [
          { order: 0, title: "Step 1", prompt: "Do the thing", kind: "PROMPT", role: "PRESENTER", durationMinutes: 10 },
          { order: 1, title: "Step 2", prompt: "Listen", kind: "AGENDA", role: "LISTENER", durationMinutes: 10 },
        ],
      },
    },
  });
}

describe("suggestGuideForConnection", () => {
  it("returns a published guide from the requested category", async () => {
    const { a, connection } = await createTestConnection();
    await createPublishedGuide("coding", "test-guide-coding-1");

    const guide = await suggestGuideForConnection(a.user.id, connection.id, "coding");
    expect(guide?.category).toBe("coding");
  });

  it("returns null when the category has no published guides", async () => {
    const { a, connection } = await createTestConnection();
    const guide = await suggestGuideForConnection(a.user.id, connection.id, "system-design");
    expect(guide).toBeNull();
  });

  it("refuses a non-participant", async () => {
    const { connection } = await createTestConnection();
    const outsider = await createTestUser();
    await expect(suggestGuideForConnection(outsider.user.id, connection.id, "coding")).rejects.toThrow();
  });
});

describe("selectConnectionGuide / clearConnectionGuide", () => {
  it("persists the selected guide so both participants see the same one", async () => {
    const { a, b, connection } = await createTestConnection();
    const guide = await createPublishedGuide("coding", "test-guide-coding-2");

    await selectConnectionGuide(a.user.id, connection.id, guide.id);

    const detailForA = await getConnectionDetail(a.user.id, connection.id);
    const detailForB = await getConnectionDetail(b.user.id, connection.id);
    expect(detailForA?.selectedGuide?.id).toBe(guide.id);
    expect(detailForB?.selectedGuide?.id).toBe(guide.id);
    expect(detailForA?.selectedGuide?.steps).toHaveLength(2);
    expect(detailForA?.selectedGuide?.steps[0]).toMatchObject({ role: "PRESENTER", durationMinutes: 10 });
  });

  it("lets either participant change the selection, not just the one who picked it", async () => {
    const { a, b, connection } = await createTestConnection();
    const guideOne = await createPublishedGuide("coding", "test-guide-coding-3");
    const guideTwo = await createPublishedGuide("coding", "test-guide-coding-4");

    await selectConnectionGuide(a.user.id, connection.id, guideOne.id);
    await selectConnectionGuide(b.user.id, connection.id, guideTwo.id);

    const detail = await getConnectionDetail(a.user.id, connection.id);
    expect(detail?.selectedGuide?.id).toBe(guideTwo.id);
  });

  it("refuses to select an unpublished guide", async () => {
    const { a, connection } = await createTestConnection();
    const draft = await prisma.sessionGuide.create({
      data: { title: "Draft", purpose: "x", suggestedDurationMinutes: 10, status: "DRAFT" },
    });
    await expect(selectConnectionGuide(a.user.id, connection.id, draft.id)).rejects.toThrow();
  });

  it("clears the selection back to null", async () => {
    const { a, connection } = await createTestConnection();
    const guide = await createPublishedGuide("coding", "test-guide-coding-5");
    await selectConnectionGuide(a.user.id, connection.id, guide.id);

    await clearConnectionGuide(a.user.id, connection.id);

    const detail = await getConnectionDetail(a.user.id, connection.id);
    expect(detail?.selectedGuide).toBeNull();
  });

  it("refuses a non-participant trying to select or clear", async () => {
    const { connection } = await createTestConnection();
    const outsider = await createTestUser();
    const guide = await createPublishedGuide("coding", "test-guide-coding-6");

    await expect(selectConnectionGuide(outsider.user.id, connection.id, guide.id)).rejects.toThrow();
    await expect(clearConnectionGuide(outsider.user.id, connection.id)).rejects.toThrow();
  });
});

describe("setMySessionTypes", () => {
  it("lets each participant independently record what they want from this session, visible to the other", async () => {
    const { a, b, connection } = await createTestConnection();

    await setMySessionTypes(a.user.id, connection.id, ["INTERVIEW_SIMULATION", "SYSTEM_DESIGN"]);
    await setMySessionTypes(b.user.id, connection.id, ["MENTAL_SUPPORT"]);

    const detailForA = await getConnectionDetail(a.user.id, connection.id);
    const detailForB = await getConnectionDetail(b.user.id, connection.id);

    expect(detailForA?.mySessionTypes).toEqual(["INTERVIEW_SIMULATION", "SYSTEM_DESIGN"]);
    expect(detailForA?.otherPartySessionTypes).toEqual(["MENTAL_SUPPORT"]);
    expect(detailForB?.mySessionTypes).toEqual(["MENTAL_SUPPORT"]);
    expect(detailForB?.otherPartySessionTypes).toEqual(["INTERVIEW_SIMULATION", "SYSTEM_DESIGN"]);
  });

  it("overwrites a participant's own previous selection rather than appending", async () => {
    const { a, connection } = await createTestConnection();

    await setMySessionTypes(a.user.id, connection.id, ["INTERVIEW_SIMULATION"]);
    await setMySessionTypes(a.user.id, connection.id, ["PROJECT_PITCH", "BEHAVIORAL_INTERVIEW"]);

    const detail = await getConnectionDetail(a.user.id, connection.id);
    expect(detail?.mySessionTypes).toEqual(["PROJECT_PITCH", "BEHAVIORAL_INTERVIEW"]);
  });

  it("refuses a non-participant", async () => {
    const { connection } = await createTestConnection();
    const outsider = await createTestUser();
    await expect(setMySessionTypes(outsider.user.id, connection.id, ["MENTAL_SUPPORT"])).rejects.toThrow();
  });
});

describe("getConnectionDetail / listConnectionsForUser — progressive disclosure at the CONNECTED stage (backlog item 9)", () => {
  it("automatically reveals full name, employer, location, email, and phone once a real Connection exists", async () => {
    const { a, connection } = await createTestConnection({
      bOptions: {
        companyId: (await prisma.company.create({ data: { canonicalName: "Acme" } })).id,
        companyConfirmed: true,
        disclosure: { fullName: "מיכל כהן", phoneNumber: "050-0000000" },
      },
    });

    const detail = await getConnectionDetail(a.user.id, connection.id);
    expect(detail?.otherParty.fullName).toBe("מיכל כהן");
    expect(detail?.otherParty.company).toBe("Acme");
    expect(detail?.otherParty.email).toMatch(/@example\.com$/);
    expect(detail?.otherParty.phoneNumber).toBe("050-0000000");
    expect(detail?.otherPartyDisplayName).toBe("מיכל כהן");
  });

  it("never exposes a linkedInUrl key on otherParty — structurally removed, not merely hidden", async () => {
    const { a, connection } = await createTestConnection();
    const detail = await getConnectionDetail(a.user.id, connection.id);
    expect(detail?.otherParty as unknown as Record<string, unknown>).not.toHaveProperty("linkedInUrl");
  });

  it("falls back to the anonymous nickname when the other party never set a fullName (old account)", async () => {
    const { a, connection } = await createTestConnection();
    const detail = await getConnectionDetail(a.user.id, connection.id);
    expect(detail?.otherParty.fullName).toBeNull();
    expect(detail?.otherPartyDisplayName).toBe(generateFriendlyNickname(connection.matchSuggestionId));
  });

  it("returns null when the other party has since been blocked — the privacy re-check still applies post-connection", async () => {
    const { a, b, connection } = await createTestConnection();
    await prisma.blockedUser.create({ data: { userId: a.user.id, blockedUserId: b.user.id } });

    expect(await getConnectionDetail(a.user.id, connection.id)).toBeNull();
  });

  it("returns null when the other party's account has since been deleted (backlog item 22 — deleted-account coverage)", async () => {
    const { a, b, connection } = await createTestConnection();
    await prisma.user.update({ where: { id: b.user.id }, data: { status: "DELETED", deletedAt: new Date() } });

    expect(await getConnectionDetail(a.user.id, connection.id)).toBeNull();
  });

  it("listConnectionsForUser also falls back to the nickname when fullName is unset", async () => {
    const { a, connection } = await createTestConnection();
    const items = await listConnectionsForUser(a.user.id);
    const item = items.find((i) => i.id === connection.id);
    expect(item?.otherPartyDisplayName).toBe(generateFriendlyNickname(connection.matchSuggestionId));
  });

  it("listConnectionsForUser shows the real full name once the other party has one on file", async () => {
    const { a, connection } = await createTestConnection({
      bOptions: { disclosure: { fullName: "יוסי לוי" } },
    });
    const items = await listConnectionsForUser(a.user.id);
    const item = items.find((i) => i.id === connection.id);
    expect(item?.otherPartyDisplayName).toBe("יוסי לוי");
  });
});
