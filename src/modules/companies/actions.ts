"use server";

import { requireUser } from "@/modules/auth/session";
import { createCompanyFromUserInput, searchCompanies, type CompanySearchResult } from "@/modules/companies/service";

export async function searchCompaniesAction(query: string): Promise<CompanySearchResult[]> {
  await requireUser();
  return searchCompanies(query);
}

export async function createCompanyAction(name: string): Promise<{ id: string; canonicalName: string }> {
  await requireUser();
  return createCompanyFromUserInput(name);
}
