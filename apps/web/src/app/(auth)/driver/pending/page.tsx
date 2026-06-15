'use client';

/**
 * src/app/(auth)/driver/pending/page.tsx
 * DriverPendingReviewScreen — shown after submission until is_active=true.
 */

import { useState, useEffect } from 'react';
import { getDriverProfile } from '@/lib/driverService';
import { useAuth } from '@/context/AuthContext';

const DOC_LABELS: Record<string, string> = {
  license: 'Driving License',
  rc: 'RC Book',
  insurance: 'Insurance',
  puc: 'PUC Certificate',
};

export default function DriverPendingPage() {
  const { driverProfile, signOut } = useAuth();
  const [profile, setProfile] = useState<any>(driverProfile);
  const [refreshing, setRefreshing] = useState(false);

  const submissionState = profile?.submission_state ?? 'pending_review';
  const rejectedDocs = Object.entries({
    license: profile?.license_verified,
    rc: profile?.rc_verified,
    insurance: profile?.insurance_verified,
    puc: profile?.puc_verified,
  }).filter(([, v]) => v === false).map(([k]) => k);

  const isActionRequired = submissionState === 'action_required' || rejectedDocs.length > 0;

  const refresh = async () => {
    try {
      setRefreshing(true);
      const dp = await getDriverProfile();
      setProfile(dp);
    } catch { /* ignore */ }
    finally { setRefreshing(false); }
  };

  useEffect(() => { refresh(); }, []);

  return (
    <main className="min-h-screen bg-[#F8F7FF] flex flex-col items-center px-6 py-12">
      <div className={`w-[88px] h-[88px] rounded-full flex items-center justify-center mb-6 ${isActionRequired ? 'bg-[#FFF5F5]' : 'bg-[#EAE8FF]'}`}>
        <span className="text-5xl">{isActionRequired ? '⚠️' : '🔍'}</span>
      </div>

      <h1 className="text-2xl font-extrabold text-[#1A1A2E] text-center mb-3">
        {isActionRequired ? 'Action Required' : 'Profile Under Review'}
      </h1>
      <p className="text-[15px] text-[#6B6B8A] text-center leading-relaxed mb-8">
        {isActionRequired
          ? 'Some documents need to be re-uploaded.'
          : "Your profile is under review. You'll be notified once approved."}
      </p>

      {isActionRequired && rejectedDocs.length > 0 && (
        <div className="w-full max-w-sm bg-[#FFF5F5] border-[1.5px] border-[#EF4444] rounded-2xl p-5 mb-6">
          <p className="text-[14px] font-bold text-[#EF4444] mb-3">Documents to re-upload:</p>
          {rejectedDocs.map((doc) => (
            <div key={doc} className="flex items-center gap-2 mb-2">
              <span>❌</span>
              <span className="text-[14px] text-[#1A1A2E]">{DOC_LABELS[doc]}</span>
            </div>
          ))}
        </div>
      )}

      <div className="w-full max-w-sm bg-white border border-[#E5E4F0] rounded-2xl p-5 mb-6 flex flex-col gap-3">
        <StatusRow label="Phone" value="✅ Verified" />
        <StatusRow label="Email" value="✅ Verified" />
        {['license', 'rc', 'insurance', 'puc'].map((doc) => {
          const val = profile?.[`${doc}_verified`];
          const icon = val === true ? '✅' : val === false ? '❌' : '⏳';
          const text = val === true ? 'Approved' : val === false ? 'Rejected' : 'Pending';
          return <StatusRow key={doc} label={DOC_LABELS[doc]} value={`${icon} ${text}`} />;
        })}
      </div>

      <button
        onClick={refresh}
        disabled={refreshing}
        className="border-[1.5px] border-[#6C63FF] text-[#6C63FF] font-semibold px-8 py-3 rounded-xl mb-4 hover:bg-[#EAE8FF] transition-colors disabled:opacity-50"
      >
        {refreshing ? 'Refreshing…' : 'Refresh status'}
      </button>

      <button
        onClick={() => { if (confirm('Sign out?')) signOut(); }}
        className="text-[#A0A0B8] text-[14px] underline"
      >
        Sign out
      </button>
    </main>
  );
}

function StatusRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center border-b border-[#F0EFF8] pb-2 last:border-0 last:pb-0">
      <span className="text-[14px] text-[#6B6B8A]">{label}</span>
      <span className="text-[14px] font-semibold text-[#1A1A2E]">{value}</span>
    </div>
  );
}
