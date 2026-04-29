import { normalizeSearchFilters } from "@/lib/msp/schemas";
import { buildSearchQueryPool } from "@/lib/msp/workflow/prompts";

describe("buildSearchQueryPool", () => {
  it("returns a pool larger than MAX_SEARCH_QUERIES for multi-round sampling", () => {
    const filters = normalizeSearchFilters({
      states: ["AZ", "CO", "CA", "TX"],
      mustSupportAws: true,
      mustSupportAzure: true,
    });

    const pool = buildSearchQueryPool(filters);
    expect(pool.length).toBeGreaterThan(8);
  });
});
