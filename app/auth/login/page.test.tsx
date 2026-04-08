import Page from "@/app/auth/login/page";
import { redirect } from "next/navigation";

jest.mock("next/navigation", () => ({
  redirect: jest.fn(),
}));

describe("Login page", () => {
  it("redirects to dashboard", () => {
    Page();
    expect(redirect).toHaveBeenCalledWith("/dashboard");
  });
});
