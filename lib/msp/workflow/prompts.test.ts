import { MAX_SEARCH_QUERIES } from "@/lib/msp/constants";
import { normalizeSearchFilters } from "@/lib/msp/schemas";
import { buildSearchQueries } from "@/lib/msp/workflow/prompts";

describe("buildSearchQueries", () => {
  it("caps query breadth based on MAX_SEARCH_QUERIES", () => {
    const filters = normalizeSearchFilters({
      states: ["AZ", "CO", "CA", "TX"],
      mustSupportAws: true,
      mustSupportAzure: true,
    });

    const queries = buildSearchQueries(filters);
    expect(queries.length).toBeLessThanOrEqual(MAX_SEARCH_QUERIES);
  });
});
