import "server-only";
import { prisma } from "@/shared/db";
import type { RawProfileForDto } from "@/modules/profiles/dto";

export async function loadRawProfileForDto(userId: string): Promise<RawProfileForDto | null> {
  const [user, profile] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { email: true } }),
    prisma.professionalProfile.findUnique({
      where: { userId },
      include: {
        professionalField: { select: { labelHe: true } },
        seniorityBand: { select: { labelHe: true } },
        region: { select: { labelHe: true } },
        currentCompany: { select: { canonicalName: true } },
        targetRoles: { include: { targetRole: { select: { labelHe: true } } } },
        tags: { include: { tag: { select: { labelHe: true } } } },
        languages: { include: { language: { select: { labelHe: true } } } },
        connectionPreference: true,
        availabilitySlots: { select: { dayOfWeek: true, startMinute: true, endMinute: true } },
        disclosurePreference: true,
      },
    }),
  ]);
  if (!user || !profile) return null;

  return {
    professionalField: profile.professionalField,
    seniorityBand: profile.seniorityBand,
    targetRoles: profile.targetRoles.map((r) => r.targetRole),
    tags: profile.tags.map((t) => t.tag),
    languages: profile.languages.map((l) => l.language),
    shortIntro: profile.shortIntro,
    connectionPreference: profile.connectionPreference
      ? {
          format: profile.connectionPreference.format,
          cadence: profile.connectionPreference.cadence,
          mode: profile.connectionPreference.mode,
          reasons: profile.connectionPreference.reasons,
        }
      : null,
    availabilitySlots: profile.availabilitySlots,
    region: profile.region,
    company: profile.currentCompany,
    cvVerifiedAt: profile.cvVerifiedAt,
    disclosurePreference: profile.disclosurePreference,
    userEmail: user.email,
  };
}
