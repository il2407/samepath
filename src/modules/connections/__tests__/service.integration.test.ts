import { beforeEach, describe, expect, it } from "vitest";
import { resetTestDatabase } from "@/shared/test/db";
import { createTestUser } from "@/shared/test/fixtures";
import { generateFriendlyNickname } from "@/modules/profiles/nickname";
import { prisma } from "@/shared/db";
import {
  clearConnectionGuide,
  createConnectionFromMatch,
  endConnection,
  getConnectionDetail,
  listConnectionsForUser,
  listGuideOptionsForConnection,
  selectConnectionGuide,
  sendMessage,
  setMyIntroRequirement,
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

describe("listGuideOptionsForConnection", () => {
  it("lists every published guide in the category, ordered", async () => {
    const { a, connection } = await createTestConnection();
    const first = await createPublishedGuide("coding", "test-guide-list-1");
    const second = await createPublishedGuide("coding", "test-guide-list-2");

    const options = await listGuideOptionsForConnection(a.user.id, connection.id, "coding");

    expect(options.map((g) => g.id).sort()).toEqual([first.id, second.id].sort());
  });

  it("returns an empty list when the category has no published guides", async () => {
    const { a, connection } = await createTestConnection();
    const options = await listGuideOptionsForConnection(a.user.id, connection.id, "system-design");
    expect(options).toEqual([]);
  });

  it("refuses a non-participant", async () => {
    const { connection } = await createTestConnection();
    const outsider = await createTestUser();
    await expect(listGuideOptionsForConnection(outsider.user.id, connection.id, "coding")).rejects.toThrow();
  });
});

describe("setMyIntroRequirement", () => {
  it("lets each participant independently declare their stance, visible to the other", async () => {
    const { a, b, connection } = await createTestConnection();

    await setMyIntroRequirement(a.user.id, connection.id, "REQUIRED");
    await setMyIntroRequirement(b.user.id, connection.id, "NOT_REQUIRED");

    const detailForA = await getConnectionDetail(a.user.id, connection.id);
    const detailForB = await getConnectionDetail(b.user.id, connection.id);

    expect(detailForA?.myIntroStance).toBe("REQUIRED");
    expect(detailForA?.otherPartyIntroStance).toBe("NOT_REQUIRED");
    expect(detailForB?.myIntroStance).toBe("NOT_REQUIRED");
    expect(detailForB?.otherPartyIntroStance).toBe("REQUIRED");
  });

  it("defaults to null (no stance declared) until a participant sets one", async () => {
    const { a, connection } = await createTestConnection();
    const detail = await getConnectionDetail(a.user.id, connection.id);
    expect(detail?.myIntroStance).toBeNull();
    expect(detail?.otherPartyIntroStance).toBeNull();
  });

  it("upserts rather than duplicating on repeated calls", async () => {
    const { a, connection } = await createTestConnection();

    await setMyIntroRequirement(a.user.id, connection.id, "REQUIRED");
    await setMyIntroRequirement(a.user.id, connection.id, "NOT_REQUIRED");

    const detail = await getConnectionDetail(a.user.id, connection.id);
    expect(detail?.myIntroStance).toBe("NOT_REQUIRED");
  });

  it("refuses a non-participant", async () => {
    const { connection } = await createTestConnection();
    const outsider = await createTestUser();
    await expect(setMyIntroRequirement(outsider.user.id, connection.id, "REQUIRED")).rejects.toThrow();
  });
});

describe("getConnectionDetail / listConnectionsForUser — progressive disclosure at the CONNECTED stage (backlog item 9)", () => {
  it("automatically reveals full name and employer once a real Connection exists", async () => {
    const { a, connection } = await createTestConnection({
      bOptions: {
        companyId: (await prisma.company.create({ data: { canonicalName: "Acme" } })).id,
        companyConfirmed: true,
        disclosure: { fullName: "מיכל כהן" },
      },
    });

    const detail = await getConnectionDetail(a.user.id, connection.id);
    expect(detail?.otherParty.fullName).toBe("מיכל כהן");
    expect(detail?.otherParty.company).toBe("Acme");
    expect(detail?.otherPartyDisplayName).toBe("מיכל כהן");
  });

  it("keeps email and phone hidden even once connected, unless the other party opted into shareEmailPostMatch / sharePhonePostMatch (contact-info reveal is a later, separate opt-in — backlog item 9 revised)", async () => {
    const { a, connection } = await createTestConnection({
      bOptions: { disclosure: { phoneNumber: "050-0000000" } },
    });

    const detail = await getConnectionDetail(a.user.id, connection.id);
    expect(detail?.otherParty.email).toBeNull();
    expect(detail?.otherParty.phoneNumber).toBeNull();
  });

  it("reveals email and phone once the other party opts into shareEmailPostMatch / sharePhonePostMatch", async () => {
    const { a, connection } = await createTestConnection({
      bOptions: {
        disclosure: { phoneNumber: "050-0000000", shareEmailPostMatch: true, sharePhonePostMatch: true },
      },
    });

    const detail = await getConnectionDetail(a.user.id, connection.id);
    expect(detail?.otherParty.email).toMatch(/@example\.com$/);
    expect(detail?.otherParty.phoneNumber).toBe("050-0000000");
  });

  it("exposes linkedInUrl automatically once connected — null (not fabricated) when the other party never set one", async () => {
    const { a, connection } = await createTestConnection();
    const detail = await getConnectionDetail(a.user.id, connection.id);
    expect(detail?.otherParty.linkedInUrl).toBeNull();
  });

  it("exposes the real linkedInUrl automatically once connected, with no opt-in required", async () => {
    const { a, connection } = await createTestConnection({
      bOptions: { disclosure: { linkedInUrl: "https://linkedin.com/in/example" } },
    });
    const detail = await getConnectionDetail(a.user.id, connection.id);
    expect(detail?.otherParty.linkedInUrl).toBe("https://linkedin.com/in/example");
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

  it("listConnectionsForUser also falls back to the nickname when fullName is unset, and leaves the real fields null", async () => {
    const { a, connection } = await createTestConnection();
    const items = await listConnectionsForUser(a.user.id);
    const item = items.find((i) => i.id === connection.id);
    expect(item?.otherPartyDisplayName).toBe(generateFriendlyNickname(connection.matchSuggestionId));
    expect(item?.otherPartyFullName).toBeNull();
    expect(item?.otherPartyCompany).toBeNull();
    expect(item?.otherPartyLinkedInUrl).toBeNull();
  });

  it("listConnectionsForUser shows the real full name, company, and LinkedIn URl once the other party has them on file", async () => {
    const company = await prisma.company.create({ data: { canonicalName: "Acme" } });
    const { a, connection } = await createTestConnection({
      bOptions: {
        companyId: company.id,
        companyConfirmed: true,
        disclosure: { fullName: "יוסי לוי", linkedInUrl: "https://linkedin.com/in/yossi" },
      },
    });
    const items = await listConnectionsForUser(a.user.id);
    const item = items.find((i) => i.id === connection.id);
    expect(item?.otherPartyDisplayName).toBe("יוסי לוי");
    expect(item?.otherPartyFullName).toBe("יוסי לוי");
    expect(item?.otherPartyCompany).toBe("Acme");
    expect(item?.otherPartyLinkedInUrl).toBe("https://linkedin.com/in/yossi");
  });
});

describe("sendMessage (backlog item 13 — zero prior coverage)", () => {
  it("persists a message and surfaces it in ascending order via getConnectionDetail", async () => {
    const { a, b, connection } = await createTestConnection();

    await sendMessage(a.user.id, connection.id, "היי, נעים להכיר!");
    await sendMessage(b.user.id, connection.id, "גם לי, מתי נוח לך לדבר?");

    const detail = await getConnectionDetail(a.user.id, connection.id);
    expect(detail?.messages).toHaveLength(2);
    expect(detail?.messages[0]).toMatchObject({ senderId: a.user.id, body: "היי, נעים להכיר!" });
    expect(detail?.messages[1]).toMatchObject({ senderId: b.user.id, body: "גם לי, מתי נוח לך לדבר?" });
  });

  it("refuses a non-participant", async () => {
    const { connection } = await createTestConnection();
    const outsider = await createTestUser();
    await expect(sendMessage(outsider.user.id, connection.id, "hello")).rejects.toThrow();

    const detail = await getConnectionDetail(outsider.user.id, connection.id);
    expect(detail).toBeNull();
  });

  it("refuses to send once the connection is no longer ACTIVE", async () => {
    const { a, connection } = await createTestConnection();
    await endConnection(a.user.id, connection.id);

    await expect(sendMessage(a.user.id, connection.id, "still here?")).rejects.toThrow();
  });

  it("preserves mixed Hebrew/English/URL/numeric content verbatim, with no mangling", async () => {
    const { a, connection } = await createTestConnection();
    const mixed = "בואו נדבר ב-14:30 — https://meet.google.com/abc-defg-hij (זמן ניו יורק: 7:30 AM)";

    await sendMessage(a.user.id, connection.id, mixed);

    const detail = await getConnectionDetail(a.user.id, connection.id);
    expect(detail?.messages[0]?.body).toBe(mixed);
  });
});
