import "server-only";
import { prisma } from "@/shared/db";
import type { RawProfileForDto } from "@/modules/profiles/dto";

/**
 * Loads only the viewer's own `shareCompanyPreMatch` — the second half of
 * the reciprocal employer-visibility check (backlog item 8). Deliberately a
 * separate, minimal loader rather than reusing loadRawProfileForDto(viewerId)
 * for this: the caller only ever needs this one boolean about the viewer,
 * and a dedicated function makes the reciprocal-check call site
 * (matching/service.ts) obviously correct — there's no raw profile object
 * to accidentally read the wrong side's fields off of.
 */
export async function loadViewerShareCompanyPreMatch(userId: string): Promise<boolean> {
  const preference = await prisma.identityDisclosurePreference.findFirst({
    where: { profile: { userId } },
    select: { shareCompanyPreMatch: true },
  });
  return preference?.shareCompanyPreMatch ?? false;
}

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
        connectionPreference: true,
        availabilitySlots: { select: { dayOfWeek: true, startMinute: true, endMinute: true } },
        disclosurePreference: true,
      },
    }),
  ]);
  if (!user || !profile) return null;

  return {
    currentRoleTitle: profile.currentRoleTitle,
    professionalField: profile.professionalField,
    seniorityBand: profile.seniorityBand,
    targetRoles: profile.targetRoles.map((r) => r.targetRole),
    tags: profile.tags.map((t) => t.tag),
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
    experienceMonths: profile.experienceMonths,
    disclosurePreference: profile.disclosurePreference,
    userEmail: user.email,
  };
}
