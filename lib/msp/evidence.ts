import { CandidateSource, EvaluatedCandidate } from "@/lib/msp/types";
import { formatEmployeeCount, formatGeography } from "@/lib/msp/formatting";

function toShortSentence(value: string): string {
  const cleaned = value.trim().replace(/\s+/g, " ").replace(/[\n\r]+/g, " ");
  if (!cleaned) {
    return "";
  }

  const clipped = cleaned.length > 180 ? `${cleaned.slice(0, 177).trimEnd()}...` : cleaned;

  return /[.!?]$/.test(clipped) ? clipped : `${clipped}.`;
}

function pickBestSource(
  sources: CandidateSource[],
  predicate: (source: CandidateSource) => boolean,
): CandidateSource | null {
  const preferred = sources.find(
    (source) => source.sourceType === "official_website" && predicate(source),
  );

  if (preferred) {
    return preferred;
  }

  return sources.find(predicate) ?? null;
}

export function composeEvidenceSummary(candidate: {
  sources: CandidateSource[];
  headquartersCity: string | null;
  headquartersState: string | null;
  employeeCountExact: number | null;
  employeeCountMin: number | null;
  employeeCountMax: number | null;
}): string {
  const sentences: string[] = [];

  const serviceSource = pickBestSource(candidate.sources, (source) => source.supportsMsp);
  if (serviceSource) {
    sentences.push(toShortSentence(serviceSource.claim));
  }

  const cloudSource = pickBestSource(
    candidate.sources,
    (source) => source.supportsAws || source.supportsAzure,
  );
  if (cloudSource && cloudSource !== serviceSource) {
    sentences.push(toShortSentence(cloudSource.claim));
  }

  const sizeOrLocationSource = pickBestSource(
    candidate.sources,
    (source) => source.supportsEmployeeCount || source.supportsHeadquarters,
  );
  if (
    sizeOrLocationSource &&
    sizeOrLocationSource !== serviceSource &&
    sizeOrLocationSource !== cloudSource
  ) {
    sentences.push(toShortSentence(sizeOrLocationSource.claim));
  }

  if (sentences.length === 0) {
    const location = formatGeography(
      candidate.headquartersCity,
      candidate.headquartersState,
    );
    const employeeCount = formatEmployeeCount(
      candidate.employeeCountExact,
      candidate.employeeCountMin,
      candidate.employeeCountMax,
    );

    if (location || employeeCount !== "Unknown") {
      const fallback = [
        location ? `HQ listed as ${location}` : null,
        employeeCount !== "Unknown"
          ? `employee estimate supported at ${employeeCount}`
          : null,
      ]
        .filter(Boolean)
        .join("; ");

      if (fallback) {
        sentences.push(toShortSentence(fallback));
      }
    }
  }

  if (sentences.length === 0) {
    return "Evidence is limited and needs manual review.";
  }

  return sentences.slice(0, 3).join(" ");
}

export function composeEvidenceSummaryForEvaluated(
  candidate: EvaluatedCandidate,
): string {
  return composeEvidenceSummary(candidate);
}
