import "dotenv/config";
import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { seedReferenceData } from "./seed/reference-data";
import { seedCompanies } from "./seed/companies";
import { seedConfig } from "./seed/config";
import { seedUsers } from "./seed/users";
import { seedGuides } from "./seed/guides";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Seeding reference data (fields, roles, bands, languages, regions, tags)...");
  await seedReferenceData(prisma);

  console.log("Seeding fictional companies...");
  await seedCompanies(prisma);

  console.log("Seeding product/reward configuration...");
  await seedConfig(prisma);

  console.log("Seeding fictional users and groups...");
  await seedUsers(prisma);

  console.log("Seeding optional session guides...");
  await seedGuides(prisma);

  console.log("Done.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
