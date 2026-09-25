import { prisma } from "@/shared/db";
import { logger } from "@/shared/logger";

/**
 * Uptime-monitor target: 200 when the app can reach Postgres, 503 when it
 * can't. Deliberately reveals nothing else (no version, no error text).
 */
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return Response.json({ status: "ok" }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    logger.error("health check: database unreachable", { error });
    return Response.json({ status: "unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
