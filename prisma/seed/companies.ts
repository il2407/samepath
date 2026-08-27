import { PrismaClient } from "@/generated/prisma/client";

/**
 * Entirely fictional companies for local development and demos — never real
 * employers. Includes a corporate-group pair (parent + subsidiary) so the
 * group-blocking privacy rule has something real to exercise.
 */
export async function seedCompanies(prisma: PrismaClient) {
  const group = await prisma.corporateGroup.upsert({
    where: { id: "seed-group-northwind" },
    update: {},
    create: { id: "seed-group-northwind", name: "Northwind Group" },
  });

  const parent = await upsertCompany(prisma, "seed-co-northwind", "Northwind Dynamics", group.id, ["נורת׳ווינד"]);
  await upsertCompany(prisma, "seed-co-northwind-il", "Northwind Dynamics Israel Ltd.", group.id, [
    "נורת׳ווינד ישראל",
  ]);

  await upsertCompany(prisma, "seed-co-initech", "Initech Software", null, ["איניטק"]);
  await upsertCompany(prisma, "seed-co-globex", "Globex Systems", null, []);
  await upsertCompany(prisma, "seed-co-umbrella", "Umbrella Cloud Technologies", null, []);
  await upsertCompany(prisma, "seed-co-soundwave", "Soundwave Labs", null, []);
  await upsertCompany(prisma, "seed-co-acme", "Acme Platform Systems", null, ["אקמי"]);

  return { northwindGroupId: group.id, northwindParentId: parent.id };
}

async function upsertCompany(
  prisma: PrismaClient,
  id: string,
  canonicalName: string,
  corporateGroupId: string | null,
  aliases: string[],
) {
  const company = await prisma.company.upsert({
    where: { id },
    update: { canonicalName, corporateGroupId },
    create: { id, canonicalName, corporateGroupId },
  });
  for (const alias of aliases) {
    await prisma.companyAlias.upsert({
      where: { companyId_alias: { companyId: company.id, alias } },
      update: {},
      create: { companyId: company.id, alias },
    });
  }
  return company;
}
