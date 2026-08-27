import "server-only";
import { prisma } from "@/shared/db";
import { matchQuality, normalizeCompanyName, type MatchQuality } from "@/modules/companies/normalize";

export interface CompanySearchResult {
  id: string;
  canonicalName: string;
  corporateGroupId: string | null;
  quality: MatchQuality;
}

const qualityRank: Record<MatchQuality, number> = { exact: 3, close: 2, partial: 1, none: 0 };

/**
 * Typeahead search for the employer picker. Tries an indexed ILIKE search
 * first (name or any alias); if that comes up short, falls back to fuzzy
 * matching over a bounded pool of companies so typos still surface a
 * result. The bounded fallback (500 rows) is an MVP tradeoff — replace
 * with a trigram/search index (e.g. pg_trgm) before the company table
 * grows past a few thousand rows.
 */
export async function searchCompanies(rawQuery: string, limit = 8): Promise<CompanySearchResult[]> {
  const trimmed = rawQuery.trim();
  const query = normalizeCompanyName(trimmed);
  if (query.length < 2) return [];

  const indexed = await prisma.company.findMany({
    where: {
      mergedIntoId: null,
      OR: [
        { canonicalName: { contains: trimmed, mode: "insensitive" } },
        { aliases: { some: { alias: { contains: trimmed, mode: "insensitive" } } } },
      ],
    },
    include: { aliases: true },
    take: 50,
  });

  const pool = [...indexed];
  if (pool.length < limit) {
    const seen = new Set(pool.map((c) => c.id));
    const broader = await prisma.company.findMany({
      where: { mergedIntoId: null },
      include: { aliases: true },
      take: 500,
    });
    for (const company of broader) {
      if (!seen.has(company.id)) pool.push(company);
    }
  }

  const scored = pool
    .map((company) => {
      const names = [company.canonicalName, ...company.aliases.map((a) => a.alias)].map(normalizeCompanyName);
      let best: MatchQuality = "none";
      for (const name of names) {
        const quality = matchQuality(query, name);
        if (qualityRank[quality] > qualityRank[best]) best = quality;
      }
      return { company, quality: best };
    })
    .filter((r) => r.quality !== "none")
    .sort(
      (a, b) =>
        qualityRank[b.quality] - qualityRank[a.quality] ||
        a.company.canonicalName.localeCompare(b.company.canonicalName),
    );

  return scored.slice(0, limit).map((r) => ({
    id: r.company.id,
    canonicalName: r.company.canonicalName,
    corporateGroupId: r.company.corporateGroupId,
    quality: r.quality,
  }));
}

/**
 * Creates a brand-new company from free text the user typed when nothing in
 * the search results matched. Flagged NEEDS_REVIEW so an admin can later
 * merge it into an existing company if it turns out to be a duplicate.
 */
export async function createCompanyFromUserInput(rawName: string): Promise<{ id: string; canonicalName: string }> {
  const canonicalName = rawName.trim();
  if (!canonicalName) throw new Error("company name is required");
  return prisma.company.create({
    data: { canonicalName, normalizationStatus: "NEEDS_REVIEW" },
    select: { id: true, canonicalName: true },
  });
}

/**
 * Merges `sourceId` into `targetId`: the source's name becomes an alias of
 * the target, every reference (employment history, current-employer links,
 * interview-library entries, blocked-company entries, takedown requests) is
 * repointed at the target, and the source is marked MERGED so it never
 * surfaces in search again. Blocked-company de-duplicates per user so a
 * merge can never silently drop someone's block.
 */
export async function mergeCompanies(sourceId: string, targetId: string): Promise<void> {
  if (sourceId === targetId) throw new Error("cannot merge a company into itself");

  await prisma.$transaction(async (tx) => {
    const [source, target] = await Promise.all([
      tx.company.findUniqueOrThrow({ where: { id: sourceId } }),
      tx.company.findUniqueOrThrow({ where: { id: targetId } }),
    ]);
    if (target.mergedIntoId) {
      throw new Error("merge target is itself merged into another company");
    }

    await tx.companyAlias.upsert({
      where: { companyId_alias: { companyId: targetId, alias: source.canonicalName } },
      update: {},
      create: { companyId: targetId, alias: source.canonicalName },
    });

    const sourceAliases = await tx.companyAlias.findMany({ where: { companyId: sourceId } });
    for (const alias of sourceAliases) {
      await tx.companyAlias.upsert({
        where: { companyId_alias: { companyId: targetId, alias: alias.alias } },
        update: {},
        create: { companyId: targetId, alias: alias.alias },
      });
    }
    await tx.companyAlias.deleteMany({ where: { companyId: sourceId } });

    await tx.employmentPosition.updateMany({ where: { companyId: sourceId }, data: { companyId: targetId } });
    await tx.professionalProfile.updateMany({
      where: { currentCompanyId: sourceId },
      data: { currentCompanyId: targetId },
    });
    await tx.interviewExperience.updateMany({ where: { companyId: sourceId }, data: { companyId: targetId } });
    await tx.takedownRequest.updateMany({ where: { companyId: sourceId }, data: { companyId: targetId } });

    const sourceBlocks = await tx.blockedCompany.findMany({ where: { companyId: sourceId } });
    for (const block of sourceBlocks) {
      const existing = await tx.blockedCompany.findUnique({
        where: { userId_companyId: { userId: block.userId, companyId: targetId } },
      });
      if (existing) {
        await tx.blockedCompany.delete({ where: { id: block.id } });
      } else {
        await tx.blockedCompany.update({ where: { id: block.id }, data: { companyId: targetId } });
      }
    }

    await tx.company.update({
      where: { id: sourceId },
      data: { mergedIntoId: targetId, normalizationStatus: "MERGED" },
    });
  });
}

/** Follows the merge chain to the live canonical company (never a merged-away row). */
export async function resolveCompanyId(companyId: string): Promise<string> {
  let current = await prisma.company.findUniqueOrThrow({
    where: { id: companyId },
    select: { id: true, mergedIntoId: true },
  });
  const visited = new Set<string>();
  while (current.mergedIntoId) {
    if (visited.has(current.id)) throw new Error("merge cycle detected");
    visited.add(current.id);
    current = await prisma.company.findUniqueOrThrow({
      where: { id: current.mergedIntoId },
      select: { id: true, mergedIntoId: true },
    });
  }
  return current.id;
}

/** All company ids in the same corporate group as `companyId` (including itself). */
export async function getCorporateGroupCompanyIds(companyId: string): Promise<string[]> {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { corporateGroupId: true },
  });
  if (!company?.corporateGroupId) return [companyId];
  const siblings = await prisma.company.findMany({
    where: { corporateGroupId: company.corporateGroupId },
    select: { id: true },
  });
  return siblings.map((s) => s.id);
}
