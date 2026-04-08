"use client";

import Link from "next/link";
import { DashboardMenu } from "@/app/dashboard/_components/dashboard-menu";
import { ProfileImageUpload } from "@/app/profile/_components/profile-image-upload";
import { FormDisplayField } from "@/components/form";
import { useAuth } from "@/hooks/use-auth";
import { useProfile } from "@/hooks/use-profile";

export default function ProfilePage() {
  const { user, loading: authLoading } = useAuth();
  const { profile, loading: profileLoading, error } = useProfile();

  if (authLoading || profileLoading) {
    return (
      <>
        <div className="flex justify-end p-4">
          <DashboardMenu />
        </div>
        <main className="min-h-screen flex flex-col items-center">
          <div className="w-full max-w-md">
            <h1 className="text-4xl font-bold mb-6">Profile</h1>
            <p className="text-gray-600">Loading profile...</p>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <div className="flex justify-end p-4">
        <DashboardMenu />
      </div>
      <main className="min-h-screen flex flex-col items-center">
        <div className="w-full max-w-md">
          <h1 className="text-4xl font-bold mb-6">Profile</h1>
          {!user ? (
            <div className="border rounded p-4">
              <p className="text-gray-700">
                Open access mode is enabled. Signed-in profile details are unavailable.
              </p>
            </div>
          ) : error ? (
            <div className="border rounded p-4">
              <p className="text-red-500 mb-2">Error loading profile</p>
              <p className="text-sm text-gray-600">{error}</p>
            </div>
          ) : profile ? (
            <div className="border rounded p-6 space-y-4">
              <div className="flex justify-center pb-4">
                <ProfileImageUpload
                  profile={{
                    profile_picture_url: profile.profile_picture_url,
                    first_name: profile.first_name,
                    last_name: profile.last_name,
                  }}
                />
              </div>
              <FormDisplayField label="Email">
                {user.email}
              </FormDisplayField>
              {profile.first_name && (
                <FormDisplayField label="First Name">
                  {profile.first_name}
                </FormDisplayField>
              )}
              {profile.last_name && (
                <FormDisplayField label="Last Name">
                  {profile.last_name}
                </FormDisplayField>
              )}
              {profile.created_at && (
                <FormDisplayField label="Member Since">
                  {new Date(profile.created_at).toLocaleDateString()}
                </FormDisplayField>
              )}
            </div>
          ) : (
            <div className="border rounded p-4">
              <p className="text-gray-600">No profile found.</p>
            </div>
          )}
          <div className="mt-6">
            <Link
              href="/dashboard"
              className="text-blue-600 hover:underline"
            >
              ← Back to Dashboard
            </Link>
          </div>
        </div>
      </main>
    </>
  );
}
