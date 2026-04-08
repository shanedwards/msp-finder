import { render, screen } from "@testing-library/react";
import { Avatar, getInitials } from "@/components/avatar";

describe("getInitials", () => {
  it("returns first letter of first and last name when both provided", () => {
    expect(getInitials("John", "Doe", undefined)).toBe("JD");
    expect(getInitials("Jane", "Smith", undefined)).toBe("JS");
  });

  it("returns first two chars of first name when only first name provided", () => {
    expect(getInitials("John", null, undefined)).toBe("JO");
    expect(getInitials("A", null, undefined)).toBe("A");
  });

  it("returns first two chars of email local part when no name", () => {
    expect(getInitials(null, null, "john@example.com")).toBe("JO");
    expect(getInitials(null, null, "a@b.com")).toBe("A");
  });

  it("handles empty and whitespace", () => {
    expect(getInitials("", "", undefined)).toBe("?");
    expect(getInitials("  ", "  ", undefined)).toBe("?");
  });

  it("trims whitespace from names", () => {
    expect(getInitials("  John  ", "  Doe  ", undefined)).toBe("JD");
  });
});

describe("Avatar", () => {
  it("renders initials when imageUrl is null", () => {
    render(<Avatar imageUrl={null} initials="JD" />);
    expect(screen.getByText("JD")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Avatar for JD" })).toBeInTheDocument();
  });

  it("renders image when imageUrl is provided", () => {
    render(<Avatar imageUrl="https://example.com/avatar.jpg" initials="JD" />);
    const img = screen.getByRole("img", { name: "Profile" });
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute("src", "https://example.com/avatar.jpg");
  });
});
