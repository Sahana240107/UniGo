'use client';

/**
 * src/app/admin/dashboard/page.tsx
 * AdminDashboardScreen — lists pending drivers.
 */

import { useState, useEffect, useCallback } from 'react';
import { getPendingDrivers, PendingDriver } from '@/lib/adminService';
import { useAuth } from '@/context/AuthContext';
import AdminDriverDetail from './AdminDriverDetail';

function stateColor(state: string) {
  if (state === 'pending_review') return '#F59E0B';
  if (state === 'action_required') return '#EF4444';
  if (state === 'active') return '#22C55E';
  return '#A0A0B8';
}

export default function AdminDashboardPage() {
  const { signOut } = useAuth();
  const [drivers, setDrivers] = useState<PendingDriver[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<PendingDriver | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await getPendingDrivers();
      setDrivers(data);
    } catch (err: any) {
      alert(err?.message ?? 'Failed to load drivers.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (selected) {
    return <AdminDriverDetail driver={selected} onBack={() => { setSelected(null); load(); }} />;
  }

  return (
    <div className="min-h-screen bg-[#F8F7FF]">
      {/* Header */}
      <header className="bg-white border-b border-[#E5E4F0] px-5 py-4 flex justify-between items-center sticky top-0 z-10">
        <div>
          <h1 className="text-xl font-extrabold text-[#1A1A2E]">Admin Dashboard</h1>
          <p className="text-[13px] text-[#A0A0B8]">{drivers.length} pending review</p>
        </div>
        <button
          onClick={() => { if (confirm('Sign out?')) signOut(); }}
          className="border border-[#E5E4F0] text-[#6B6B8A] font-semibold text-[13px] px-4 py-2 rounded-xl hover:bg-[#F8F7FF] transition-colors"
        >
          Sign out
        </button>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6">
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-2 border-[#6C63FF] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : drivers.length === 0 ? (
          <div className="flex flex-col items-center py-20 gap-3">
            <span className="text-5xl">🎉</span>
            <p className="text-[18px] font-bold text-[#1A1A2E]">No pending applications</p>
            <p className="text-[14px] text-[#A0A0B8]">All drivers have been reviewed.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {drivers.map((driver) => (
              <button
                key={driver.user_id}
                onClick={() => setSelected(driver)}
                className="w-full bg-white border border-[#E5E4F0] rounded-2xl p-4 text-left hover:shadow-md transition-shadow"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-11 h-11 rounded-full bg-[#6C63FF] flex items-center justify-center shrink-0">
                    <span className="text-white font-bold text-lg">{driver.name?.[0]?.toUpperCase() ?? '?'}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[15px] font-bold text-[#1A1A2E] truncate">{driver.name}</p>
                    <p className="text-[13px] text-[#6B6B8A]">{driver.phone}</p>
                    <p className="text-[12px] text-[#A0A0B8] truncate">{driver.vehicle_number} · {driver.vehicle_make} {driver.vehicle_model}</p>
                  </div>
                  <span
                    className="text-[11px] font-bold uppercase px-2.5 py-1 rounded-lg shrink-0"
                    style={{ color: stateColor(driver.submission_state), backgroundColor: stateColor(driver.submission_state) + '22' }}
                  >
                    {driver.submission_state === 'pending_review' ? 'Pending' : driver.submission_state === 'action_required' ? 'Action' : driver.submission_state}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {(['license', 'rc', 'insurance', 'puc'] as const).map((doc) => {
                    const val = driver[`${doc}_verified` as keyof PendingDriver] as boolean | null;
                    return <span key={doc} className="text-lg">{val === true ? '✅' : val === false ? '❌' : '⏳'}</span>;
                  })}
                  <span className="text-[12px] text-[#A0A0B8] ml-auto">Tap to review →</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
