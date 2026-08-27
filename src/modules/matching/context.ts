import "server-only";
import { prisma } from "@/shared/db";
import type { ScoringProfile } from "@/modules/matching/scoring";

export async function loadScoringProfile(userId: string): Promise<ScoringProfile | null> {
  const profile = await prisma.professionalProfile.findUnique({
    where: { userId },
    include: {
      targetRoles: { select: { targetRoleId: true } },
      tags: { select: { tagId: true } },
      languages: { select: { languageId: true } },
      connectionPreference: true,
      availabilitySlots: { select: { dayOfWeek: true, startMinute: true, endMinute: true } },
    },
  });
  if (!profile) return null;

  return {
    targetRoleIds: profile.targetRoles.map((r) => r.targetRoleId),
    professionalFieldId: profile.professionalFieldId,
    experienceMonths: profile.experienceMonths,
    tagIds: profile.tags.map((t) => t.tagId),
    languageIds: profile.languages.map((l) => l.languageId),
    timezone: profile.connectionPreference?.timezone ?? "Asia/Jerusalem",
    connectionFormat: profile.connectionPreference?.format ?? "BOTH",
    connectionCadence: profile.connectionPreference?.cadence ?? "BOTH",
    connectionMode: profile.connectionPreference?.mode ?? "BOTH",
    availability: profile.availabilitySlots,
  };
}
