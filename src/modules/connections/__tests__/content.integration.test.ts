import { beforeEach, describe, expect, it } from "vitest";
import { resetTestDatabase } from "@/shared/test/db";
import { createTestUser } from "@/shared/test/fixtures";
import { prisma } from "@/shared/db";
import {
  changePractice,
  loadSharedPractice,
  resolvePracticeContent,
} from "../content-service";
import { practiceStatus } from "../content";

beforeEach(resetTestDatabase);
async function setup() {
  const a = await createTestUser();
  const b = await createTestUser();
  const suggestion = await prisma.matchSuggestion.create({
    data: {
      userAId: a.user.id,
      userBId: b.user.id,
      profileAId: a.profile.id,
      profileBId: b.profile.id,
      status: "ACTIVE",
      expiresAt: new Date(Date.now() + 86400000),
    },
  });
  const c = await prisma.connection.create({
    data: {
      userAId: a.user.id,
      userBId: b.user.id,
      matchSuggestionId: suggestion.id,
    },
  });
  const read = () =>
    prisma.connection.findUniqueOrThrow({ where: { id: c.id } });
  return { a: a.user.id, b: b.user.id, id: c.id, read };
}
describe("shared practice agreement", () => {
  it("requires only the recipient's acceptance, with distinct statuses for both people", async () => {
    const { a, b, id, read } = await setup();
    await changePractice(a, id, 0, "template:coding");
    const pending = await loadSharedPractice(await read());
    expect(pending.agreed).toBeNull();
    expect(practiceStatus(pending, a).label).toBe("ממתינים לאישור התוכן");
    expect(practiceStatus(pending, b).label).toContain("מחכה לתגובה שלך");
    await expect(changePractice(a, id, 1)).rejects.toThrow("רק הצד השני");
    await changePractice(b, id, 1);
    expect(await read()).toMatchObject({
      agreedContentKey: "template:coding",
      pendingContentKey: null,
      contentRevision: 2,
    });
  });
  it("preserves the agreement during replacement and rejects stale approvals", async () => {
    const { a, b, id, read } = await setup();
    await changePractice(a, id, 0, "template:coding");
    await changePractice(b, id, 1);
    await changePractice(b, id, 2, "template:system-design");
    expect((await read()).agreedContentKey).toBe("template:coding");
    await expect(changePractice(a, id, 1)).rejects.toThrow("עודכן");
    await changePractice(a, id, 3);
    expect((await read()).agreedContentKey).toBe("template:system-design");
  });
  it("prevents outsiders, inactive connections and unavailable content from mutating state", async () => {
    const { a, id, read } = await setup();
    const outsider = await createTestUser();
    await expect(
      changePractice(outsider.user.id, id, 0, "template:coding"),
    ).rejects.toThrow("אינו זמין");
    await expect(changePractice(a, id, 0, "guide:missing")).rejects.toThrow(
      "אינו זמין",
    );
    await prisma.connection.update({
      where: { id },
      data: { status: "ENDED" },
    });
    await expect(changePractice(a, id, 0, "template:coding")).rejects.toThrow(
      "אינו זמין",
    );
    expect((await read()).contentRevision).toBe(0);
  });
  it("allows only one of two simultaneous proposals from the same revision", async () => {
    const { a, b, id, read } = await setup();
    const results = await Promise.allSettled([
      changePractice(a, id, 0, "template:coding"),
      changePractice(b, id, 0, "template:system-design"),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect((await read()).contentRevision).toBe(1);
  });
  it("keeps the previous proposal until a counterproposal is actually submitted", async () => {
    const { a, b, id, read } = await setup();
    await changePractice(a, id, 0, "template:coding");
    await resolvePracticeContent("template:system-design");
    expect((await read()).pendingContentKey).toBe("template:coding");
    await changePractice(b, id, 1, "template:system-design");
    await expect(changePractice(b, id, 2)).rejects.toThrow("רק הצד השני");
    await changePractice(a, id, 2);
    expect((await read()).agreedContentKey).toBe("template:system-design");
  });
});
