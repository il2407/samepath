import { beforeEach, describe, expect, it } from "vitest";
import { resetTestDatabase } from "@/shared/test/db";
import { createTestCompany, createTestUser } from "@/shared/test/fixtures";
import { prisma } from "@/shared/db";
import { saveDraftExperience, submitForReview, withdrawContribution, type CreateExperienceInput } from "@/modules/interviews/contributions";
import { approveContribution, rejectContribution, removeContribution, requestChanges } from "@/modules/moderation/interviews";
import { browseExperiences, getCompanyLibrarySummary, getPublicExperienceDetail } from "@/modules/interviews/library";
import { submitValidation } from "@/modules/interviews/validation";
import { getCreditBalance } from "@/modules/credits/service";

beforeEach(async () => {
  await resetTestDatabase();
  await prisma.rewardPolicy.createMany({
    data: [
      { key: "credits.approved_complete_experience", valueJson: { credits: 20 } },
      { key: "credits.unique_useful_question_bonus", valueJson: { creditsPerQuestion: 2, maxPerExperience: 20, maxRewardableQuestions: 8 } },
      { key: "credits.community_validation_bonus", valueJson: { maxPerExperience: 10 } },
      { key: "credits.conversion_tiers", valueJson: { tiers: [{ credits: 50, accessDays: 7 }] } },
      { key: "credits.max_bonus_extension_days_per_window", valueJson: { maxDays: 30, windowDays: 90 } },
    ],
  });
});

function baseInput(companyId: string): CreateExperienceInput {
  return {
    companyId,
    periodYear: 2025,
    periodQuarter: 2,
    processDescription: "שיחת סינון עם מגייס/ת, ואז שלב טכני מקוון של שעה.",
    whatIWishIKnew: "כדאי להתכונן על SQL.",
    topicTagIds: [],
    stages: [
      {
        stage: "TECHNICAL_SCREEN",
        format: "ONLINE",
        approxDurationMinutes: 60,
        questions: [
          { text: "כתבו שאילתת SQL שמחזירה את שלושת הלקוחות המובילים.", isFollowUp: false },
          { text: "איך הייתם משפרים את הביצועים של השאילתה?", isFollowUp: true },
        ],
      },
    ],
  };
}

const attestation = {
  attestedOwnExperience: true,
  attestedTruthful: true,
  attestedPermitted: true,
  attestedNoConfidential: true,
  attestedParaphrased: true,
};

describe("submission lifecycle", () => {
  it("moves DRAFT -> PENDING_REVIEW only once the attestation is complete", async () => {
    const acme = await createTestCompany("Acme");
    const author = await createTestUser();
    const experienceId = await saveDraftExperience(author.user.id, baseInput(acme.id));

    const incomplete = await submitForReview(author.user.id, experienceId, { ...attestation, attestedTruthful: false });
    expect(incomplete).toEqual({ ok: false, reason: "attestation_incomplete" });

    const complete = await submitForReview(author.user.id, experienceId, attestation);
    expect(complete).toEqual({ ok: true });

    const experience = await prisma.interviewExperience.findUniqueOrThrow({ where: { id: experienceId } });
    expect(experience.status).toBe("PENDING_REVIEW");
  });

  it("grants no credit merely for submitting", async () => {
    const acme = await createTestCompany("Acme");
    const author = await createTestUser();
    const experienceId = await saveDraftExperience(author.user.id, baseInput(acme.id));
    await submitForReview(author.user.id, experienceId, attestation);
    expect(await getCreditBalance(author.user.id)).toBe(0);
  });

  it("does not let another user edit or submit someone else's draft", async () => {
    const acme = await createTestCompany("Acme");
    const author = await createTestUser();
    const stranger = await createTestUser();
    const experienceId = await saveDraftExperience(author.user.id, baseInput(acme.id));

    await expect(saveDraftExperience(stranger.user.id, baseInput(acme.id), experienceId)).rejects.toThrow();
    const result = await submitForReview(stranger.user.id, experienceId, attestation);
    expect(result).toEqual({ ok: false, reason: "not_found" });
  });
});

describe("moderation -> scheduled publication -> lazy publish", () => {
  it("approves, grants credit exactly once (idempotent), schedules, and publishes only once publishAt has passed", async () => {
    const acme = await createTestCompany("Acme");
    const author = await createTestUser();
    const moderator = await createTestUser();
    const experienceId = await saveDraftExperience(author.user.id, baseInput(acme.id));
    await submitForReview(author.user.id, experienceId, attestation);

    await approveContribution(moderator.user.id, experienceId, 14);
    // approving twice (e.g. a retried request) must not double-grant credit
    await expect(approveContribution(moderator.user.id, experienceId, 14)).rejects.toThrow();

    const scheduled = await prisma.interviewExperience.findUniqueOrThrow({ where: { id: experienceId } });
    expect(scheduled.status).toBe("SCHEDULED_FOR_PUBLICATION");
    expect(scheduled.publishAt!.getTime()).toBeGreaterThan(Date.now());

    // reward: base 20 + 2 questions * 2 credits = 24
    expect(await getCreditBalance(author.user.id)).toBe(24);

    // not visible yet — publishAt is in the future
    expect(await browseExperiences({})).toHaveLength(0);

    // move publishAt into the past and re-browse — lazy publish should promote it
    await prisma.interviewExperience.update({ where: { id: experienceId }, data: { publishAt: new Date(Date.now() - 1000) } });
    const published = await browseExperiences({});
    expect(published).toHaveLength(1);
    expect(published[0].companyName).toBe("Acme");

    const finalRow = await prisma.interviewExperience.findUniqueOrThrow({ where: { id: experienceId } });
    expect(finalRow.status).toBe("PUBLISHED");
  });

  it("moves to NEEDS_CHANGES with a message the author can see, and back to PENDING_REVIEW on resubmission", async () => {
    const acme = await createTestCompany("Acme");
    const author = await createTestUser();
    const moderator = await createTestUser();
    const experienceId = await saveDraftExperience(author.user.id, baseInput(acme.id));
    await submitForReview(author.user.id, experienceId, attestation);

    await requestChanges(moderator.user.id, experienceId, "אנא הסירו את שם הצוות הספציפי.");

    const experience = await prisma.interviewExperience.findUniqueOrThrow({ where: { id: experienceId } });
    expect(experience.status).toBe("NEEDS_CHANGES");

    const revision = await prisma.contributionRevisionRequest.findFirstOrThrow({ where: { experienceId } });
    expect(revision.message).toContain("שם הצוות");

    await saveDraftExperience(author.user.id, baseInput(acme.id), experienceId);
    const resubmit = await submitForReview(author.user.id, experienceId, attestation);
    expect(resubmit).toEqual({ ok: true });
  });

  it("rejects without granting credit", async () => {
    const acme = await createTestCompany("Acme");
    const author = await createTestUser();
    const moderator = await createTestUser();
    const experienceId = await saveDraftExperience(author.user.id, baseInput(acme.id));
    await submitForReview(author.user.id, experienceId, attestation);

    await rejectContribution(moderator.user.id, experienceId, "לא ברור מספיק");
    expect((await prisma.interviewExperience.findUniqueOrThrow({ where: { id: experienceId } })).status).toBe("REJECTED");
    expect(await getCreditBalance(author.user.id)).toBe(0);
  });

  it("notifies the author in-app of every moderation decision", async () => {
    const acme = await createTestCompany("Acme");
    const author = await createTestUser();
    const moderator = await createTestUser();
    const submit = async () => {
      const id = await saveDraftExperience(author.user.id, baseInput(acme.id));
      await submitForReview(author.user.id, id, attestation);
      return id;
    };

    await approveContribution(moderator.user.id, await submit(), 14);
    await requestChanges(moderator.user.id, await submit(), "אנא הסירו פרטים מזהים.");
    await rejectContribution(moderator.user.id, await submit(), "לא ברור מספיק");

    const notifications = await prisma.notification.findMany({
      where: { userId: author.user.id },
      orderBy: { createdAt: "asc" },
    });
    expect(notifications.map((n) => n.type)).toEqual([
      "CONTRIBUTION_APPROVED",
      "CONTRIBUTION_NEEDS_CHANGES",
      "CONTRIBUTION_REJECTED",
    ]);
    expect(await prisma.notification.count({ where: { userId: moderator.user.id } })).toBe(0);
  });

  it("reverses the credit grant when a published contribution is removed for fraud", async () => {
    const acme = await createTestCompany("Acme");
    const author = await createTestUser();
    const moderator = await createTestUser();
    const experienceId = await saveDraftExperience(author.user.id, baseInput(acme.id));
    await submitForReview(author.user.id, experienceId, attestation);
    await approveContribution(moderator.user.id, experienceId, 14);
    expect(await getCreditBalance(author.user.id)).toBe(24);

    await removeContribution(moderator.user.id, experienceId, "duplicate submission", true);

    expect(await getCreditBalance(author.user.id)).toBe(0);
    expect((await prisma.interviewExperience.findUniqueOrThrow({ where: { id: experienceId } })).status).toBe("REMOVED");
  });

  it("does not reverse credit on a routine takedown when reverseReward is false", async () => {
    const acme = await createTestCompany("Acme");
    const author = await createTestUser();
    const moderator = await createTestUser();
    const experienceId = await saveDraftExperience(author.user.id, baseInput(acme.id));
    await submitForReview(author.user.id, experienceId, attestation);
    await approveContribution(moderator.user.id, experienceId, 14);

    await removeContribution(moderator.user.id, experienceId, "company requested removal", false);
    expect(await getCreditBalance(author.user.id)).toBe(24);
  });
});

describe("withdrawContribution", () => {
  it("lets the author withdraw at any stage without reversing any grant automatically", async () => {
    const acme = await createTestCompany("Acme");
    const author = await createTestUser();
    const experienceId = await saveDraftExperience(author.user.id, baseInput(acme.id));
    await withdrawContribution(author.user.id, experienceId);
    expect((await prisma.interviewExperience.findUniqueOrThrow({ where: { id: experienceId } })).status).toBe(
      "WITHDRAWN_BY_AUTHOR",
    );
  });

  it("refuses to withdraw someone else's contribution", async () => {
    const acme = await createTestCompany("Acme");
    const author = await createTestUser();
    const stranger = await createTestUser();
    const experienceId = await saveDraftExperience(author.user.id, baseInput(acme.id));
    await expect(withdrawContribution(stranger.user.id, experienceId)).rejects.toThrow();
  });
});

describe("anonymous library responses", () => {
  async function publishOne(companyId: string) {
    const author = await createTestUser();
    const moderator = await createTestUser();
    const experienceId = await saveDraftExperience(author.user.id, baseInput(companyId));
    await submitForReview(author.user.id, experienceId, attestation);
    await approveContribution(moderator.user.id, experienceId, 0); // publish immediately (0-day delay)
    return { author, experienceId };
  }

  it("never includes the author's id anywhere in a browse or detail response", async () => {
    const acme = await createTestCompany("Acme");
    const { author } = await publishOne(acme.id);

    const list = await browseExperiences({});
    expect(JSON.stringify(list)).not.toContain(author.user.id);

    const detail = await getPublicExperienceDetail(list[0].id);
    expect(JSON.stringify(detail)).not.toContain(author.user.id);
    expect(detail).not.toHaveProperty("authorId");
  });

  it("hides aggregate company stats below the independent-contributor threshold, and shows them once it's met", async () => {
    const acme = await createTestCompany("Acme");
    await publishOne(acme.id);

    const belowThreshold = await getCompanyLibrarySummary(acme.id);
    expect(belowThreshold?.canShowAggregateStats).toBe(false);
    expect(belowThreshold?.commonStages).toEqual([]);

    await publishOne(acme.id);
    await publishOne(acme.id);

    const atThreshold = await getCompanyLibrarySummary(acme.id);
    expect(atThreshold?.canShowAggregateStats).toBe(true);
    expect(atThreshold?.commonStages).toContain("TECHNICAL_SCREEN");
    expect(atThreshold?.totalReports).toBe(3);
  });
});

describe("community validation", () => {
  it("blocks self-validation", async () => {
    const acme = await createTestCompany("Acme");
    const author = await createTestUser();
    const moderator = await createTestUser();
    const experienceId = await saveDraftExperience(author.user.id, baseInput(acme.id));
    await submitForReview(author.user.id, experienceId, attestation);
    await approveContribution(moderator.user.id, experienceId, 0);

    const result = await submitValidation(author.user.id, experienceId, "USEFUL");
    expect(result).toEqual({ ok: false, reason: "self_validation" });
  });

  it("blocks a second identical validation from the same user", async () => {
    const acme = await createTestCompany("Acme");
    const author = await createTestUser();
    const moderator = await createTestUser();
    const voter = await createTestUser();
    const experienceId = await saveDraftExperience(author.user.id, baseInput(acme.id));
    await submitForReview(author.user.id, experienceId, attestation);
    await approveContribution(moderator.user.id, experienceId, 0);

    expect(await submitValidation(voter.user.id, experienceId, "USEFUL")).toEqual({ ok: true });
    expect(await submitValidation(voter.user.id, experienceId, "USEFUL")).toEqual({
      ok: false,
      reason: "already_submitted",
    });
  });

  it("refuses to validate an unpublished contribution", async () => {
    const acme = await createTestCompany("Acme");
    const author = await createTestUser();
    const voter = await createTestUser();
    const experienceId = await saveDraftExperience(author.user.id, baseInput(acme.id));

    expect(await submitValidation(voter.user.id, experienceId, "USEFUL")).toEqual({
      ok: false,
      reason: "not_published",
    });
  });
});
