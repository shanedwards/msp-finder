import { MAX_CANDIDATES, MAX_SEARCH_QUERIES, MAX_SOURCES_FETCHED } from "@/lib/msp/constants";
import { ScoredExample } from "@/lib/msp/repository";
import { NormalizedSearchFilters } from "@/lib/msp/types";

export function buildSearchQueries(filters: NormalizedSearchFilters): string[] {
  const states = filters.states.length > 0 ? filters.states : ["United States"];
  // Use full state name for the first state to make searches more natural
  const primaryState = states[0];
  const cityPrefix = filters.city ? `${filters.city} ` : "";
  const locationPrefix = `${cityPrefix}${primaryState}`;

  const queries: string[] = [];

  // Core local MSP queries — always generated first
  queries.push(`${locationPrefix} managed service provider`);
  queries.push(`${locationPrefix} MSP IT services`);
  queries.push(`${locationPrefix} managed IT services company`);

  // Local cloud-focused queries
  if (filters.mustSupportAws || filters.mustHaveAwsResellerEvidence) {
    queries.push(`${locationPrefix} AWS managed services partner`);
    queries.push(`${locationPrefix} AWS partner IT managed services`);
  } else {
    queries.push(`${locationPrefix} cloud managed services provider`);
  }

  if (filters.mustSupportAzure || filters.mustHaveAzurePartnerEvidence) {
    queries.push(`${locationPrefix} Microsoft Gold Partner managed IT`);
  }

  // Local partner directory — location-filtered clutch search
  queries.push(`${locationPrefix} managed service provider site:clutch.co`);

  // LinkedIn local search
  queries.push(`${locationPrefix} managed service provider site:linkedin.com`);

  // If multiple states, add queries for secondary states
  for (let i = 1; i < states.length && queries.length < MAX_SEARCH_QUERIES; i++) {
    queries.push(`${filters.city ? `${filters.city} ` : ""}${states[i]} managed service provider`);
  }

  return queries.slice(0, MAX_SEARCH_QUERIES);
}

export function buildWebResearchPrompt(params: {
  filters: NormalizedSearchFilters;
  queries: string[];
  scoredExamples?: ScoredExample[];
}): string {
  const { filters, queries, scoredExamples = [] } = params;

  const searchContext = {
    states: filters.states.length > 0 ? filters.states : ["United States"],
    city: filters.city ?? null,
    mustSupportAws: filters.mustSupportAws,
    mustSupportAzure: filters.mustSupportAzure,
  };

  const targetStates =
    searchContext.states.length > 0 ? searchContext.states.join(", ") : "United States";
  const locationPhrase = searchContext.city
    ? `${searchContext.city}, ${targetStates}`
    : targetStates;

  const lines: string[] = [
    // --- Objective ---
    "You are a research assistant finding real U.S. Managed Service Providers (MSPs) for an internal sales team.",
    `Find as many MSP companies as possible whose PRIMARY HEADQUARTERS is in: ${locationPhrase}.`,
    `CRITICAL: ONLY include companies headquartered in ${targetStates}. Exclude national MSPs that just have offices there.`,
    "",

    // --- Strategy: breadth first ---
    "STRATEGY — maximize the number of companies found:",
    `Step 1 — Run all of these searches and collect every MSP company name + website URL you find in the results:`,
    ...queries.map((q, i) => `  Search ${i + 1}: "${q}"`),
    ...(searchContext.mustSupportAws ? [
      `  Search also: AWS Partner Network directory at https://partners.aws.amazon.com/search for "${locationPhrase} managed services"`,
    ] : []),
    ...(searchContext.mustSupportAzure ? [
      `  Search also: Microsoft partner directory at https://appsource.microsoft.com/en-us/marketplace/partner-dir for managed services in "${locationPhrase}"`,
    ] : []),
    "",
    "Step 2 — From all search results, compile a list of unique company names and their websites.",
    "  - Use the website URL shown directly in search results whenever possible.",
    "  - Only search for a missing website if the company looks like a strong MSP lead and you have not used many searches yet.",
    "  - NEVER visit individual company websites just to confirm — use what is visible in search snippets.",
    "",
    "Step 3 — For each company on your list, search LinkedIn to find their employee count:",
    `  - Search: "[company name] site:linkedin.com/company" for each company`,
    "  - LinkedIn search snippets usually show employee count (e.g. '11-50 employees', '51-200 employees').",
    "  - You do not need to open the LinkedIn page — the snippet alone is enough.",
    "  - Classify using: micro=1-10, small=11-75, mid=76-300, large=300+",
    "  - If LinkedIn shows nothing for a company, set companySizeTier to null.",
    "",
    "Step 4 — For each company on your list, fill in the remaining JSON fields:",
    "  - isMsp: true if the company name or search snippet clearly indicates managed IT services.",
    "  - awsSupport / azureSupport: true if search snippet or website title mentions AWS, Azure, or Microsoft partner.",
    "  - headquartersState: use the state visible in the search result. If unclear, use the target state.",
    "",

    // --- MSP definition ---
    "MSP DEFINITION — isMsp: true when:",
    "- Company sells ongoing managed IT services (help desk, monitoring, security, network management)",
    "- Managed services is a primary offering, not a side service",
    "",

    // --- Disqualifiers ---
    "DISQUALIFIERS — isMsp: false:",
    '- Recruiters / staffing firms → disqualifierType: "recruiter"',
    '- Software-only vendors → disqualifierType: "software_vendor"',
    '- Directory or listing sites → disqualifierType: "directory"',
    "",

    // --- Data rules ---
    "DATA RULES:",
    "- website: required. Use the URL from search results. If not found, do ONE targeted search for it then move on.",
    "- Never fabricate data. Use null for anything you cannot confirm.",
    "- headquartersState: 2-letter code (UT, TX, CA, etc.).",
    "- sources: include 1–2 sources per company max. Use the search result URL as the source.",
    `- Return up to ${MAX_CANDIDATES} companies. Quantity matters — include every MSP you found, even if evidence is thin.`,
    "- Return ONLY raw JSON. No markdown, no code fences, no explanation.",
    "",
  ];

  // Extra criteria gets its own section so the model treats it as a priority
  if (filters.extraCriteria) {
    lines.push("ADDITIONAL CRITERIA FROM USER (treat these as mandatory filters):");
    lines.push(filters.extraCriteria);
    lines.push("");
  }

  // Schema definition
  lines.push(
    "REQUIRED JSON OUTPUT SHAPE (use exact key names):",
    "{",
    '  "companies": [',
    "    {",
    '      "companyName": "string",',
    '      "website": "https://example.com" | null,',
    '      "headquartersCity": "string" | null,',
    '      "headquartersState": "2-letter state code" | null,',
    '      "employeeCountExact": number | null,',
    '      "employeeCountMin": number | null,',
    '      "employeeCountMax": number | null,',
    '      "companySizeTier": "micro" | "small" | "mid" | "large" | null,',
    '      "awsSupport": boolean,',
    '      "azureSupport": boolean,',
    '      "awsPartnerClaimed": boolean,',
    '      "azurePartnerClaimed": boolean,',
    '      "awsResellerConfirmed": boolean,',
    '      "azureResellerConfirmed": boolean,',
    '      "isMsp": boolean,',
    '      "disqualifierType": "recruiter" | "staffing" | "software_vendor" | "directory" | null,',
    '      "sources": [',
    "        {",
    '          "url": "https://example.com/page",',
    '          "title": "Page title" | null,',
    '          "sourceType": "official_website" | "linkedin" | "partner_directory" | "third_party" | "other",',
    '          "claim": "Short factual claim from this source",',
    '          "supportsMsp": boolean,',
    '          "supportsAws": boolean,',
    '          "supportsAzure": boolean,',
    '          "supportsEmployeeCount": boolean,',
    '          "supportsHeadquarters": boolean',
    "        }",
    "      ]",
    "    }",
    "  ]",
    "}",
    "",
    `Search context: ${JSON.stringify({ states: searchContext.states, city: searchContext.city, mustSupportAws: searchContext.mustSupportAws, mustSupportAzure: searchContext.mustSupportAzure })}`,
  );

  if (scoredExamples.length > 0) {
    lines.push(
      "",
      "HIGH-VALUE EXAMPLES — these companies were scored highly (7+/10) by our team as ideal leads.",
      "Use them as a reference for the TYPE of company we want. Find similar companies — same size range,",
      "same service profile, same caliber. Do NOT return these exact companies again.",
      "",
      ...scoredExamples.map((ex, i) => {
        const loc = [ex.headquartersCity, ex.headquartersState].filter(Boolean).join(", ");
        const cloud = [ex.awsSupport && "AWS", ex.azureSupport && "Azure"]
          .filter(Boolean)
          .join(" + ");
        const summary = ex.evidenceSummary
          ? ` — ${ex.evidenceSummary.slice(0, 120)}`
          : "";
        return `Example ${i + 1}: ${ex.companyName}${loc ? ` (${loc})` : ""}${cloud ? ` | ${cloud}` : ""}${summary}`;
      }),
    );
  }

  return lines.join("\n");
}

export function buildSeedCompanyPrompt(params: {
  companies: string[];
  filters: NormalizedSearchFilters;
}): string {
  const { companies, filters } = params;

  const targetStates = filters.states.length > 0 ? filters.states.join(", ") : "United States";

  const lines: string[] = [
    "You are a research assistant verifying and enriching specific company profiles for an internal sales team.",
    "",
    "For each company in the list below, search the web to find:",
    "1. Their official website URL",
    "2. Confirmation that they are a Managed Service Provider (MSP)",
    "3. Their primary headquarters city and state",
    "4. Whether they support AWS and/or Azure",
    "5. Their approximate company size (employee count or size tier)",
    "",
    "COMPANIES TO RESEARCH (research EVERY one of these — these are known targets):",
    ...companies.map((name, i) => `  ${i + 1}. ${name}`),
    "",
    `Target region for context: ${targetStates}`,
    "",
    "INSTRUCTIONS:",
    "- Search for each company by name. Use their official website if you find it.",
    "- Include EACH company in your output, even if you cannot confirm all details.",
    "- For isMsp: set true if their website or search snippets mention managed IT services, help desk, monitoring, etc.",
    "- For website: use the official domain found in search results. Do not guess.",
    "- For headquartersState: use 2-letter code (e.g. UT, TX). Look for 'About Us' or 'Contact' page hints in snippets.",
    "- For companySizeTier: search '[company name] site:linkedin.com/company' — the snippet usually shows employee count (e.g. '11-50 employees'). Classify: micro=1-10, small=11-75, mid=76-300, large=300+. Use null only if LinkedIn shows nothing.",
    "- Return ONLY raw JSON. No markdown, no code fences, no explanation.",
    "",
    "REQUIRED JSON OUTPUT SHAPE (use exact key names):",
    "{",
    '  "companies": [',
    "    {",
    '      "companyName": "string",',
    '      "website": "https://example.com" | null,',
    '      "headquartersCity": "string" | null,',
    '      "headquartersState": "2-letter state code" | null,',
    '      "employeeCountExact": number | null,',
    '      "employeeCountMin": number | null,',
    '      "employeeCountMax": number | null,',
    '      "companySizeTier": "micro" | "small" | "mid" | "large" | null,',
    '      "awsSupport": boolean,',
    '      "azureSupport": boolean,',
    '      "awsPartnerClaimed": boolean,',
    '      "azurePartnerClaimed": boolean,',
    '      "awsResellerConfirmed": boolean,',
    '      "azureResellerConfirmed": boolean,',
    '      "isMsp": boolean,',
    '      "disqualifierType": "recruiter" | "staffing" | "software_vendor" | "directory" | null,',
    '      "sources": [',
    "        {",
    '          "url": "https://example.com/page",',
    '          "title": "Page title" | null,',
    '          "sourceType": "official_website" | "linkedin" | "partner_directory" | "third_party" | "other",',
    '          "claim": "Short factual claim from this source",',
    '          "supportsMsp": boolean,',
    '          "supportsAws": boolean,',
    '          "supportsAzure": boolean,',
    '          "supportsEmployeeCount": boolean,',
    '          "supportsHeadquarters": boolean',
    "        }",
    "      ]",
    "    }",
    "  ]",
    "}",
  ];

  return lines.join("\n");
}
