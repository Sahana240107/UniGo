'use client';

/**
 * src/app/admin/dashboard/AdminDriverDetail.tsx
 * Per-driver document review: approve / reject each document.
 */

import { useState } from 'react';
import { reviewDocument, PendingDriver } from '@/lib/adminService';

interface Props {
  driver: PendingDriver;
  onBack: () => void;
}

const DOC_KEYS = [
  { key: 'license' as const, label: 'Driving License', icon: '🪪' },
  { key: 'rc' as const, label: 'RC Book', icon: '📄' },
  { key: 'insurance' as const, label: 'Insurance', icon: '🛡️' },
  { key: 'puc' as const, label: 'PUC Certificate', icon: '🌿' },
];

export default function AdminDriverDetail({ driver, onBack }: Props) {
  const [docStates, setDocStates] = useState<Record<string, boolean | null>>({
    license: driver.license_verified,
    rc: driver.rc_verified,
    insurance: driver.insurance_verified,
    puc: driver.puc_verified,
  });
  const [rejectionNotes, setRejectionNotes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  const handleReview = async (docKey: typeof DOC_KEYS[number]['key'], approved: boolean) => {
    if (!approved && !rejectionNotes[docKey]?.trim()) {
      alert('Add a rejection note before rejecting.');
      return;
    }
    try {
      setLoading(docKey + (approved ? '_approve' : '_reject'));
      const res = await reviewDocument({
        driver_user_id: driver.user_id,
        doc_type: docKey,
        approved,
        rejection_note: rejectionNotes[docKey],
      });
      setDocStates((prev) => ({ ...prev, [docKey]: approved }));
      if (res.is_active) {
        setMessage(`✅ All documents approved! ${driver.name} is now active.`);
      }
    } catch (err: any) {
      alert(err?.message ?? 'Review failed.');
    } finally {
      setLoading(null);
    }
  };

  const docStatus = (key: string) => {
    const val = docStates[key];
    if (val === true) return { icon: '✅', label: 'Approved', color: '#22C55E' };
    if (val === false) return { icon: '❌', label: 'Rejected', color: '#EF4444' };
    return { icon: '⏳', label: 'Pending', color: '#F59E0B' };
  };

  return (
    <div className="min-h-screen bg-[#F8F7FF]">
      <header className="bg-white border-b border-[#E5E4F0] px-5 py-4 flex items-center gap-4 sticky top-0 z-10">
        <button onClick={onBack} className="text-[#6C63FF] font-semibold text-[17px]">‹ Back</button>
        <h1 className="text-[17px] font-bold text-[#1A1A2E] flex-1 text-center">Driver Review</h1>
        <div className="w-14" />
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 flex flex-col gap-5">
        {message && (
          <div className="bg-[#F0FDF4] border border-[#22C55E] rounded-xl px-4 py-3 text-[14px] text-[#166534] font-semibold">
            {message}
          </div>
        )}

        {/* Driver Info */}
        <section className="bg-white border border-[#E5E4F0] rounded-2xl p-5">
          <h2 className="text-[16px] font-bold text-[#1A1A2E] mb-4">👤 Driver Info</h2>
          <InfoRow label="Name" value={driver.name} />
          <InfoRow label="Phone" value={driver.phone} />
          {driver.email && <InfoRow label="Email" value={driver.email} />}
        </section>

        {/* Vehicle Info */}
        <section className="bg-white border border-[#E5E4F0] rounded-2xl p-5">
          <h2 className="text-[16px] font-bold text-[#1A1A2E] mb-4">🚘 Vehicle Info</h2>
          <InfoRow label="Number" value={driver.vehicle_number} />
          <InfoRow label="Make / Model" value={`${driver.vehicle_make ?? '-'} ${driver.vehicle_model ?? ''}`} />
          <InfoRow label="Color" value={driver.vehicle_color ?? '-'} />
          <InfoRow label="Type" value={driver.vehicle_type ?? '-'} />
          <InfoRow label="Seats" value={String(driver.seats_available_default ?? '-')} />
        </section>

        {/* Documents */}
        <section className="bg-white border border-[#E5E4F0] rounded-2xl p-5">
          <h2 className="text-[16px] font-bold text-[#1A1A2E] mb-4">📋 Documents</h2>
          <div className="flex flex-col gap-4">
            {DOC_KEYS.map(({ key, label, icon }) => {
              const status = docStatus(key);
              const isApproving = loading === key + '_approve';
              const isRejecting = loading === key + '_reject';

              return (
                <div key={key} className="bg-[#F8F7FF] border border-[#E5E4F0] rounded-xl p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-2xl">{icon}</span>
                    <span className="flex-1 text-[14px] font-bold text-[#1A1A2E]">{label}</span>
                    <span
                      className="text-[11px] font-bold px-2.5 py-1 rounded-lg"
                      style={{ color: status.color, backgroundColor: status.color + '22' }}
                    >
                      {status.label}
                    </span>
                  </div>

                  {/* Doc preview */}
                  <div className="bg-white border border-[#E5E4F0] rounded-lg px-4 py-3 text-center mb-3">
                    <p className="text-[13px] text-[#A0A0B8]">
                      {(driver as any)[`${key}_url`] ? '📎 Document attached' : '⚠️ No document uploaded'}
                    </p>
                  </div>

                  {/* Rejection note (only when not approved) */}
                  {docStates[key] !== true && (
                    <textarea
                      value={rejectionNotes[key] ?? ''}
                      onChange={(e) => setRejectionNotes((p) => ({ ...p, [key]: e.target.value }))}
                      placeholder="Rejection note (required to reject)"
                      rows={2}
                      className="w-full bg-white border-[1.5px] border-[#E5E4F0] rounded-xl px-3 py-2 text-[13px] text-[#1A1A2E] placeholder-[#A0A0B8] focus:outline-none focus:border-[#6C63FF] resize-none mb-3"
                    />
                  )}

                  <div className="flex gap-2">
                    <button
                      onClick={() => handleReview(key, true)}
                      disabled={!!loading || docStates[key] === true}
                      className="flex-1 bg-[#22C55E] text-white font-bold py-2.5 rounded-xl disabled:opacity-45 hover:bg-[#16a34a] transition-colors"
                    >
                      {isApproving ? <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : '✓ Approve'}
                    </button>
                    <button
                      onClick={() => handleReview(key, false)}
                      disabled={!!loading || docStates[key] === false}
                      className="flex-1 bg-[#EF4444] text-white font-bold py-2.5 rounded-xl disabled:opacity-45 hover:bg-[#dc2626] transition-colors"
                    >
                      {isRejecting ? <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : '✗ Reject'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </main>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center border-b border-[#F0EFF8] py-2.5 last:border-0">
      <span className="text-[13px] text-[#6B6B8A]">{label}</span>
      <span className="text-[13px] font-semibold text-[#1A1A2E] max-w-[60%] text-right">{value}</span>
    </div>
  );
}
