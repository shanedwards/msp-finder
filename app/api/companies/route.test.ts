/** @jest-environment node */

import { GET } from "@/app/api/companies/route";

jest.mock("@/lib/msp/schemas", () => ({
  parseCompanyListFiltersFromSearchParams: jest.fn(() => ({
    states: [],
    city: null,
    minimumEmployees: null,
    maximumEmployees: null,
    mustSupportAws: false,
    mustSupportAzure: false,
    mustHaveAwsResellerEvidence: false,
    mustHaveAzurePartnerEvidence: false,
    showOnlyVerified: false,
    includeNeedsReview: true,
    resultLimit: 10,
    extraCriteria: null,
  })),
}));

jest.mock("@/lib/msp/repository", () => ({
  listCompanyRows: jest.fn(() =>
    Promise.resolve([
      {
        id: "company-1",
        companyName: "Example MSP",
        website: "https://example.com",
        evidence: "Managed services listed on official site.",
        geography: "Phoenix, AZ",
        employeeCount: "72",
        score: 8,
      },
    ]),
  ),
}));

describe("GET /api/companies", () => {
  it("returns CompanyRow[] contract", async () => {
    const response = await GET(new Request("http://localhost:3000/api/companies"));
    const payload = await response.json();

    expect(Array.isArray(payload)).toBe(true);
    expect(payload[0]).toEqual({
      id: expect.any(String),
      companyName: expect.any(String),
      website: expect.any(String),
      evidence: expect.any(String),
      geography: expect.any(String),
      employeeCount: expect.any(String),
      score: expect.any(Number),
    });
  });
});
