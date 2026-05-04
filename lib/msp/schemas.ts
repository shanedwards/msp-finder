import {
  DEFAULT_RESULT_LIMIT,
  MAX_FINAL_RESULTS,
  SUPPORTED_SOURCE_TYPES,
} from "@/lib/msp/constants";
import {
  NormalizedSearchFilters,
  SearchFiltersInput,
  SourceType,
} from "@/lib/msp/types";
import { normalizeStateCodes } from "@/lib/msp/us-states";
import { z } from "zod";

const booleanishSchema = z
  .union([z.boolean(), z.string()])
  .optional()
  .transform((value) => {
    if (typeof value === "boolean") {
      return value;
    }
    if (typeof value === "string") {
      return ["1", "true", "yes", "on"].includes(value.toLowerCase());
    }
    return false;
  });

export const searchFiltersInputSchema = z.object({
  states: z.array(z.string()).optional(),
  city: z.string().trim().max(120).nullable().optional(),
  minimumEmployees: z.number().int().min(0).nullable().optional(),
  maximumEmployees: z.number().int().min(0).nullable().optional(),
  mustSupportAws: booleanishSchema,
  mustSupportAzure: booleanishSchema,
  mustHaveAwsResellerEvidence: booleanishSchema,
  mustHaveAzurePartnerEvidence: booleanishSchema,
  showOnlyVerified: booleanishSchema,
  includeNeedsReview: booleanishSchema,
  resultLimit: z.number().int().min(1).max(100).nullable().optional(),
  extraCriteria: z.string().trim().max(1000).nullable().optional(),
  seedCompanies: z.array(z.string().trim().max(200)).max(20).optional(),
});

export function normalizeSearchFilters(
  input: SearchFiltersInput,
): NormalizedSearchFilters {
  const parsed = searchFiltersInputSchema.parse(input);

  const minimumEmployees = parsed.minimumEmployees ?? null;
  const maximumEmployees = parsed.maximumEmployees ?? null;

  return {
    states: normalizeStateCodes(parsed.states ?? []),
    city: parsed.city?.trim() ? parsed.city.trim() : null,
    minimumEmployees,
    maximumEmployees:
      maximumEmployees !== null &&
      minimumEmployees !== null &&
      maximumEmployees < minimumEmployees
        ? minimumEmployees
        : maximumEmployees,
    mustSupportAws: parsed.mustSupportAws ?? false,
    mustSupportAzure: parsed.mustSupportAzure ?? false,
    mustHaveAwsResellerEvidence: parsed.mustHaveAwsResellerEvidence ?? false,
    mustHaveAzurePartnerEvidence: parsed.mustHaveAzurePartnerEvidence ?? false,
    showOnlyVerified: parsed.showOnlyVerified ?? false,
    includeNeedsReview: parsed.includeNeedsReview ?? true,
    resultLimit: Math.min(parsed.resultLimit ?? DEFAULT_RESULT_LIMIT, MAX_FINAL_RESULTS),
    extraCriteria: parsed.extraCriteria?.trim() ? parsed.extraCriteria.trim() : null,
    seedCompanies: (parsed.seedCompanies ?? []).map((s) => s.trim()).filter(Boolean),
  };
}

export function parseCompanyListFiltersFromSearchParams(
  params: URLSearchParams,
): NormalizedSearchFilters {
  return normalizeSearchFilters({
    states: params.getAll("state"),
    city: params.get("city"),
    minimumEmployees: parseNumberOrNull(params.get("minEmployees")),
    maximumEmployees: parseNumberOrNull(params.get("maxEmployees")),
    mustSupportAws: parseBooleanOrDefault(params.get("mustSupportAws"), false),
    mustSupportAzure: parseBooleanOrDefault(params.get("mustSupportAzure"), false),
    mustHaveAwsResellerEvidence: parseBooleanOrDefault(
      params.get("mustHaveAwsResellerEvidence"),
      false,
    ),
    mustHaveAzurePartnerEvidence: parseBooleanOrDefault(
      params.get("mustHaveAzurePartnerEvidence"),
      false,
    ),
    showOnlyVerified: parseBooleanOrDefault(params.get("showOnlyVerified"), false),
    includeNeedsReview: parseBooleanOrDefault(params.get("includeNeedsReview"), true),
    resultLimit: parseNumberOrNull(params.get("resultLimit")),
    extraCriteria: params.get("extraCriteria"),
  });
}

export const candidateSourceSchema = z.object({
  url: z.string().url(),
  title: z.string().trim().max(300).nullable().default(null),
  sourceType: z.enum(SUPPORTED_SOURCE_TYPES),
  claim: z.string().trim().min(5).max(400),
  supportsMsp: z.boolean().default(false),
  supportsAws: z.boolean().default(false),
  supportsAzure: z.boolean().default(false),
  supportsEmployeeCount: z.boolean().default(false),
  supportsHeadquarters: z.boolean().default(false),
});

export const COMPANY_SIZE_TIERS = ["micro", "small", "mid", "large"] as const;

export const extractedCandidateSchema = z.object({
  companyName: z.string().trim().min(2).max(200),
  website: z.string().url().nullable().default(null),
  headquartersCity: z.string().trim().max(120).nullable().default(null),
  headquartersState: z.string().trim().max(20).nullable().default(null),
  employeeCountExact: z.number().int().min(0).nullable().default(null),
  employeeCountMin: z.number().int().min(0).nullable().default(null),
  employeeCountMax: z.number().int().min(0).nullable().default(null),
  companySizeTier: z.enum(COMPANY_SIZE_TIERS).nullable().default(null),
  awsSupport: z.boolean().default(false),
  azureSupport: z.boolean().default(false),
  awsPartnerClaimed: z.boolean().default(false),
  azurePartnerClaimed: z.boolean().default(false),
  awsResellerConfirmed: z.boolean().default(false),
  azureResellerConfirmed: z.boolean().default(false),
  isMsp: z.boolean().default(false),
  disqualifierType: z.string().trim().max(120).nullable().default(null),
  sources: z.array(candidateSourceSchema).max(20).default([]),
});

export const extractedCandidatesResponseSchema = z.object({
  companies: z.array(extractedCandidateSchema).max(60).default([]),
});

export const searchRequestSchema = z
  .object({
    filters: searchFiltersInputSchema.optional(),
  })
  .refine(
    (data) => (data.filters?.mustSupportAws ?? false) || (data.filters?.mustSupportAzure ?? false),
    { message: "At least one of 'Must support AWS' or 'Must support Azure' must be selected." },
  );

export const exportRequestSchema = z.object({
  filters: searchFiltersInputSchema.optional(),
});

export const verifyCompanyRequestSchema = z.object({
  decision: z.enum(["approved", "rejected", "needs_review"]),
  notes: z.string().trim().max(1000).nullable().optional(),
});

export const scoreCompanyRequestSchema = z.object({
  score: z.number().min(0).max(10).nullable(),
  note: z.string().trim().max(1000).nullable().optional(),
});

export type ExtractedCandidateFromSchema = z.infer<typeof extractedCandidateSchema>;

export function sanitizeSourceType(value: string): SourceType {
  if ((SUPPORTED_SOURCE_TYPES as readonly string[]).includes(value)) {
    return value as SourceType;
  }

  return "other";
}

function parseBooleanOrDefault(value: string | null, fallback: boolean): boolean {
  if (value === null) {
    return fallback;
  }

  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

function parseNumberOrNull(value: string | null): number | null {
  if (value === null || value.trim() === "") {
    return null;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  return Math.trunc(parsed);
}
