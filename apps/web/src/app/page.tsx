'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

/**
 * Root page — smart redirect based on session state.
 *
 * Rider  (user + no driverProfile + at least 1 community) → /pulse (dashboard)
 * Rider  (user + no driverProfile + no communities)        → /community
 * Driver (user + driverProfile active)                     → /driver/dashboard
 * Driver (user + driverProfile pending/action)             → /driver/pending
 * No session                                               → /login
 */
export default function RootPage() {
  const router = useRouter();
  const { user, communities, driverProfile, isLoading } = useAuth();

  useEffect(() => {
    if (isLoading) return;

    if (!user) {
      router.replace('/login');
      return;
    }

    if (driverProfile) {
      if (driverProfile.submission_state === 'active') {
        router.replace('/driver/dashboard');
      } else {
        router.replace('/driver/pending');
      }
      return;
    }

    // Rider path
    if (communities && communities.length > 0) {
      router.replace('/pulse');
    } else {
      router.replace('/community');
    }
  }, [isLoading, user, communities, driverProfile, router]);

  return (
    <div className="min-h-screen bg-[#F8F7FF] flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-[#6C63FF] border-t-transparent rounded-full animate-spin" />
    </div>
  );
}