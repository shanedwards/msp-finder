import { formatEmployeeCount } from "@/lib/msp/formatting";

describe("formatEmployeeCount", () => {
  it("returns exact value when exact employee count exists", () => {
    expect(formatEmployeeCount(75, null, null)).toBe("75");
  });

  it("returns range value when min and max exist", () => {
    expect(formatEmployeeCount(null, 50, 120)).toBe("50-120");
  });

  it("returns Unknown when count is unsupported", () => {
    expect(formatEmployeeCount(null, null, null)).toBe("Unknown");
  });
});
