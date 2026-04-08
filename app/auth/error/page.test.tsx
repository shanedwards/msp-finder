import { render, screen } from "@testing-library/react";
import Page from "@/app/auth/error/page";

describe("Auth error page", () => {
  it("renders heading and layout", () => {
    render(<Page searchParams={Promise.resolve({ error: "" })} />);
    expect(
      screen.getByRole("heading", { name: "Sorry, something went wrong." })
    ).toBeInTheDocument();
    expect(
      document.querySelector(".flex.min-h-svh")
    ).toBeInTheDocument();
  });
});
