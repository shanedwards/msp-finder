import { CompanySizeTier, CompanyRow } from "@/lib/msp/types";

export type ResultsAgeFilter = "all" | "new" | "old";
export type ScoreFilter = "all" | "unscored" | "high" | "medium" | "low";

export type DashboardFilters = {
  states: string[];
  city: string;
  mustSupportAws: boolean;
  mustSupportAzure: boolean;
  resultLimit: string;
  extraCriteria: string;
  seedCompanies: string;
  resultsView: ResultsAgeFilter;
  scoreFilter: ScoreFilter;
  sizeTiers: CompanySizeTier[];
};

export type DashboardCompanyRow = CompanyRow;
