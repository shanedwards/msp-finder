import { MAX_CANDIDATES, MAX_SEARCH_QUERIES, MAX_SOURCES_FETCHED } from "@/lib/msp/constants";
import { calculateInternalConfidence } from "@/lib/msp/confidence";
import { composeEvidenceSummaryForEvaluated } from "@/lib/msp/evidence";
import { getWebsiteDomain, normalizeCompanyName } from "@/lib/msp/formatting";
import { buildMockCandidates } from "@/lib/msp/mock-data";
import { getHighScoredExamples, getKnownWebsiteDomains, getLowScoredExamples, upsertEvaluatedCandidate } from "@/lib/msp/repository";
import {
  extractedCandidatesResponseSchema,
  ExtractedCandidateFromSchema,
  normalizeSearchFilters,
} from "@/lib/msp/schemas";
import { CompanySizeTier, ExtractedCandidate, SearchPipelineState } from "@/lib/msp/types";
import { normalizeStateCode } from "@/lib/msp/us-states";
import { evaluateVerification } from "@/lib/msp/verification";
import { buildSearchQueries, buildSeedCompanyPrompt, buildWebResearchPrompt } from "@/lib/msp/workflow/prompts";
import { requireOpenAiApiKey } from "@/lib/env";
import OpenAI from "openai";

let openAiClient: OpenAI | null = null;

function getOpenAiClient() {
  if (!openAiClient) {
    openAiClient = new OpenAI({
      apiKey: requireOpenAiApiKey(),
    });
  }

  return openAiClient;
}

type OpenAiContentEntry = {
  text?: string;
  output_text?: string;
};

type OpenAiOutputEntry = {
  content?: OpenAiContentEntry[];
};

type OpenAiResponseShape = {
  output_text?: string;
  output?: OpenAiOutputEntry[];
};

type UnknownRecord = Record<string, unknown>;

function extractTextFromResponse(response: unknown): string {
  const payload = response as OpenAiResponseShape;

  if (typeof payload.output_text === "string" && payload.output_text.trim()) {
    return payload.output_text;
  }

  if (Array.isArray(payload.output)) {
    const textParts = payload.output
      .flatMap((entry) => entry?.content ?? [])
      .map((item) => item?.text ?? item?.output_text ?? "")
      .filter((value: string) => typeof value === "string" && value.trim().length > 0);

    if (textParts.length > 0) {
      return textParts.join("\n");
    }
  }

  return "";
}

function collectJsonCandidates(text: string): string[] {
  const candidates: string[] = [];
  const seen = new Set<string>();

  const addCandidate = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed || seen.has(trimmed)) {
      return;
    }

    seen.add(trimmed);
    candidates.push(trimmed);
  };

  addCandidate(text);

  const fencedRegex = /```(?:json)?\s*([\s\S]*?)```/gi;
  for (const match of text.matchAll(fencedRegex)) {
    if (match[1]) {
      addCandidate(match[1]);
    }
  }

  let inString = false;
  let isEscaped = false;
  const stack: string[] = [];
  let start = -1;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];

    if (inString) {
      if (isEscaped) {
        isEscaped = false;
      } else if (char === "\\") {
        isEscaped = true;
      } else if (char === "\"") {
        inString = false;
      }
      continue;
    }

    if (char === "\"") {
      inString = true;
      continue;
    }

    if (stack.length === 0) {
      if (char === "{") {
        start = i;
        stack.push("}");
      } else if (char === "[") {
        start = i;
        stack.push("]");
      }
      continue;
    }

    if (char === "{") {
      stack.push("}");
      continue;
    }

    if (char === "[") {
      stack.push("]");
      continue;
    }

    const expected = stack[stack.length - 1];
    if (char === expected) {
      stack.pop();
      if (stack.length === 0 && start !== -1) {
        addCandidate(text.slice(start, i + 1));
        start = -1;
      }
      continue;
    }

    if (char === "}" || char === "]") {
      stack.length = 0;
      start = -1;
    }
  }

  return candidates;
}

function asRecord(value: unknown): UnknownRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as UnknownRecord;
}

function pickField(record: UnknownRecord, keys: string[]): unknown {
  for (const key of keys) {
    if (key in record) {
      return record[key];
    }
  }

  return undefined;
}

function normalizeSourceShape(rawSource: unknown): UnknownRecord | null {
  const source = asRecord(rawSource);
  if (!source) {
    return null;
  }

  return {
    url: pickField(source, ["url", "source_url", "sourceUrl", "link"]),
    title: pickField(source, ["title", "source_title", "sourceTitle", "name"]) ?? null,
    sourceType:
      pickField(source, ["sourceType", "source_type", "type"]) ?? "other",
    claim:
      pickField(source, ["claim", "extracted_claim", "extractedClaim", "evidence"]) ?? "",
    supportsMsp:
      pickField(source, ["supportsMsp", "supports_msp", "is_msp_evidence"]) ?? false,
    supportsAws: pickField(source, ["supportsAws", "supports_aws"]) ?? false,
    supportsAzure: pickField(source, ["supportsAzure", "supports_azure"]) ?? false,
    supportsEmployeeCount:
      pickField(source, ["supportsEmployeeCount", "supports_employee_count"]) ?? false,
    supportsHeadquarters:
      pickField(source, ["supportsHeadquarters", "supports_headquarters"]) ?? false,
  };
}

function normalizeCandidateShape(rawCandidate: unknown): UnknownRecord | null {
  const candidate = asRecord(rawCandidate);
  if (!candidate) {
    return null;
  }

  const rawSources = pickField(candidate, [
    "sources",
    "source_list",
    "evidence",
    "citations",
  ]);

  const normalizedSources = Array.isArray(rawSources)
    ? rawSources
        .map((source) => normalizeSourceShape(source))
        .filter((source): source is UnknownRecord => Boolean(source))
    : [];

  return {
    companyName:
      pickField(candidate, ["companyName", "company_name", "name", "company"]) ?? "",
    website: pickField(candidate, ["website", "website_url", "site"]) ?? null,
    headquartersCity:
      pickField(candidate, ["headquartersCity", "headquarters_city", "city"]) ?? null,
    headquartersState:
      pickField(candidate, ["headquartersState", "headquarters_state", "state"]) ?? null,
    employeeCountExact:
      pickField(candidate, ["employeeCountExact", "employee_count_exact"]) ?? null,
    employeeCountMin:
      pickField(candidate, ["employeeCountMin", "employee_count_min"]) ?? null,
    employeeCountMax:
      pickField(candidate, ["employeeCountMax", "employee_count_max"]) ?? null,
    awsSupport: pickField(candidate, ["awsSupport", "aws_support", "supports_aws"]) ?? false,
    azureSupport:
      pickField(candidate, ["azureSupport", "azure_support", "supports_azure"]) ?? false,
    awsPartnerClaimed:
      pickField(candidate, ["awsPartnerClaimed", "aws_partner_claimed"]) ?? false,
    azurePartnerClaimed:
      pickField(candidate, ["azurePartnerClaimed", "azure_partner_claimed"]) ?? false,
    awsResellerConfirmed:
      pickField(candidate, ["awsResellerConfirmed", "aws_reseller_confirmed"]) ?? false,
    azureResellerConfirmed:
      pickField(candidate, ["azureResellerConfirmed", "azure_reseller_confirmed"]) ?? false,
    isMsp: pickField(candidate, ["isMsp", "is_msp"]) ?? false,
    disqualifierType:
      pickField(candidate, ["disqualifierType", "disqualifier_type"]) ?? null,
    sources: normalizedSources,
  };
}

function normalizeParsedPayloadShape(parsed: unknown): unknown {
  if (Array.isArray(parsed)) {
    return {
      companies: parsed
        .map((candidate) => normalizeCandidateShape(candidate))
        .filter((candidate): candidate is UnknownRecord => Boolean(candidate)),
    };
  }

  const record = asRecord(parsed);
  if (!record) {
    return parsed;
  }

  const rawCompanies = pickField(record, ["companies", "candidates", "results", "items"]);
  if (Array.isArray(rawCompanies)) {
    return {
      companies: rawCompanies
        .map((candidate) => normalizeCandidateShape(candidate))
        .filter((candidate): candidate is UnknownRecord => Boolean(candidate)),
    };
  }

  const maybeSingleCandidate = normalizeCandidateShape(record);
  if (maybeSingleCandidate) {
    return { companies: [maybeSingleCandidate] };
  }

  return parsed;
}

function parseResearchPayload(payload: string): ExtractedCandidateFromSchema[] {
  const candidates = collectJsonCandidates(payload);

  for (const candidateText of candidates) {
    try {
      const parsed = JSON.parse(candidateText) as unknown;
      const normalizedPayload = normalizeParsedPayloadShape(parsed);
      const validated = extractedCandidatesResponseSchema.safeParse(normalizedPayload);
      if (validated.success) {
        return validated.data.companies;
      }
    } catch {
      // Keep trying other candidate JSON blocks.
    }
  }

  throw new Error("Model response could not be parsed into expected JSON schema.");
}

function sanitizeWebsite(website: string | null): string | null {
  if (!website) {
    return null;
  }

  try {
    const parsed = new URL(website);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

type UrlCheckResult = "reachable" | "dead" | "blocked";

async function isUrlReachable(url: string): Promise<boolean> {
  const attempt = async (method: "HEAD" | "GET"): Promise<UrlCheckResult> => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    try {
      const response = await fetch(url, {
        method,
        signal: controller.signal,
        redirect: "follow",
        headers: { "User-Agent": "Mozilla/5.0 (compatible; MSP-Finder-Bot/1.0)" },
      });
      clearTimeout(timeout);
      // Definitive "page does not exist" responses
      if (response.status === 404 || response.status === 410 || response.status === 451) {
        return "dead";
      }
      // Bot-blocking (403, 429) or server errors (5xx) — URL likely valid, just blocking us
      if (response.status >= 400) {
        return "blocked";
      }
      return "reachable";
    } catch {
      clearTimeout(timeout);
      // Timeout or network error — give the URL the benefit of the doubt
      return "blocked";
    }
  };

  const headResult = await attempt("HEAD");
  if (headResult === "reachable") return true;
  if (headResult === "dead") return false;

  // HEAD was blocked — try GET before giving up
  const getResult = await attempt("GET");
  if (getResult === "dead") return false;

  // Reachable or still blocked — keep the URL either way
  return true;
}

async function lookupWebsiteForCandidate(
  companyName: string,
  city: string | null,
  state: string | null,
): Promise<string | null> {
  const location = [city, state].filter(Boolean).join(", ");
  const prompt = `Search for the official company website URL for "${companyName}"${location ? ` located in ${location}` : ""}. Return ONLY the URL (e.g. https://www.example.com). Do not return LinkedIn, Yelp, BBB, Clutch, or any directory page — only the company's own domain. If you cannot find an official website, return the single word: null`;

  try {
    const client = getOpenAiClient();
    const response = await client.responses.create({
      model: "gpt-4.1",
      tools: [{ type: "web_search_preview" as const }],
      input: prompt,
      max_output_tokens: 100,
      temperature: 0,
    });

    const text = extractTextFromResponse(response).trim();
    if (!text || text.toLowerCase() === "null") {
      return null;
    }

    // Extract a URL if the model returned extra text around it
    const urlMatch = text.match(/https?:\/\/[^\s"']+/);
    return urlMatch ? urlMatch[0].replace(/[.,)]+$/, "") : null;
  } catch {
    return null;
  }
}

async function runWebResearchCall(state: SearchPipelineState): Promise<{ text: string; knownDomains: string[] }> {
  const [scoredExamples, lowScoredExamples, knownDomains] = await Promise.all([
    getHighScoredExamples({ states: state.filters.states }).catch(() => []),
    getLowScoredExamples({ states: state.filters.states }).catch(() => []),
    getKnownWebsiteDomains(state.filters.states).catch(() => []),
  ]);

  if (scoredExamples.length > 0) {
    console.log(
      `[web_research] injecting ${scoredExamples.length} high-scored example(s) into prompt:`,
      scoredExamples.map((e) => `${e.companyName} (score ${e.userScore})`).join(", "),
    );
  }

  if (lowScoredExamples.length > 0) {
    console.log(
      `[web_research] injecting ${lowScoredExamples.length} low-scored example(s) into prompt:`,
      lowScoredExamples.map((e) => `${e.companyName} (score ${e.userScore})`).join(", "),
    );
  }

  if (knownDomains.length > 0) {
    console.log(`[web_research] ${knownDomains.length} known domain(s) will be excluded from results`);
  }

  const prompt = buildWebResearchPrompt({
    filters: state.filters,
    queries: state.searchQueries,
    scoredExamples,
    lowScoredExamples,
    knownDomains,
  });

  const client = getOpenAiClient();
  const response = await client.responses.create({
    model: "gpt-4.1",
    tools: [{ type: "web_search_preview" as const, search_context_size: "low" as const }],
    input: prompt,
    max_output_tokens: 16000,
    temperature: 0,
  });

  const text = extractTextFromResponse(response);
  if (!text) {
    throw new Error("OpenAI web research returned an empty response.");
  }

  return { text, knownDomains };
}

function inferSizeTierFromCount(
  exact: number | null,
  min: number | null,
  max: number | null,
): CompanySizeTier | null {
  const headcount = exact ?? min ?? max;
  if (headcount === null) return null;
  if (headcount <= 10) return "micro";
  if (headcount <= 75) return "small";
  if (headcount <= 300) return "mid";
  return "large";
}

function normalizeCandidate(candidate: ExtractedCandidateFromSchema): ExtractedCandidate {
  const normalizedName = normalizeCompanyName(candidate.companyName);
  const website = sanitizeWebsite(candidate.website);
  const normalizedState = candidate.headquartersState
    ? normalizeStateCode(String(candidate.headquartersState))
    : null;

  const sources = (candidate.sources ?? [])
    .slice(0, 8)
    .map((source) => ({
      url: source.url,
      title: source.title ?? null,
      sourceType: source.sourceType,
      claim: normalizeCompanyName(String(source.claim ?? "")),
      supportsMsp: Boolean(source.supportsMsp),
      supportsAws: Boolean(source.supportsAws),
      supportsAzure: Boolean(source.supportsAzure),
      supportsEmployeeCount: Boolean(source.supportsEmployeeCount),
      supportsHeadquarters: Boolean(source.supportsHeadquarters),
    }))
    .filter((source) => source.url && source.claim);

  const hasEmployeeEvidence = sources.some((source) => source.supportsEmployeeCount);

  const employeeCountExact = hasEmployeeEvidence ? candidate.employeeCountExact ?? null : null;
  let employeeCountMin = hasEmployeeEvidence ? candidate.employeeCountMin ?? null : null;
  let employeeCountMax = hasEmployeeEvidence ? candidate.employeeCountMax ?? null : null;

  if (employeeCountMin !== null && employeeCountMax !== null && employeeCountMax < employeeCountMin) {
    employeeCountMax = employeeCountMin;
  }

  if (employeeCountExact !== null) {
    employeeCountMin = null;
    employeeCountMax = null;
  }

  const awsPartnerClaimed = Boolean(candidate.awsPartnerClaimed);
  const awsResellerConfirmed = Boolean(candidate.awsResellerConfirmed);
  const azurePartnerClaimed = Boolean(candidate.azurePartnerClaimed);
  const azureResellerConfirmed = Boolean(candidate.azureResellerConfirmed);

  // Infer top-level support flags from all available evidence: the model's
  // explicit boolean, partner/reseller flags, and any source that mentions it.
  // The model often sets partner flags correctly but forgets the top-level bool.
  const awsSupport =
    Boolean(candidate.awsSupport) ||
    awsPartnerClaimed ||
    awsResellerConfirmed ||
    sources.some((s) => s.supportsAws);

  const azureSupport =
    Boolean(candidate.azureSupport) ||
    azurePartnerClaimed ||
    azureResellerConfirmed ||
    sources.some((s) => s.supportsAzure);

  const companySizeTier: CompanySizeTier | null =
    candidate.companySizeTier ??
    inferSizeTierFromCount(employeeCountExact, employeeCountMin, employeeCountMax);

  return {
    companyName: normalizedName,
    website,
    headquartersCity: candidate.headquartersCity
      ? normalizeCompanyName(String(candidate.headquartersCity))
      : null,
    headquartersState: normalizedState,
    employeeCountExact,
    employeeCountMin,
    employeeCountMax,
    companySizeTier,
    awsSupport,
    azureSupport,
    awsPartnerClaimed,
    azurePartnerClaimed,
    awsResellerConfirmed,
    azureResellerConfirmed,
    isMsp: Boolean(candidate.isMsp),
    disqualifierType: candidate.disqualifierType
      ? String(candidate.disqualifierType).toLowerCase()
      : null,
    sources,
  };
}

function mergeCandidates(a: ExtractedCandidate, b: ExtractedCandidate): ExtractedCandidate {
  const mergedSources = [...a.sources, ...b.sources];
  const uniqueSourceMap = new Map<string, (typeof mergedSources)[number]>();
  for (const source of mergedSources) {
    uniqueSourceMap.set(`${source.url}|${source.claim}`, source);
  }

  return {
    ...a,
    website: a.website ?? b.website,
    headquartersCity: a.headquartersCity ?? b.headquartersCity,
    headquartersState: a.headquartersState ?? b.headquartersState,
    employeeCountExact: a.employeeCountExact ?? b.employeeCountExact,
    employeeCountMin: a.employeeCountMin ?? b.employeeCountMin,
    employeeCountMax: a.employeeCountMax ?? b.employeeCountMax,
    companySizeTier: a.companySizeTier ?? b.companySizeTier,
    awsSupport: a.awsSupport || b.awsSupport,
    azureSupport: a.azureSupport || b.azureSupport,
    awsPartnerClaimed: a.awsPartnerClaimed || b.awsPartnerClaimed,
    azurePartnerClaimed: a.azurePartnerClaimed || b.azurePartnerClaimed,
    awsResellerConfirmed: a.awsResellerConfirmed || b.awsResellerConfirmed,
    azureResellerConfirmed: a.azureResellerConfirmed || b.azureResellerConfirmed,
    isMsp: a.isMsp || b.isMsp,
    disqualifierType: a.disqualifierType ?? b.disqualifierType,
    sources: [...uniqueSourceMap.values()].slice(0, MAX_SOURCES_FETCHED),
  };
}

export async function intakeNode(
  state: SearchPipelineState,
): Promise<Partial<SearchPipelineState>> {
  return {
    filters: normalizeSearchFilters(state.filters),
  };
}

export async function searchPlanNode(
  state: SearchPipelineState,
): Promise<Partial<SearchPipelineState>> {
  return {
    searchQueries: buildSearchQueries(state.filters).slice(0, MAX_SEARCH_QUERIES),
  };
}

export async function webResearchNode(
  state: SearchPipelineState,
): Promise<Partial<SearchPipelineState>> {
  if (state.mockMode) {
    return {
      researchPayloads: [
        JSON.stringify({
          companies: buildMockCandidates(state.filters),
        }),
      ],
    };
  }

  const { text, knownDomains } = await runWebResearchCall(state);
  console.log("[web_research] raw model response (first 2000 chars):", text.slice(0, 2000));
  return {
    researchPayloads: [text],
    knownDomains,
  };
}

export async function seedResearchNode(
  state: SearchPipelineState,
): Promise<Partial<SearchPipelineState>> {
  const seeds = state.filters.seedCompanies ?? [];

  if (seeds.length === 0) {
    return {};
  }

  if (state.mockMode) {
    console.log(`[seed_research] skipping ${seeds.length} seed(s) in mock mode`);
    return {};
  }

  console.log(`[seed_research] researching ${seeds.length} seeded compan${seeds.length === 1 ? "y" : "ies"}:`, seeds.join(", "));

  const prompt = buildSeedCompanyPrompt({
    companies: seeds,
    filters: state.filters,
  });

  const client = getOpenAiClient();
  const response = await client.responses.create({
    model: "gpt-4.1",
    tools: [{ type: "web_search_preview" as const, search_context_size: "medium" as const }],
    input: prompt,
    max_output_tokens: 8000,
    temperature: 0,
  });

  const text = extractTextFromResponse(response);
  if (!text) {
    console.warn("[seed_research] empty response from OpenAI — skipping seed enrichment");
    return {};
  }

  console.log("[seed_research] raw model response (first 1000 chars):", text.slice(0, 1000));

  // Append the seed payload alongside the main research payload so candidateExtractionNode
  // processes both in one pass.
  return {
    researchPayloads: [...state.researchPayloads, text],
  };
}

export async function candidateExtractionNode(
  state: SearchPipelineState,
): Promise<Partial<SearchPipelineState>> {
  const extracted: ExtractedCandidateFromSchema[] = [];

  for (const payload of state.researchPayloads) {
    extracted.push(...parseResearchPayload(payload));
  }

  const normalized = extracted
    .slice(0, MAX_CANDIDATES)
    .map((candidate) => normalizeCandidate(candidate));

  // Validate all websites and look up any that are missing or broken.
  // Runs in parallel to keep latency low.
  const enriched = await Promise.all(
    normalized.map(async (candidate) => {
      const resolveUrl = async (urlToTry: string | null): Promise<string | null> => {
        if (!urlToTry) return null;
        const ok = await isUrlReachable(urlToTry);
        return ok ? urlToTry : null;
      };

      // If no website, look it up then validate
      if (!candidate.website) {
        const found = await lookupWebsiteForCandidate(
          candidate.companyName,
          candidate.headquartersCity,
          candidate.headquartersState,
        );
        const validated = await resolveUrl(found);
        if (validated) console.log(`[enrichment] found website for "${candidate.companyName}": ${validated}`);
        return { ...candidate, website: validated };
      }

      // Validate the AI-provided URL
      const aiUrlOk = await isUrlReachable(candidate.website);
      if (aiUrlOk) return candidate;

      // Broken — try a fresh lookup and validate that too
      console.log(`[enrichment] broken URL for "${candidate.companyName}" (${candidate.website}), looking up replacement`);
      const replacement = await lookupWebsiteForCandidate(
        candidate.companyName,
        candidate.headquartersCity,
        candidate.headquartersState,
      );
      const validatedReplacement = await resolveUrl(replacement);
      if (validatedReplacement) {
        console.log(`[enrichment] replacement found for "${candidate.companyName}": ${validatedReplacement}`);
      } else {
        console.log(`[enrichment] no valid replacement for "${candidate.companyName}", clearing URL`);
      }
      return { ...candidate, website: validatedReplacement };
    }),
  );

  return { extractedCandidates: enriched };
}

export async function entityResolutionNode(
  state: SearchPipelineState,
): Promise<Partial<SearchPipelineState>> {
  const knownDomainSet = new Set(state.knownDomains);
  const deduped = new Map<string, ExtractedCandidate>();

  for (const candidate of state.extractedCandidates) {
    const domain = getWebsiteDomain(candidate.website);

    // Hard-skip candidates whose domain is already in the database
    if (domain && knownDomainSet.has(domain)) {
      console.log(`[entity_resolution] skipping known domain "${domain}" (${candidate.companyName})`);
      continue;
    }

    const key = domain ?? normalizeCompanyName(candidate.companyName).toLowerCase();

    const existing = deduped.get(key);
    if (!existing) {
      deduped.set(key, candidate);
      continue;
    }

    deduped.set(key, mergeCandidates(existing, candidate));
  }

  return {
    dedupedCandidates: [...deduped.values()].slice(0, MAX_CANDIDATES),
  };
}

export async function verificationNode(
  state: SearchPipelineState,
): Promise<Partial<SearchPipelineState>> {
  console.log(`[verification] evaluating ${state.dedupedCandidates.length} candidates | filters.states=${JSON.stringify(state.filters.states)}`);
  const evaluatedCandidates = state.dedupedCandidates.map((candidate) => {
    const verification = evaluateVerification(candidate, state.filters);
    console.log(`[verification] "${candidate.companyName}" | state="${candidate.headquartersState}" | isMsp=${candidate.isMsp} | awsSupport=${candidate.awsSupport} | website="${candidate.website}" → ${verification.status}: ${verification.reason}`);
    const normalizedName = normalizeCompanyName(candidate.companyName);

    return {
      ...candidate,
      normalizedName,
      websiteDomain: getWebsiteDomain(candidate.website),
      verificationStatus: verification.status,
      verificationReason: verification.reason,
      internalConfidenceScore: 0,
      evidenceSummary: "",
    };
  });

  return {
    evaluatedCandidates,
  };
}

export async function confidenceScoringNode(
  state: SearchPipelineState,
): Promise<Partial<SearchPipelineState>> {
  const evaluatedCandidates = state.evaluatedCandidates.map((candidate) => {
    const internalConfidenceScore = calculateInternalConfidence(
      candidate,
      candidate.verificationStatus,
    );

    const evidenceSummary = composeEvidenceSummaryForEvaluated(candidate);

    return {
      ...candidate,
      internalConfidenceScore,
      evidenceSummary,
    };
  });

  return {
    evaluatedCandidates,
  };
}

export async function persistenceNode(
  state: SearchPipelineState,
): Promise<Partial<SearchPipelineState>> {
  const statusPriority: Record<string, number> = {
    verified: 2,
    needs_review: 1,
  };

  const qualifiedCandidates = state.evaluatedCandidates.filter(
    (candidate) => candidate.verificationStatus !== "rejected",
  );

  const sorted = [...qualifiedCandidates].sort((a, b) => {
    const statusDiff = statusPriority[b.verificationStatus] - statusPriority[a.verificationStatus];
    if (statusDiff !== 0) {
      return statusDiff;
    }

    return b.internalConfidenceScore - a.internalConfidenceScore;
  });

  const selected = sorted.slice(0, state.filters.resultLimit);

  const persistedCompanyIds: string[] = [];
  for (const candidate of selected) {
    const companyId = await upsertEvaluatedCandidate({
      runId: state.runId,
      userId: state.userId,
      candidate,
    });
    persistedCompanyIds.push(companyId);
  }

  return {
    evaluatedCandidates: state.evaluatedCandidates,
    persistedCompanyIds,
  };
}

export async function exportReadyNode(
  state: SearchPipelineState,
): Promise<Partial<SearchPipelineState>> {
  return {
    // Final node is intentionally light so this sync graph can be moved to run+poll later.
    persistedCompanyIds: state.persistedCompanyIds,
  };
}
