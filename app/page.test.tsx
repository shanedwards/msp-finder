import Home from "@/app/page";
import { redirect } from "next/navigation";

jest.mock("next/navigation", () => ({
  redirect: jest.fn(),
}));

describe("Home page", () => {
  it("redirects to dashboard", () => {
    Home();
    expect(redirect).toHaveBeenCalledWith("/dashboard");
  });
});
