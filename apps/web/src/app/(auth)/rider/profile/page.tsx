'use client';

/**
 * src/app/(auth)/rider/profile/page.tsx
 * RiderProfileSetupScreen — collect name + gender for new riders.
 * After completion → /community (rider must join at least one community).
 */

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { completeRiderProfile } from '@/lib/authService';
import { useAuth } from '@/context/AuthContext';

const GENDERS = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
];

function RiderProfileContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const idToken = searchParams.get('idToken') ?? '';
  const firebase_uid = searchParams.get('uid') ?? '';
  const email = searchParams.get('email') ?? '';
  const { setSession } = useAuth();

  const [name, setName] = useState('');
  const [gender, setGender] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const canSubmit = name.trim().length >= 2 && gender;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setLoading(true);
    setError('');
    try {
      const data = await completeRiderProfile({ idToken, firebase_uid, name: name.trim(), email, gender });
      setSession(data.user, data.communities ?? [], null);
      // New rider always goes to community selection first
      router.push('/community');
    } catch (err: any) {
      setError(err?.message ?? 'Profile setup failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#F8F7FF] flex flex-col px-6 py-8">
      <div className="flex flex-col items-center mb-10">
        <span className="text-6xl mb-4">🚗</span>
        <h1 className="text-2xl font-extrabold text-[#1A1A2E] mb-2">Complete your profile</h1>
        <p className="text-[15px] text-[#6B6B8A] text-center">Just a few more details to get started</p>
      </div>

      {/* Email badge */}
      <div className="flex items-center gap-2 bg-[#EAE8FF] rounded-xl px-4 py-3 mb-6">
        <span className="text-sm">✅</span>
        <span className="text-[13px] text-[#6C63FF] font-semibold">{email}</span>
      </div>

      {/* Name */}
      <label className="text-[12px] font-semibold text-[#6B6B8A] uppercase tracking-wide mb-2">Full name</label>
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Your full name"
        autoFocus
        className="w-full bg-white border-[1.5px] border-[#E5E4F0] rounded-xl px-4 py-4 text-[15px] text-[#1A1A2E] placeholder-[#A0A0B8] focus:outline-none focus:border-[#6C63FF] mb-5"
      />

      {/* Gender */}
      <label className="text-[12px] font-semibold text-[#6B6B8A] uppercase tracking-wide mb-2">Gender</label>
      <div className="flex gap-2 mb-6">
        {GENDERS.map((g) => (
          <button
            key={g.value}
            onClick={() => setGender(g.value)}
            className={`flex-1 py-3 rounded-xl border-[1.5px] font-semibold text-[13px] transition-colors ${
              gender === g.value
                ? 'border-[#6C63FF] bg-[#EAE8FF] text-[#6C63FF]'
                : 'border-[#E5E4F0] bg-white text-[#6B6B8A] hover:border-[#6C63FF]/50'
            }`}
          >
            {g.label}
          </button>
        ))}
      </div>

      {error && <p className="text-[#EF4444] text-[13px] mb-4">{error}</p>}

      <button
        onClick={handleSubmit}
        disabled={!canSubmit || loading}
        className="w-full bg-[#6C63FF] text-white font-bold py-4 rounded-xl disabled:opacity-50 hover:bg-[#4B44CC] transition-colors"
      >
        {loading ? 'Setting up…' : 'Next: Join a Community →'}
      </button>
    </main>
  );
}

export default function RiderProfilePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#F8F7FF] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-[#6C63FF] border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <RiderProfileContent />
    </Suspense>
  );
}