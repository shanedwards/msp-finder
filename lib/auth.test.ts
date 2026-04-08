import { verifyEmailOtp, requireAuth } from "@/lib/auth";

const mockVerifyOtp = jest.fn();
const mockGetClaims = jest.fn();

jest.mock("@/lib/supabase/server", () => ({
  createClient: () =>
    Promise.resolve({
      auth: {
        verifyOtp: (args: unknown) => mockVerifyOtp(args),
        getClaims: () => mockGetClaims(),
      },
    }),
}));

describe("lib/auth", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("verifyEmailOtp", () => {
    it("returns error when token_hash is null", async () => {
      const result = await verifyEmailOtp(null, "signup");
      expect(result).toEqual({ error: "No token hash or type" });
      expect(mockVerifyOtp).not.toHaveBeenCalled();
    });

    it("returns error when token_hash is empty string", async () => {
      const result = await verifyEmailOtp("", "magiclink");
      expect(result).toEqual({ error: "No token hash or type" });
      expect(mockVerifyOtp).not.toHaveBeenCalled();
    });

    it("returns error when type is null", async () => {
      const result = await verifyEmailOtp("abc123", null);
      expect(result).toEqual({ error: "No token hash or type" });
      expect(mockVerifyOtp).not.toHaveBeenCalled();
    });

    it("returns error when type is invalid", async () => {
      const result = await verifyEmailOtp("abc123", "invalid_type");
      expect(result).toEqual({ error: "No token hash or type" });
      expect(mockVerifyOtp).not.toHaveBeenCalled();
    });

    it("calls verifyOtp and returns no error on success", async () => {
      mockVerifyOtp.mockResolvedValue({ error: null });
      const result = await verifyEmailOtp("token123", "signup");
      expect(mockVerifyOtp).toHaveBeenCalledWith({
        type: "signup",
        token_hash: "token123",
      });
      expect(result).toEqual({ error: null });
    });

    it("returns error message when verifyOtp fails", async () => {
      mockVerifyOtp.mockResolvedValue({
        error: { message: "Token expired" },
      });
      const result = await verifyEmailOtp("token123", "recovery");
      expect(result).toEqual({ error: "Token expired" });
    });

    it("accepts all valid email OTP types", async () => {
      const validTypes = [
        "signup",
        "invite",
        "magiclink",
        "recovery",
        "email",
        "email_change",
      ] as const;
      mockVerifyOtp.mockResolvedValue({ error: null });

      for (const type of validTypes) {
        await verifyEmailOtp("hash", type);
        expect(mockVerifyOtp).toHaveBeenLastCalledWith({
          type,
          token_hash: "hash",
        });
      }
    });
  });

  describe("requireAuth", () => {
    it("returns user claims when authenticated", async () => {
      const user = { sub: "user-id", email: "user@example.com" };
      mockGetClaims.mockResolvedValue({ data: { claims: user } });

      const result = await requireAuth();
      expect(result).toEqual(user);
    });

    it("returns null when no user", async () => {
      mockGetClaims.mockResolvedValue({ data: { claims: null } });

      await expect(requireAuth()).resolves.toBeNull();
    });

    it("returns null when getClaims returns undefined data", async () => {
      mockGetClaims.mockResolvedValue({ data: undefined });

      await expect(requireAuth()).resolves.toBeNull();
    });
  });
});
