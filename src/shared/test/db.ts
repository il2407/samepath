import { prisma } from "@/shared/db";
import { env } from "@/shared/env";

/** Wipes every table in the test database. Call from a test's beforeEach/afterEach. */
export async function resetTestDatabase(): Promise<void> {
  if (env.NODE_ENV !== "test" || !env.DATABASE_URL.includes("samepath_test")) {
    throw new Error(
      "resetTestDatabase() refused to run: DATABASE_URL does not look like the test database. " +
        "Check that .env.test is loaded (NODE_ENV=test) before calling this.",
    );
  }
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename != '_prisma_migrations'
  `;
  if (tables.length === 0) return;
  const names = tables.map((t) => `"public"."${t.tablename}"`).join(", ");
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${names} RESTART IDENTITY CASCADE`);
}
