import { createAdminClient } from "@/lib/supabase/admin";
import { formatEmployeeCount, formatGeography, getWebsiteDomain } from "@/lib/msp/formatting";
import {
  CandidateSource,
  CompanyDetail,
  CompanyRow,
  CompanySizeTier,
  EvaluatedCandidate,
  NormalizedSearchFilters,
} from "@/lib/msp/types";
import { normalizeStateCode } from "@/lib/msp/us-states";

function toNumberOrNull(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
}

function doesEmployeeCountMatch(
  exact: number | null,
  min: number | null,
  max: number | null,
  filters: NormalizedSearchFilters,
): boolean {
  if (filters.minimumEmployees === null && filters.maximumEmployees === null) {
    return true;
  }

  if (exact === null && min === null && max === null) {
    return false;
  }

  if (filters.minimumEmployees !== null) {
    const minimum = filters.minimumEmployees;

    if (exact !== null && exact < minimum) {
      return false;
    }

    if (exact === null && (min === null || min < minimum)) {
      return false;
    }
  }

  if (filters.maximumEmployees !== null) {
    const maximum = filters.maximumEmployees;

    if (exact !== null && exact > maximum) {
      return false;
    }

    if (exact === null && (max === null || max > maximum)) {
      return false;
    }
  }

  return true;
}

type CompanyWithRelations = {
  id: string;
  company_name: string;
  website: string | null;
  evidence_summary: string;
  headquarters_city: string | null;
  headquarters_state: string | null;
  user_score: number | string | null;
  user_notes: string | null;
  verification_status: "verified" | "needs_review" | "rejected";
  verification_reason: string | null;
  internal_confidence_score: number;
  created_at: string;
  latest_research_run_id: string | null;
  msp_company_size: {
    employee_count_exact: number | null;
    employee_count_min: number | null;
    employee_count_max: number | null;
    company_size_tier: CompanySizeTier | null;
  } | null;
  msp_capabilities: {
    aws_support: boolean;
    azure_support: boolean;
    aws_partner_claimed: boolean;
    azure_partner_claimed: boolean;
    aws_reseller_confirmed: boolean;
    azure_reseller_confirmed: boolean;
  } | null;
  msp_sources: {
    source_url: string;
    source_title: string | null;
    source_type: string;
    extracted_claim: string;
    supports_msp: boolean;
    supports_aws: boolean;
    supports_azure: boolean;
    supports_employee_count: boolean;
    supports_headquarters: boolean;
  }[];
};

function mapSources(raw: CompanyWithRelations["msp_sources"]): CandidateSource[] {
  return (raw ?? []).map((source) => ({
    url: source.source_url,
    title: source.source_title,
    sourceType: [
      "official_website",
      "linkedin",
      "partner_directory",
      "third_party",
      "other",
    ].includes(source.source_type)
      ? (source.source_type as CandidateSource["sourceType"])
      : "other",
    claim: source.extracted_claim,
    supportsMsp: source.supports_msp,
    supportsAws: source.supports_aws,
    supportsAzure: source.supports_azure,
    supportsEmployeeCount: source.supports_employee_count,
    supportsHeadquarters: source.supports_headquarters,
  }));
}

export async function createResearchRun(params: {
  userId: string | null;
  filters: NormalizedSearchFilters;
  mockMode: boolean;
}): Promise<string> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("research_runs")
    .insert({
      created_by: params.userId,
      filters_json: params.filters,
      status: "pending",
      mock_mode: params.mockMode,
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Unable to create research run.");
  }

  return data.id;
}

export async function completeResearchRun(params: {
  runId: string;
  totalCandidates: number;
  totalVerified: number;
  totalNeedsReview: number;
  totalRejected: number;
}): Promise<void> {
  const supabase = createAdminClient();

  const { error } = await supabase
    .from("research_runs")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
      total_candidates: params.totalCandidates,
      total_verified: params.totalVerified,
      total_needs_review: params.totalNeedsReview,
      total_rejected: params.totalRejected,
    })
    .eq("id", params.runId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function failResearchRun(runId: string, errorMessage: string): Promise<void> {
  const supabase = createAdminClient();
  await supabase
    .from("research_runs")
    .update({
      status: "failed",
      completed_at: new Date().toISOString(),
      error_message: errorMessage,
    })
    .eq("id", runId);
}

export async function upsertEvaluatedCandidate(params: {
  runId: string;
  userId: string | null;
  candidate: EvaluatedCandidate;
}): Promise<string> {
  const { candidate, runId, userId } = params;
  const supabase = createAdminClient();

  const websiteDomain = getWebsiteDomain(candidate.website);

  let existingCompanyId: string | null = null;

  if (websiteDomain) {
    const { data } = await supabase
      .from("msp_companies")
      .select("id")
      .eq("website_domain", websiteDomain)
      .maybeSingle();

    existingCompanyId = data?.id ?? null;
  }

  if (!existingCompanyId) {
    const { data } = await supabase
      .from("msp_companies")
      .select("id")
      .eq("normalized_name", candidate.normalizedName)
      .maybeSingle();

    existingCompanyId = data?.id ?? null;
  }

  if (existingCompanyId) {
    const { error: updateError } = await supabase
      .from("msp_companies")
      .update({
        latest_research_run_id: runId,
        company_name: candidate.companyName,
        website: candidate.website,
        website_domain: websiteDomain,
        headquarters_city: candidate.headquartersCity,
        headquarters_state: candidate.headquartersState,
        evidence_summary: candidate.evidenceSummary,
        verification_status: candidate.verificationStatus,
        verification_reason: candidate.verificationReason,
        internal_confidence_score: candidate.internalConfidenceScore,
        last_verified_at: new Date().toISOString(),
      })
      .eq("id", existingCompanyId);

    if (updateError) {
      throw new Error(updateError.message);
    }
  } else {
    const { data, error: insertError } = await supabase
      .from("msp_companies")
      .insert({
        latest_research_run_id: runId,
        created_by: userId,
        company_name: candidate.companyName,
        normalized_name: candidate.normalizedName,
        website: candidate.website,
        website_domain: websiteDomain,
        headquarters_city: candidate.headquartersCity,
        headquarters_state: candidate.headquartersState,
        evidence_summary: candidate.evidenceSummary,
        verification_status: candidate.verificationStatus,
        verification_reason: candidate.verificationReason,
        internal_confidence_score: candidate.internalConfidenceScore,
        last_verified_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (insertError || !data) {
      throw new Error(insertError?.message ?? "Failed to insert company.");
    }

    existingCompanyId = data.id;
  }

  const hasEmployeeEvidence = candidate.sources.some(
    (source) => source.supportsEmployeeCount,
  );

  const { error: sizeError } = await supabase.from("msp_company_size").upsert(
    {
      company_id: existingCompanyId,
      employee_count_exact: hasEmployeeEvidence ? candidate.employeeCountExact : null,
      employee_count_min: hasEmployeeEvidence ? candidate.employeeCountMin : null,
      employee_count_max: hasEmployeeEvidence ? candidate.employeeCountMax : null,
      company_size_tier: candidate.companySizeTier ?? null,
    },
    { onConflict: "company_id" },
  );

  if (sizeError) {
    throw new Error(sizeError.message);
  }

  const { error: capabilitiesError } = await supabase
    .from("msp_capabilities")
    .upsert(
      {
        company_id: existingCompanyId,
        aws_support: candidate.awsSupport,
        azure_support: candidate.azureSupport,
        aws_partner_claimed: candidate.awsPartnerClaimed,
        azure_partner_claimed: candidate.azurePartnerClaimed,
        aws_reseller_confirmed: candidate.awsResellerConfirmed,
        azure_reseller_confirmed: candidate.azureResellerConfirmed,
      },
      { onConflict: "company_id" },
    );

  if (capabilitiesError) {
    throw new Error(capabilitiesError.message);
  }

  const { error: deleteSourceError } = await supabase
    .from("msp_sources")
    .delete()
    .eq("company_id", existingCompanyId)
    .eq("research_run_id", runId);

  if (deleteSourceError) {
    throw new Error(deleteSourceError.message);
  }

  if (candidate.sources.length > 0) {
    const { error: sourceError } = await supabase.from("msp_sources").insert(
      candidate.sources.map((source) => ({
        company_id: existingCompanyId,
        research_run_id: runId,
        source_url: source.url,
        source_title: source.title,
        source_type: source.sourceType,
        extracted_claim: source.claim,
        supports_msp: source.supportsMsp,
        supports_aws: source.supportsAws,
        supports_azure: source.supportsAzure,
        supports_employee_count: source.supportsEmployeeCount,
        supports_headquarters: source.supportsHeadquarters,
      })),
    );

    if (sourceError) {
      throw new Error(sourceError.message);
    }
  }

  if (!existingCompanyId) {
    throw new Error("Failed to resolve company id.");
  }

  return existingCompanyId;
}

async function listCompaniesWithRelations(limit: number): Promise<CompanyWithRelations[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("msp_companies")
    .select(
      `
      id,
      company_name,
      website,
      evidence_summary,
      headquarters_city,
      headquarters_state,
      user_score,
      user_notes,
      verification_status,
      verification_reason,
      internal_confidence_score,
      created_at,
      latest_research_run_id,
      msp_company_size(employee_count_exact, employee_count_min, employee_count_max, company_size_tier),
      msp_capabilities(
        aws_support,
        azure_support,
        aws_partner_claimed,
        azure_partner_claimed,
        aws_reseller_confirmed,
        azure_reseller_confirmed
      ),
      msp_sources(
        source_url,
        source_title,
        source_type,
        extracted_claim,
        supports_msp,
        supports_aws,
        supports_azure,
        supports_employee_count,
        supports_headquarters
      )
    `,
    )
    .order("updated_at", { ascending: false })
    .limit(500);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as unknown as CompanyWithRelations[];
}

function companyMatchesFilters(
  company: CompanyWithRelations,
  filters: NormalizedSearchFilters,
): boolean {
  if (company.verification_status === "rejected") {
    return false;
  }

  if (!company.website) {
    return false;
  }

  const normalizedState = company.headquarters_state
    ? normalizeStateCode(company.headquarters_state)
    : null;

  if (filters.states.length > 0) {
    if (!normalizedState || !filters.states.includes(normalizedState)) {
      return false;
    }
  }

  if (filters.city) {
    if (!company.headquarters_city) {
      return false;
    }

    if (company.headquarters_city.toLowerCase() !== filters.city.toLowerCase()) {
      return false;
    }
  }

  const capabilities = company.msp_capabilities;

  if (filters.mustSupportAws && !capabilities?.aws_support) {
    return false;
  }

  if (filters.mustSupportAzure && !capabilities?.azure_support) {
    return false;
  }

  if (filters.mustHaveAwsResellerEvidence && !capabilities?.aws_reseller_confirmed) {
    return false;
  }

  if (
    filters.mustHaveAzurePartnerEvidence &&
    !capabilities?.azure_partner_claimed &&
    !capabilities?.azure_reseller_confirmed
  ) {
    return false;
  }

  if (filters.showOnlyVerified && company.verification_status !== "verified") {
    return false;
  }

  if (!filters.includeNeedsReview && company.verification_status === "needs_review") {
    return false;
  }

  const size = company.msp_company_size;

  if (
    !doesEmployeeCountMatch(
      size?.employee_count_exact ?? null,
      size?.employee_count_min ?? null,
      size?.employee_count_max ?? null,
      filters,
    )
  ) {
    return false;
  }

  return true;
}

export async function listCompanyRows(
  filters: NormalizedSearchFilters,
): Promise<CompanyRow[]> {
  const rows = await listCompaniesWithRelations(500);

  return rows
    .filter((company) => companyMatchesFilters(company, filters))
    .map((company) => {
      const size = company.msp_company_size;
      return {
        id: company.id,
        companyName: company.company_name,
        website: company.website,
        evidence: company.evidence_summary,
        geography: formatGeography(company.headquarters_city, company.headquarters_state),
        employeeCount: formatEmployeeCount(
          size?.employee_count_exact ?? null,
          size?.employee_count_min ?? null,
          size?.employee_count_max ?? null,
        ),
        companySizeTier: (size?.company_size_tier ?? null) as CompanySizeTier | null,
        score: toNumberOrNull(company.user_score),
        notes: company.user_notes ?? null,
        verificationStatus: company.verification_status,
        createdAt: company.created_at,
        latestRunId: company.latest_research_run_id ?? null,
      };
    });
}

export async function getCompanyDetail(companyId: string): Promise<CompanyDetail | null> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("msp_companies")
    .select(
      `
      id,
      company_name,
      website,
      evidence_summary,
      headquarters_city,
      headquarters_state,
      user_score,
      user_notes,
      verification_status,
      verification_reason,
      internal_confidence_score,
      msp_company_size(employee_count_exact, employee_count_min, employee_count_max, company_size_tier),
      msp_capabilities(
        aws_support,
        azure_support,
        aws_partner_claimed,
        azure_partner_claimed,
        aws_reseller_confirmed,
        azure_reseller_confirmed
      ),
      msp_sources(
        source_url,
        source_title,
        source_type,
        extracted_claim,
        supports_msp,
        supports_aws,
        supports_azure,
        supports_employee_count,
        supports_headquarters
      )
    `,
    )
    .eq("id", companyId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    return null;
  }

  const company = data as unknown as CompanyWithRelations;
  const size = company.msp_company_size;
  const capabilities = company.msp_capabilities;

  return {
    id: company.id,
    companyName: company.company_name,
    website: company.website,
    evidenceSummary: company.evidence_summary,
    geography: formatGeography(company.headquarters_city, company.headquarters_state),
    headquartersCity: company.headquarters_city,
    headquartersState: company.headquarters_state,
    employeeCount: formatEmployeeCount(
      size?.employee_count_exact ?? null,
      size?.employee_count_min ?? null,
      size?.employee_count_max ?? null,
    ),
    companySizeTier: (size?.company_size_tier ?? null) as CompanySizeTier | null,
    score: toNumberOrNull(company.user_score),
    notes: company.user_notes ?? null,
    verificationStatus: company.verification_status,
    verificationReason: company.verification_reason,
    internalConfidence: company.internal_confidence_score,
    capabilities: {
      awsSupport: capabilities?.aws_support ?? false,
      azureSupport: capabilities?.azure_support ?? false,
      awsPartnerClaimed: capabilities?.aws_partner_claimed ?? false,
      azurePartnerClaimed: capabilities?.azure_partner_claimed ?? false,
      awsResellerConfirmed: capabilities?.aws_reseller_confirmed ?? false,
      azureResellerConfirmed: capabilities?.azure_reseller_confirmed ?? false,
    },
    extractedData: {
      employeeCountExact: size?.employee_count_exact ?? null,
      employeeCountMin: size?.employee_count_min ?? null,
      employeeCountMax: size?.employee_count_max ?? null,
    },
    sources: mapSources(company.msp_sources),
  };
}

export async function saveCompanyReview(params: {
  companyId: string;
  userId: string | null;
  decision: "approved" | "rejected" | "needs_review";
  notes: string | null;
}): Promise<void> {
  const supabase = createAdminClient();

  const mappedVerificationStatus =
    params.decision === "approved"
      ? "verified"
      : params.decision === "rejected"
        ? "rejected"
        : "needs_review";

  const { error: updateError } = await supabase
    .from("msp_companies")
    .update({
      verification_status: mappedVerificationStatus,
      verification_reason: params.notes,
      last_verified_at: new Date().toISOString(),
    })
    .eq("id", params.companyId);

  if (updateError) {
    throw new Error(updateError.message);
  }

  const { error: reviewError } = await supabase.from("company_reviews").insert({
    company_id: params.companyId,
    reviewer_user_id: params.userId,
    decision: params.decision,
    notes: params.notes,
  });

  if (reviewError) {
    throw new Error(reviewError.message);
  }
}

export type ScoredExample = {
  companyName: string;
  website: string | null;
  headquartersCity: string | null;
  headquartersState: string | null;
  evidenceSummary: string;
  userScore: number;
  awsSupport: boolean;
  azureSupport: boolean;
};

export async function getHighScoredExamples(params: {
  states: string[];
  minScore?: number;
  limit?: number;
}): Promise<ScoredExample[]> {
  const supabase = createAdminClient();
  const minScore = params.minScore ?? 7;
  const limit = params.limit ?? 5;

  let query = supabase
    .from("msp_companies")
    .select(`
      company_name,
      website,
      headquarters_city,
      headquarters_state,
      evidence_summary,
      user_score,
      msp_capabilities (
        aws_support,
        azure_support
      )
    `)
    .gte("user_score", minScore)
    .order("user_score", { ascending: false })
    .limit(limit);

  // Prefer examples from the same states being searched
  if (params.states.length > 0) {
    query = query.in("headquarters_state", params.states);
  }

  const { data } = await query;
  if (!data || data.length === 0) {
    // Fall back to examples from any state if none found for these states
    if (params.states.length > 0) {
      return getHighScoredExamples({ states: [], minScore, limit });
    }
    return [];
  }

  return data.map((row) => {
    const cap = Array.isArray(row.msp_capabilities)
      ? row.msp_capabilities[0]
      : row.msp_capabilities;
    return {
      companyName: row.company_name,
      website: row.website ?? null,
      headquartersCity: row.headquarters_city ?? null,
      headquartersState: row.headquarters_state ?? null,
      evidenceSummary: row.evidence_summary ?? "",
      userScore: toNumberOrNull(row.user_score) ?? minScore,
      awsSupport: Boolean(cap?.aws_support),
      azureSupport: Boolean(cap?.azure_support),
    };
  });
}

export async function saveCompanyScore(params: {
  companyId: string;
  userId: string | null;
  score: number | null;
  note: string | null;
}): Promise<void> {
  const supabase = createAdminClient();

  if (params.score !== null) {
    const { error: scoreError } = await supabase.from("company_scores").insert({
      company_id: params.companyId,
      reviewer_user_id: params.userId,
      score: params.score,
      note: params.note,
    });

    if (scoreError) {
      throw new Error(scoreError.message);
    }
  }

  const { error: updateError } = await supabase
    .from("msp_companies")
    .update({ user_score: params.score })
    .eq("id", params.companyId);

  if (updateError) {
    throw new Error(updateError.message);
  }
}

export async function saveCompanyNotes(params: {
  companyId: string;
  notes: string | null;
}): Promise<void> {
  const supabase = createAdminClient();

  const { error } = await supabase
    .from("msp_companies")
    .update({ user_notes: params.notes })
    .eq("id", params.companyId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function createExportJob(params: {
  userId: string | null;
  filters: NormalizedSearchFilters;
}): Promise<string> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("export_jobs")
    .insert({
      requested_by: params.userId,
      filters_json: params.filters,
      status: "started",
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Unable to create export job.");
  }

  return data.id;
}

export async function completeExportJob(params: {
  exportJobId: string;
  rowCount: number;
  fileName: string;
}): Promise<void> {
  const supabase = createAdminClient();

  const { error } = await supabase
    .from("export_jobs")
    .update({
      status: "completed",
      row_count: params.rowCount,
      file_name: params.fileName,
      completed_at: new Date().toISOString(),
    })
    .eq("id", params.exportJobId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function failExportJob(params: {
  exportJobId: string;
  errorMessage: string;
}): Promise<void> {
  const supabase = createAdminClient();

  await supabase
    .from("export_jobs")
    .update({
      status: "failed",
      error_message: params.errorMessage,
      completed_at: new Date().toISOString(),
    })
    .eq("id", params.exportJobId);
}
