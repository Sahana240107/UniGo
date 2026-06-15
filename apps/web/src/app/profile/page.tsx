'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Edit3, Shield, LogOut, X, TrendingUp, CheckCircle, AlertCircle } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import RiderTabBar from '@/components/layout/rider-tab-bar';

function ReliabilityPopup({ score, onClose }: { score: number; onClose: () => void }) {
  const getScoreLabel = (s: number) => {
    if (s >= 90) return { label: 'Excellent', color: '#085041', bg: '#E1F5EE', border: '#5DCAA5' };
    if (s >= 75) return { label: 'Good', color: '#185FA5', bg: '#E6F1FB', border: '#85B7EB' };
    if (s >= 50) return { label: 'Fair', color: '#633806', bg: '#FAEEDA', border: '#FAC775' };
    return { label: 'Needs improvement', color: '#A32D2D', bg: '#FCEBEB', border: '#F09595' };
  };

  const { label, color, bg, border } = getScoreLabel(score);
  const pct = Math.min(100, Math.max(0, score));

  const factors = [
    { label: 'Rides completed on time', ok: score >= 75 },
    { label: 'No-shows avoided',        ok: score >= 85 },
    { label: 'Cancellations minimal',   ok: score >= 90 },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-4 pb-4 sm:pb-0"
      style={{ background: 'rgba(0,0,0,0.3)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-3xl bg-white p-5"
        style={{ border: '0.5px solid #E5E5E0' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-gray-200" />

        {/* Title row */}
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-semibold text-gray-900">Reliability Score</p>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Score display */}
        <div className="flex items-center gap-4 mb-4 p-4 rounded-2xl" style={{ background: bg, border: `0.5px solid ${border}` }}>
          <div className="flex-shrink-0 w-14 h-14 rounded-full flex items-center justify-center" style={{ background: 'white', border: `2px solid ${border}` }}>
            <span className="text-xl font-bold" style={{ color }}>{score}</span>
          </div>
          <div>
            <p className="text-base font-semibold" style={{ color }}>{label}</p>
            <p className="text-xs mt-0.5" style={{ color, opacity: 0.7 }}>out of 100</p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mb-4">
          <div className="flex justify-between text-xs text-gray-400 mb-1.5">
            <span>Score progress</span>
            <span>{pct}%</span>
          </div>
          <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${pct}%`, background: color }}
            />
          </div>
        </div>

        {/* Factors */}
        <div className="space-y-2 mb-4">
          {factors.map(f => (
            <div key={f.label} className="flex items-center gap-2.5">
              {f.ok
                ? <CheckCircle className="w-4 h-4 flex-shrink-0" style={{ color: '#1D9E75' }} />
                : <AlertCircle className="w-4 h-4 flex-shrink-0" style={{ color: '#BA7517' }} />
              }
              <span className="text-xs text-gray-600">{f.label}</span>
            </div>
          ))}
        </div>

        {/* Info */}
        <p className="text-xs text-gray-400 leading-relaxed p-3 rounded-xl" style={{ background: '#F8F8F6' }}>
          Your score updates after every ride. Completing rides on time and avoiding cancellations keeps it high.
        </p>

        <div className="mt-3 flex items-center gap-1.5 justify-center">
          <TrendingUp className="w-3.5 h-3.5" style={{ color: '#7F77DD' }} />
          <span className="text-xs font-semibold" style={{ color: '#7F77DD' }}>Complete more rides to improve</span>
        </div>
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const router = useRouter();
  const { user, communities, signOut, isLoading } = useAuth();
  const [showScore, setShowScore] = useState(false);

  const initials = (user?.name ?? 'U')
    .split(' ')
    .map((w: string) => w[0] ?? '')
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const primaryCommunity = communities?.[0];
  const communityLabel = primaryCommunity
    ? `${primaryCommunity.name} ${primaryCommunity.trust_layer === 'trustcircle' ? 'TrustCircle' : primaryCommunity.trust_layer}`
    : null;

  const memberSince = user?.created_at
    ? new Date(user.created_at).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })
    : null;

  const subtitle = [primaryCommunity?.name, memberSince ? `member since ${memberSince}` : null]
    .filter(Boolean)
    .join(', ');

  const reliabilityScore = user?.reliability_score ?? 100;

  function handleLogout() {
    signOut();
    router.push('/login');
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center pb-20">
        <div className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#EEEDFE', borderTopColor: '#7F77DD' }} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24 md:pl-20">
      {/* Header */}
      <header className="bg-white px-5 pt-5 pb-4" style={{ borderBottom: '0.5px solid #E5E5E0' }}>
        <p className="text-xs font-semibold tracking-widest uppercase mb-1" style={{ color: '#7F77DD' }}>UniGo</p>
        <h1 className="text-2xl font-semibold text-gray-900">Profile</h1>
        {subtitle && <p className="text-sm text-gray-400 mt-0.5">{subtitle}</p>}
      </header>

      <div className="max-w-lg mx-auto px-4 pt-5 space-y-4">
        {/* Avatar card */}
        <div className="bg-white rounded-2xl p-6 flex flex-col items-center text-center" style={{ border: '0.5px solid #E5E5E0' }}>
          <div className="w-16 h-16 rounded-full flex items-center justify-center text-xl font-semibold text-white" style={{ background: '#7F77DD' }}>
            {initials}
          </div>
          <h2 className="mt-3 text-lg font-semibold text-gray-900">{user?.name ?? '—'}</h2>
          {communityLabel && (
            <p className="text-sm text-gray-400 mt-0.5">{communityLabel}</p>
          )}

          {/* Clickable reliability score */}
          <button
            onClick={() => setShowScore(true)}
            className="mt-3 inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-semibold transition-all hover:opacity-80 active:scale-95"
            style={{ background: '#E1F5EE', color: '#085041', border: '0.5px solid #5DCAA5' }}
          >
            <Shield className="w-3.5 h-3.5" />
            {reliabilityScore} reliability score
          </button>
        </div>

        {/* Menu card */}
        <div className="bg-white rounded-2xl" style={{ border: '0.5px solid #E5E5E0' }}>
          {/* Edit profile */}
          <Link
            href="/profile/edit"
            className="flex items-center gap-3 px-5 py-4 hover:bg-gray-50 transition-colors"
            style={{ borderBottom: '0.5px solid #F1EFE8' }}
          >
            <span className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center" style={{ background: '#EEEDFE' }}>
              <Edit3 className="w-4 h-4" style={{ color: '#7F77DD' }} />
            </span>
            <span className="flex-1 text-sm font-medium text-gray-800">Edit profile</span>
            <svg className="w-4 h-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </Link>

          {/* Emergency contacts */}
          <Link
            href="/profile/emergency"
            className="flex items-center gap-3 px-5 py-4 hover:bg-gray-50 transition-colors"
            style={{ borderBottom: '0.5px solid #F1EFE8' }}
          >
            <span className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center" style={{ background: '#FCEBEB' }}>
              <Shield className="w-4 h-4" style={{ color: '#A32D2D' }} />
            </span>
            <span className="flex-1 text-sm font-medium text-gray-800">Emergency contacts</span>
            <svg className="w-4 h-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </Link>

          {/* Log out */}
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-5 py-4 hover:bg-red-50 transition-colors rounded-b-2xl"
          >
            <span className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center" style={{ background: '#FCEBEB' }}>
              <LogOut className="w-4 h-4" style={{ color: '#A32D2D' }} />
            </span>
            <span className="flex-1 text-left text-sm font-medium" style={{ color: '#A32D2D' }}>Log out</span>
          </button>
        </div>

        {user?.email && (
          <p className="text-center text-xs text-gray-400 pb-2">{user.email}</p>
        )}
      </div>

      <RiderTabBar />

      {/* Reliability score popup */}
      {showScore && (
        <ReliabilityPopup score={reliabilityScore} onClose={() => setShowScore(false)} />
      )}
    </div>
  );
}