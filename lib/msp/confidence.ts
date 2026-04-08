import { ExtractedCandidate, VerificationStatus } from "@/lib/msp/types";

export function calculateInternalConfidence(
  candidate: ExtractedCandidate,
  verificationStatus: VerificationStatus,
): number {
  let score = 10;

  if (candidate.sources.some((source) => source.supportsMsp)) {
    score += 25;
  }

  if (
    candidate.sources.some(
      (source) => source.supportsMsp && source.sourceType === "official_website",
    )
  ) {
    score += 20;
  }

  if (candidate.awsSupport) {
    score += 8;
  }

  if (candidate.azureSupport) {
    score += 8;
  }

  if (candidate.awsResellerConfirmed) {
    score += 8;
  }

  if (candidate.azurePartnerClaimed || candidate.azureResellerConfirmed) {
    score += 8;
  }

  if (candidate.headquartersCity && candidate.headquartersState) {
    score += 6;
  }

  if (candidate.employeeCountExact !== null) {
    score += 7;
  } else if (candidate.employeeCountMin !== null && candidate.employeeCountMax !== null) {
    score += 4;
  }

  if (candidate.sources.length >= 3) {
    score += 5;
  }

  if (verificationStatus === "needs_review") {
    score -= 20;
  }

  if (verificationStatus === "rejected") {
    score = Math.min(score, 20);
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}
