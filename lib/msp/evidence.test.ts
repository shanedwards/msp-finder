import { composeEvidenceSummary } from "@/lib/msp/evidence";

describe("composeEvidenceSummary", () => {
  it("creates a concise summary from evidence sources", () => {
    const summary = composeEvidenceSummary({
      headquartersCity: "Phoenix",
      headquartersState: "AZ",
      employeeCountExact: 72,
      employeeCountMin: null,
      employeeCountMax: null,
      sources: [
        {
          url: "https://example.com/services",
          title: "Services",
          sourceType: "official_website",
          claim: "Official site lists managed IT support and cloud operations.",
          supportsMsp: true,
          supportsAws: false,
          supportsAzure: false,
          supportsEmployeeCount: false,
          supportsHeadquarters: false,
        },
        {
          url: "https://example.com/cloud",
          title: "Cloud",
          sourceType: "official_website",
          claim: "Azure migration and AWS optimization are listed on cloud solutions pages.",
          supportsMsp: false,
          supportsAws: true,
          supportsAzure: true,
          supportsEmployeeCount: false,
          supportsHeadquarters: false,
        },
      ],
    });

    expect(summary.length).toBeGreaterThan(10);
    const sentenceCount = summary.split(/[.!?]\s*/).filter(Boolean).length;
    expect(sentenceCount).toBeLessThanOrEqual(3);
  });

  it("falls back to a review message when no evidence exists", () => {
    const summary = composeEvidenceSummary({
      headquartersCity: null,
      headquartersState: null,
      employeeCountExact: null,
      employeeCountMin: null,
      employeeCountMax: null,
      sources: [],
    });

    expect(summary).toBe("Evidence is limited and needs manual review.");
  });
});
