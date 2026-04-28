import { UsStateCode } from "@/lib/msp/us-states";
import { SUPPORTED_SOURCE_TYPES } from "@/lib/msp/constants";

export type VerificationStatus = "verified" | "needs_review" | "rejected";

export type CompanySizeTier = "micro" | "small" | "mid" | "large";

export type SourceType = (typeof SUPPORTED_SOURCE_TYPES)[number];

export type CompanyRow = {
  id: string;
  companyName: string;
  website: string | null;
  evidence: string;
  geography: string | null;
  employeeCount: string;
  companySizeTier: CompanySizeTier | null;
  score: number | null;
  notes: string | null;
  verificationStatus: VerificationStatus;
  createdAt: string;
  latestRunId: string | null;
};

export type SearchFiltersInput = {
  states?: string[];
  city?: string | null;
  minimumEmployees?: number | null;
  maximumEmployees?: number | null;
  mustSupportAws?: boolean;
  mustSupportAzure?: boolean;
  mustHaveAwsResellerEvidence?: boolean;
  mustHaveAzurePartnerEvidence?: boolean;
  showOnlyVerified?: boolean;
  includeNeedsReview?: boolean;
  resultLimit?: number | null;
  extraCriteria?: string | null;
  seedCompanies?: string[];
};

export type NormalizedSearchFilters = {
  states: UsStateCode[];
  city: string | null;
  minimumEmployees: number | null;
  maximumEmployees: number | null;
  mustSupportAws: boolean;
  mustSupportAzure: boolean;
  mustHaveAwsResellerEvidence: boolean;
  mustHaveAzurePartnerEvidence: boolean;
  showOnlyVerified: boolean;
  includeNeedsReview: boolean;
  resultLimit: number;
  extraCriteria: string | null;
  seedCompanies: string[];
};

export type CandidateSource = {
  url: string;
  title: string | null;
  sourceType: SourceType;
  claim: string;
  supportsMsp: boolean;
  supportsAws: boolean;
  supportsAzure: boolean;
  supportsEmployeeCount: boolean;
  supportsHeadquarters: boolean;
};

export type ExtractedCandidate = {
  companyName: string;
  website: string | null;
  headquartersCity: string | null;
  headquartersState: string | null;
  employeeCountExact: number | null;
  employeeCountMin: number | null;
  employeeCountMax: number | null;
  companySizeTier: CompanySizeTier | null;
  awsSupport: boolean;
  azureSupport: boolean;
  awsPartnerClaimed: boolean;
  azurePartnerClaimed: boolean;
  awsResellerConfirmed: boolean;
  azureResellerConfirmed: boolean;
  isMsp: boolean;
  disqualifierType: string | null;
  sources: CandidateSource[];
};

export type VerificationResult = {
  status: VerificationStatus;
  reason: string;
};

export type EvaluatedCandidate = ExtractedCandidate & {
  normalizedName: string;
  websiteDomain: string | null;
  verificationStatus: VerificationStatus;
  verificationReason: string;
  internalConfidenceScore: number;
  evidenceSummary: string;
};

export type SearchRunResult = {
  runId: string;
  persistedCount: number;
  verifiedCount: number;
  needsReviewCount: number;
  rejectedCount: number;
};

export type SearchPipelineState = {
  runId: string;
  userId: string | null;
  mockMode: boolean;
  filters: NormalizedSearchFilters;
  searchQueries: string[];
  researchPayloads: string[];
  extractedCandidates: ExtractedCandidate[];
  dedupedCandidates: ExtractedCandidate[];
  evaluatedCandidates: EvaluatedCandidate[];
  persistedCompanyIds: string[];
  errors: string[];
};

export type CompanyDetail = {
  id: string;
  companyName: string;
  website: string | null;
  evidenceSummary: string;
  geography: string | null;
  headquartersCity: string | null;
  headquartersState: string | null;
  employeeCount: string;
  companySizeTier: CompanySizeTier | null;
  score: number | null;
  notes: string | null;
  verificationStatus: VerificationStatus;
  verificationReason: string | null;
  internalConfidence: number;
  capabilities: {
    awsSupport: boolean;
    azureSupport: boolean;
    awsPartnerClaimed: boolean;
    azurePartnerClaimed: boolean;
    awsResellerConfirmed: boolean;
    azureResellerConfirmed: boolean;
  };
  extractedData: {
    employeeCountExact: number | null;
    employeeCountMin: number | null;
    employeeCountMax: number | null;
  };
  sources: CandidateSource[];
};
