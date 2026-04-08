import { renderHook, act } from "@testing-library/react";
import { useProfileImageUpload } from "@/hooks/use-profile-image-upload";

const mockPush = jest.fn();
const mockRefresh = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, refresh: mockRefresh }),
}));

jest.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({ user: { id: "user-1" } }),
}));

const mockUpdateProfile = jest.fn();
jest.mock("@/contexts/profile-context", () => ({
  useProfileContext: () => ({ updateProfile: mockUpdateProfile }),
}));

const mockUpload = jest.fn();
const mockGetPublicUrl = jest.fn();
const mockUpdate = jest.fn();
jest.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    storage: {
      from: () => ({
        upload: (path: string, file: File) => {
          void path;
          void file;
          return mockUpload();
        },
        getPublicUrl: (path: string) => mockGetPublicUrl(path),
      }),
    },
    from: () => ({
      update: (data: unknown) => {
        mockUpdate(data);
        return { eq: () => Promise.resolve({ error: null }) };
      },
    }),
  }),
}));

jest.mock("@/lib/resize-image", () => ({
  resizeImage: (file: File) => Promise.resolve(file),
}));

describe("useProfileImageUpload", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUpload.mockResolvedValue({ error: null });
    mockGetPublicUrl.mockReturnValue({
      data: { publicUrl: "https://example.com/avatar.jpg" },
    });
    mockUpdate.mockReturnValue(Promise.resolve({ error: null }));
  });

  it("uploads file and calls updateProfile with new URL", async () => {
    const { result } = renderHook(() => useProfileImageUpload());
    const file = new File(["content"], "avatar.jpg", { type: "image/jpeg" });

    await act(async () => {
      await result.current.upload(file);
    });

    expect(mockUpload).toHaveBeenCalled();
    expect(mockUpdateProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        profile_picture_url: expect.stringContaining("avatar.jpg"),
      })
    );
    expect(mockRefresh).toHaveBeenCalled();
  });

  it("sets error when file type is invalid", async () => {
    const { result } = renderHook(() => useProfileImageUpload());
    const file = new File(["content"], "doc.pdf", { type: "application/pdf" });

    await act(async () => {
      await result.current.upload(file);
    });

    expect(result.current.error).toBe(
      "Please choose a JPEG, PNG, WebP, GIF, or SVG image."
    );
    expect(mockUpload).not.toHaveBeenCalled();
  });
});
