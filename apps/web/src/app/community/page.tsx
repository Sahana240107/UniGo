'use client';

/**
 * src/app/community/page.tsx
 * JoinCommunityPage — rider selects their community type(s).
 * After joining at least one community, shows "Go to Dashboard" CTA.
 */

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';

interface Tile {
  href: string;
  emoji: string;
  title: string;
  subtitle: string;
  badge: string;
  badgeBg: string;
  badgeColor: string;
  borderColor: string;
}

const TILES: Tile[] = [
  {
    href: '/community/organization',
    emoji: '🎓',
    title: 'Organisation',
    subtitle: 'Verify your work or college email to join your institution\'s pool',
    badge: 'Strongest trust',
    badgeBg: 'bg-[#EAE8FF]',
    badgeColor: 'text-[#6C63FF]',
    borderColor: 'border-[#6C63FF]',
  },
  {
    href: '/community/neighbourhood',
    emoji: '📍',
    title: 'Neighbourhood',
    subtitle: 'Enter your area and confirm with GPS to join your locality pool',
    badge: 'GPS confirmed',
    badgeBg: 'bg-[#DCFCE7]',
    badgeColor: 'text-[#166534]',
    borderColor: 'border-[#22C55E]',
  },
  {
    href: '/community/invitecode',
    emoji: '👥',
    title: 'TrustCircle',
    subtitle: 'Have an invite code? Join a private circle — or create your own',
    badge: 'Private group',
    badgeBg: 'bg-[#FEF3C7]',
    badgeColor: 'text-[#92400E]',
    borderColor: 'border-[#F59E0B]',
  },
];

export default function JoinCommunityPage() {
  const router = useRouter();
  const { user, communities, isLoading } = useAuth();

  useEffect(() => {
    if (isLoading) return;
    if (!user) router.replace('/login');
  }, [isLoading, user, router]);

  const hasCommunity = communities && communities.length > 0;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F8F7FF] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-[#6C63FF] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[#F8F7FF] px-5 py-10">
      <section className="mx-auto max-w-2xl">
        <div className="mb-8">
          <h1 className="text-3xl font-extrabold text-[#1A1A2E] tracking-tight">
            Join Your Communities
          </h1>
          <p className="mt-3 text-[15px] text-[#6B6B8A] leading-relaxed max-w-lg">
            Choose who you want to carpool with. Each layer you join expands
            your matching pool. You need at least one to continue.
          </p>
        </div>

        {/* Top row: Organisation + Neighbourhood */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          {TILES.slice(0, 2).map((tile) => (
            <Link
              key={tile.href}
              href={tile.href}
              className={`group flex flex-col bg-white rounded-2xl p-5 border-[1.5px] ${tile.borderColor} shadow-sm hover:shadow-md transition-shadow`}
            >
              <span className="text-4xl mb-3">{tile.emoji}</span>
              <span className="text-[16px] font-extrabold text-[#1A1A2E] mb-2">{tile.title}</span>
              <span className="text-[13px] text-[#6B6B8A] leading-[1.5] mb-4 flex-1">{tile.subtitle}</span>
              <span className={`self-start text-[11px] font-extrabold tracking-wide px-2.5 py-1 rounded-md ${tile.badgeBg} ${tile.badgeColor}`}>
                {tile.badge}
              </span>
            </Link>
          ))}
        </div>

        {/* Bottom row: TrustCircle centred */}
        <div className="flex justify-center mb-8">
          <Link
            href={TILES[2].href}
            className={`flex flex-col items-center bg-white rounded-2xl p-5 border-[1.5px] ${TILES[2].borderColor} shadow-sm hover:shadow-md transition-shadow w-[55%]`}
          >
            <span className="text-4xl mb-3">{TILES[2].emoji}</span>
            <span className="text-[16px] font-extrabold text-[#1A1A2E] mb-2">{TILES[2].title}</span>
            <span className="text-[13px] text-[#6B6B8A] leading-[1.5] text-center mb-4">{TILES[2].subtitle}</span>
            <span className={`text-[11px] font-extrabold tracking-wide px-2.5 py-1 rounded-md ${TILES[2].badgeBg} ${TILES[2].badgeColor}`}>
              {TILES[2].badge}
            </span>
          </Link>
        </div>

        {/* CTA: Continue to dashboard once at least one community joined */}
        {hasCommunity ? (
          <div className="flex flex-col items-center gap-3">
            <div className="flex items-center gap-2 text-[#22C55E] font-semibold text-[14px]">
              <span>✅</span>
              <span>{communities.length} {communities.length === 1 ? 'community' : 'communities'} joined</span>
            </div>
            <button
              onClick={() => router.push('/pulse')}
              className="w-full bg-[#6C63FF] text-white font-bold py-4 rounded-2xl hover:bg-[#4B44CC] transition-colors text-[16px]"
            >
              Go to Dashboard →
            </button>
          </div>
        ) : (
          <p className="text-center text-[12px] text-[#A0A0B8] leading-relaxed">
            You can join multiple communities and add more any time from your Profile.
          </p>
        )}
      </section>
    </main>
  );
}