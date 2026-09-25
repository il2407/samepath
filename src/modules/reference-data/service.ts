import "server-only";
import { prisma } from "@/shared/db";

/** Read-only lookups shared by onboarding, matching, groups, and the interview library. */

export async function listProfessionalFields() {
  return prisma.professionalField.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } });
}

export async function listTargetRoles(professionalFieldId?: string) {
  return prisma.targetRole.findMany({
    where: { isActive: true, professionalFieldId },
    orderBy: { sortOrder: "asc" },
  });
}

export async function listSeniorityBands() {
  return prisma.seniorityBand.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } });
}

export async function listRegions() {
  return prisma.region.findMany({ orderBy: { code: "asc" } });
}

export async function listTags(kind?: "SKILL" | "DOMAIN" | "TOPIC") {
  return prisma.tag.findMany({ where: { isActive: true, kind }, orderBy: { labelHe: "asc" } });
}

export async function loadOnboardingFormOptions() {
  const [fields, bands, regions, skills, domains] = await Promise.all([
    listProfessionalFields(),
    listSeniorityBands(),
    listRegions(),
    listTags("SKILL"),
    listTags("DOMAIN"),
  ]);
  const targetRolesByField = await Promise.all(fields.map((f) => listTargetRoles(f.id)));
  return {
    fields,
    targetRoles: targetRolesByField.flat(),
    bands,
    regions,
    skills,
    domains,
  };
}
