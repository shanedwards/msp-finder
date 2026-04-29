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

  // Always-on cloud-focused queries
  queries.push(`${locationPrefix} AWS partner cloud services`);
  queries.push(`${locationPrefix} Azure partner cloud services`);
  queries.push(`${locationPrefix} cloud consulting firm AWS Azure`);

  // Extra queries when specific cloud filters are enabled
  if (filters.mustSupportAws || filters.mustHaveAwsResellerEvidence) {
    queries.push(`${locationPrefix} AWS managed services partner`);
    queries.push(`${locationPrefix} AWS partner IT managed services`);
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

const MAX_EXCLUDED_DOMAINS = 30;

export function buildWebResearchPrompt(params: {
  filters: NormalizedSearchFilters;
  queries: string[];
  scoredExamples?: ScoredExample[];
  lowScoredExamples?: ScoredExample[];
  knownDomains?: string[];
}): string {
  const { filters, queries, scoredExamples = [], lowScoredExamples = [], knownDomains = [] } = params;

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
    "You are a research assistant finding real U.S. Managed Services Providers (MSPs) or any firm that provides AWS and/or Azure cloud services for an internal sales team.",
    `Find as many MSP or AWS and/or Azure cloud services companies as possible whose PRIMARY HEADQUARTERS is in: ${locationPhrase}.`,
    `CRITICAL: ONLY include companies headquartered in ${targetStates}. Exclude national MSPs that just have offices there.`,
    "",

    // --- Strategy: breadth first ---
    "STRATEGY — maximize the number of companies found:",
    `Step 1 — Run all of these searches and collect every MSP company name + website URL you find in the results:`,
    ...queries.map((q, i) => `  Search ${i + 1}: "${q}"`),
    `  Search also: AWS Partner Network directory at https://partners.amazonaws.com/search/partners for "${locationPhrase} managed services"`,
    `  Search also: Microsoft partner directory at https://appsource.microsoft.com/en-us/marketplace/partner-dir for managed services in "${locationPhrase}"`,
    `  Search also: general web search for "${locationPhrase} managed services provider" to find any additional MSPs not listed in partner directories`,
    "",
    "Step 2 — From all search results, compile a list of unique company names and their websites.",
    "  - Use the website URL shown directly in search results whenever possible.",
    "  - Only search for a missing website if the company looks like a strong MSP lead and you have not used many searches yet.",
    "  - Visit individual company website homepage, services page, solutions page, and/or contact/about page to confirm and collect information about AWS Support, Azure Support, AWS Reseller, and Azure CSP.",
    "",
    "Step 3 — For each company on your list, fill in the remaining JSON fields:",
    "  - isMsp: true if the company name, search snippet, or any page visited clearly indicates a managed services provider, cloud services firm, AWS/Azure partner, reseller, CSP, cloud consultant, or cloud migration/operations firm.",
    "  - awsSupport / azureSupport: true if search snippet, website title, homepage, services page, or solutions page mentions AWS and/or Azure managed services provider..",
    "  - headquartersState: check the company's Contact page or About Us page footer for a physical address and use the state from that address. If not found there, use the state visible in the search result.",
    "",

    // --- MSP definition ---
    "MSP DEFINITION — isMsp: true when ANY of the following apply:",
    "- Company sells ongoing managed AWS and/or Azure services",
    "- Company is an AWS Partner, AWS reseller, or AWS CSP",
    "- Company is a Microsoft/Azure Partner, Azure reseller, or Azure CSP",
    "- Company provides cloud migration, cloud consulting, or cloud architecture services on AWS or Azure",
    "- Company manages AWS or Azure infrastructure on behalf of clients",
    "- Company offers cloud-managed services, DevOps, or cloud operations on AWS or Azure",
    "",

    // --- Disqualifiers ---
    "DISQUALIFIERS — isMsp: false:",
    '- Recruiters / staffing firms → disqualifierType: "recruiter"',
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
    ...(knownDomains.length > 0 ? [
      `EXCLUDED DOMAINS — these companies are already in our database. Do NOT return any company whose website matches one of these domains:`,
      knownDomains.slice(0, MAX_EXCLUDED_DOMAINS).join(", "),
      "",
    ] : []),
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
        const note = ex.notes ? ` [note: ${ex.notes.slice(0, 100)}]` : "";
        return `Example ${i + 1}: ${ex.companyName}${loc ? ` (${loc})` : ""}${cloud ? ` | ${cloud}` : ""}${summary}${note}`;
      }),
    );
  }

  if (lowScoredExamples.length > 0) {
    lines.push(
      "",
      "LOW-VALUE EXAMPLES — these companies were rated poorly (3 or below) by our team. Avoid returning companies like these.",
      "Use them as a reference for the TYPE of company we do NOT want.",
      "",
      ...lowScoredExamples.map((ex, i) => {
        const loc = [ex.headquartersCity, ex.headquartersState].filter(Boolean).join(", ");
        const cloud = [ex.awsSupport && "AWS", ex.azureSupport && "Azure"]
          .filter(Boolean)
          .join(" + ");
        const summary = ex.evidenceSummary
          ? ` — ${ex.evidenceSummary.slice(0, 120)}`
          : "";
        const note = ex.notes ? ` [note: ${ex.notes.slice(0, 100)}]` : "";
        return `Bad Example ${i + 1}: ${ex.companyName}${loc ? ` (${loc})` : ""}${cloud ? ` | ${cloud}` : ""}${summary}${note}`;
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
