import { isLikelyRealWebsite, normalizeCompanyName } from "@/lib/msp/formatting";
import {
  ExtractedCandidate,
  NormalizedSearchFilters,
  VerificationResult,
} from "@/lib/msp/types";
import { normalizeStateCode } from "@/lib/msp/us-states";

const DISQUALIFYING_TYPES = new Set([
  "recruiter",
  "staffing",
  "directory",
  "software_vendor",
]);

function hasEmployeeEvidence(candidate: ExtractedCandidate): boolean {
  return candidate.sources.some((source) => source.supportsEmployeeCount);
}

function hasMspEvidence(candidate: ExtractedCandidate): boolean {
  return candidate.sources.some((source) => source.supportsMsp);
}

function hasOfficialWebsiteEvidence(candidate: ExtractedCandidate): boolean {
  return candidate.sources.some(
    (source) => source.supportsMsp && source.sourceType === "official_website",
  );
}

function hasHeadquartersEvidence(candidate: ExtractedCandidate): boolean {
  return candidate.sources.some((source) => source.supportsHeadquarters);
}

function employeeEvidenceFitsFilters(
  candidate: ExtractedCandidate,
  filters: NormalizedSearchFilters,
): boolean {
  const hasMinFilter = filters.minimumEmployees !== null;
  const hasMaxFilter = filters.maximumEmployees !== null;

  if (!hasMinFilter && !hasMaxFilter) {
    return true;
  }

  const { employeeCountExact, employeeCountMin, employeeCountMax } = candidate;

  // No employee evidence found at all — don't hard-reject. The company will
  // be flagged as needs_review via the hasEmployeeEvidence check downstream.
  if (employeeCountExact === null && employeeCountMin === null && employeeCountMax === null) {
    return true;
  }

  // Evidence exists — only reject if it clearly contradicts the filter range.
  if (hasMinFilter) {
    const min = filters.minimumEmployees!;
    if (employeeCountExact !== null && employeeCountExact < min) {
      return false;
    }

    if (employeeCountExact === null && employeeCountMin !== null && employeeCountMin < min) {
      return false;
    }
  }

  if (hasMaxFilter) {
    const max = filters.maximumEmployees!;
    if (employeeCountExact !== null && employeeCountExact > max) {
      return false;
    }

    if (employeeCountExact === null && employeeCountMax !== null && employeeCountMax > max) {
      return false;
    }
  }

  return true;
}

function locationFitsFilters(
  candidate: ExtractedCandidate,
  filters: NormalizedSearchFilters,
): boolean {
  const normalizedState = candidate.headquartersState
    ? normalizeStateCode(candidate.headquartersState)
    : null;

  if (filters.states.length > 0) {
    if (!normalizedState) {
      return false;
    }

    if (!filters.states.includes(normalizedState)) {
      return false;
    }
  }

  if (filters.city) {
    const city = normalizeCompanyName(candidate.headquartersCity ?? "").toLowerCase();
    const filterCity = normalizeCompanyName(filters.city).toLowerCase();
    if (!city || city !== filterCity) {
      return false;
    }
  }

  return true;
}

export function evaluateVerification(
  candidate: ExtractedCandidate,
  filters: NormalizedSearchFilters,
): VerificationResult {
  if (!candidate.isMsp) {
    return {
      status: "rejected",
      reason: "Rejected: evidence does not confirm this company is a managed service provider.",
    };
  }

  if (candidate.disqualifierType && DISQUALIFYING_TYPES.has(candidate.disqualifierType)) {
    return {
      status: "rejected",
      reason: `Rejected: company classified as ${candidate.disqualifierType}.`,
    };
  }

  const hasMissingWebsite = !isLikelyRealWebsite(candidate.website);

  if (hasMissingWebsite) {
    return {
      status: "rejected",
      reason: "Rejected: no confirmed website URL could be found for this company.",
    };
  }

  if (!locationFitsFilters(candidate, filters)) {
    return {
      status: "rejected",
      reason: "Rejected: headquarters location does not match selected filters.",
    };
  }

  if (!employeeEvidenceFitsFilters(candidate, filters)) {
    return {
      status: "rejected",
      reason: "Rejected: employee count does not satisfy selected employee filters.",
    };
  }

  // Hard-reject only when confirmed partner/reseller evidence is explicitly required.
  // General cloud support flags (mustSupportAws/Azure) fall through to needs_review
  // because the model often can't confirm these even for valid companies.
  if (filters.mustHaveAwsResellerEvidence && !candidate.awsResellerConfirmed) {
    return {
      status: "rejected",
      reason: "Rejected: required AWS reseller evidence is missing.",
    };
  }

  if (
    filters.mustHaveAzurePartnerEvidence &&
    !candidate.azurePartnerClaimed &&
    !candidate.azureResellerConfirmed
  ) {
    return {
      status: "rejected",
      reason: "Rejected: required Azure/Microsoft partner evidence is missing.",
    };
  }

  const needsReviewReasons: string[] = [];

  if (filters.mustSupportAws && !candidate.awsSupport) {
    needsReviewReasons.push("AWS support could not be confirmed from available sources");
  }

  if (filters.mustSupportAzure && !candidate.azureSupport) {
    needsReviewReasons.push("Azure support could not be confirmed from available sources");
  }

  if (!hasMspEvidence(candidate)) {
    needsReviewReasons.push("MSP evidence is weak");
  }

  if (!hasOfficialWebsiteEvidence(candidate)) {
    needsReviewReasons.push("official website MSP proof is missing");
  }

  if (!hasHeadquartersEvidence(candidate)) {
    needsReviewReasons.push("headquarters evidence is limited");
  }

  if (!hasEmployeeEvidence(candidate)) {
    needsReviewReasons.push("employee count evidence is missing");
  }

  if (needsReviewReasons.length > 0) {
    return {
      status: "needs_review",
      reason: `Needs review: ${needsReviewReasons.join("; ")}.`,
    };
  }

  return {
    status: "verified",
    reason: "Verified: deterministic checks passed and evidence is sufficient.",
  };
}
