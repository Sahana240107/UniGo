'use client';

/**
 * src/app/(auth)/login/page.tsx
 * EntryScreen — first screen shown when no active session.
 * Three entry paths: Rider, Driver, Admin.
 */

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';

export default function EntryPage() {
  const router = useRouter();
  const { user, communities, driverProfile, isLoading } = useAuth();

  // If already logged in, skip login page
  useEffect(() => {
    if (isLoading) return;
    if (!user) return;

    if (driverProfile) {
      router.replace(driverProfile.submission_state === 'active' ? '/driver/dashboard' : '/driver/pending');
      return;
    }
    router.replace(communities?.length > 0 ? '/pulse' : '/community');
  }, [isLoading, user, communities, driverProfile, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F8F7FF] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-[#6C63FF] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[#F8F7FF] flex flex-col items-center justify-between px-6 py-14">
      {/* Brand */}
      <div className="flex flex-col items-center gap-2 mt-4">
        <div className="w-[72px] h-[72px] rounded-full bg-[#6C63FF] flex items-center justify-center shadow-lg shadow-[#6C63FF]/40">
          <span className="text-white text-4xl font-extrabold">U</span>
        </div>
        <h1 className="text-4xl font-extrabold text-[#1A1A2E] tracking-tight mt-2">UniGo</h1>
        <p className="text-[15px] text-[#6B6B8A] text-center">Trusted rides within your community</p>
      </div>

      {/* Cards */}
      <div className="w-full max-w-sm flex flex-col gap-4">
        {/* Rider */}
        <Link
          href="/rider/email"
          className="flex items-center gap-4 bg-white border-2 border-[#6C63FF] rounded-2xl px-5 py-5 shadow-sm hover:bg-[#EAE8FF] transition-colors"
        >
          <span className="text-3xl">🚗</span>
          <div className="flex-1">
            <p className="text-[16px] font-bold text-[#1A1A2E]">Continue as Rider</p>
            <p className="text-[13px] text-[#6B6B8A]">Find rides in your TrustCircle</p>
          </div>
          <span className="text-[#A0A0B8] text-2xl font-light">›</span>
        </Link>

        {/* Driver */}
        <Link
          href="/driver/email"
          className="flex items-center gap-4 bg-[#6C63FF] rounded-2xl px-5 py-5 shadow-md shadow-[#6C63FF]/30 hover:bg-[#4B44CC] transition-colors"
        >
          <span className="text-3xl">🏎️</span>
          <div className="flex-1">
            <p className="text-[16px] font-bold text-white">Continue as Driver</p>
            <p className="text-[13px] text-white/80">Offer rides and earn together</p>
          </div>
          <span className="text-white/60 text-2xl font-light">›</span>
        </Link>

        {/* Admin */}
        <Link
          href="/admin/login"
          className="flex items-center gap-4 bg-white border border-[#E5E4F0] rounded-2xl px-5 py-5 shadow-sm hover:bg-[#F8F7FF] transition-colors"
        >
          <span className="text-3xl">🔐</span>
          <div className="flex-1">
            <p className="text-[16px] font-bold text-[#1A1A2E]">Admin Sign In</p>
            <p className="text-[13px] text-[#6B6B8A]">Document review &amp; management</p>
          </div>
          <span className="text-[#A0A0B8] text-2xl font-light">›</span>
        </Link>
      </div>

      {/* Footer */}
      <p className="text-[12px] text-[#A0A0B8] text-center">
        By continuing you agree to our{' '}
        <a href="/terms" className="text-[#6C63FF] font-semibold">Terms</a>{' '}
        &amp;{' '}
        <a href="/privacy" className="text-[#6C63FF] font-semibold">Privacy Policy</a>
      </p>
    </main>
  );
}