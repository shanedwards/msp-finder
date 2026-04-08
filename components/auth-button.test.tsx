import { render, screen } from "@testing-library/react";
import { AuthButton } from "@/components/auth-button";
import { useAuth } from "@/hooks/use-auth";
import { useProfile } from "@/hooks/use-profile";

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn(), refresh: jest.fn() }),
}));

jest.mock("@/hooks/use-auth", () => ({
  useAuth: jest.fn(),
}));

jest.mock("@/hooks/use-profile", () => ({
  useProfile: jest.fn(),
}));

const mockUseAuth = useAuth as jest.Mock;
const mockUseProfile = useProfile as jest.Mock;

describe("AuthButton", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("shows loading placeholder when loading", () => {
    mockUseAuth.mockReturnValue({ user: null, loading: true });
    mockUseProfile.mockReturnValue({ profile: null });
    render(<AuthButton />);
    expect(screen.queryByText("Sign in")).not.toBeInTheDocument();
    expect(screen.queryByText("Sign up")).not.toBeInTheDocument();
  });

  it("shows Sign in and Sign up when user is null", () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false });
    mockUseProfile.mockReturnValue({ profile: null });
    render(<AuthButton />);
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute(
      "href",
      "/auth/login"
    );
    expect(screen.getByRole("link", { name: "Sign up" })).toHaveAttribute(
      "href",
      "/auth/sign-up"
    );
  });

  it("shows email, avatar, and Logout when user is logged in", () => {
    mockUseAuth.mockReturnValue({
      user: { email: "user@example.com" },
      loading: false,
    });
    mockUseProfile.mockReturnValue({
      profile: { first_name: "John", last_name: "Doe", profile_picture_url: null },
    });
    render(<AuthButton />);
    expect(screen.getByText("user@example.com")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Logout" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Avatar for JD" })).toBeInTheDocument();
  });
});
