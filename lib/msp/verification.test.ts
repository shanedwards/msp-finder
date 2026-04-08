import { normalizeSearchFilters } from "@/lib/msp/schemas";
import { ExtractedCandidate } from "@/lib/msp/types";
import { evaluateVerification } from "@/lib/msp/verification";

function makeCandidate(partial?: Partial<ExtractedCandidate>): ExtractedCandidate {
  return {
    companyName: "Example MSP",
    website: "https://www.examplemsp.com",
    headquartersCity: "Phoenix",
    headquartersState: "AZ",
    employeeCountExact: 70,
    employeeCountMin: null,
    employeeCountMax: null,
    companySizeTier: "small",
    awsSupport: true,
    azureSupport: true,
    awsPartnerClaimed: true,
    azurePartnerClaimed: true,
    awsResellerConfirmed: true,
    azureResellerConfirmed: false,
    isMsp: true,
    disqualifierType: null,
    sources: [
      {
        url: "https://www.examplemsp.com/services",
        title: "Services",
        sourceType: "official_website",
        claim: "Managed IT services and cloud operations are listed.",
        supportsMsp: true,
        supportsAws: true,
        supportsAzure: true,
        supportsEmployeeCount: true,
        supportsHeadquarters: true,
      },
    ],
    ...partial,
  };
}

describe("evaluateVerification", () => {
  it("rejects companies outside selected headquarters_state filters", () => {
    const filters = normalizeSearchFilters({ states: ["CO"] });
    const result = evaluateVerification(makeCandidate(), filters);
    expect(result.status).toBe("rejected");
  });

  it("marks as rejected when required AWS evidence is missing", () => {
    const filters = normalizeSearchFilters({ mustSupportAws: true });
    const result = evaluateVerification(makeCandidate({ awsSupport: false }), filters);
    expect(result.status).toBe("rejected");
  });

  it("marks as verified when deterministic checks pass", () => {
    const filters = normalizeSearchFilters({
      states: ["AZ"],
      mustSupportAws: true,
      mustSupportAzure: true,
      mustHaveAwsResellerEvidence: true,
      mustHaveAzurePartnerEvidence: true,
    });

    const result = evaluateVerification(makeCandidate(), filters);
    expect(result.status).toBe("verified");
  });
});
