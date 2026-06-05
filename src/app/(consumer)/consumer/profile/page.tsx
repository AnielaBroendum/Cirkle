'use client';

import { useAuth } from '@/components/providers/auth-provider';

export default function ConsumerProfilePage() {
  const { profile, signOut } = useAuth();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Min profil</h1>

      {profile && (
        <div className="bg-gray-50 rounded-xl p-4 space-y-2">
          <p className="font-medium text-gray-900">{profile.name}</p>
          <p className="text-sm text-gray-500">{profile.email}</p>
        </div>
      )}

      <button
        onClick={signOut}
        className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
      >
        Log ud
      </button>
    </div>
  );
}
