'use client';

/**
 * src/app/profile/edit/page.tsx
 *
 * Edit Profile page — saves name, gender, phone, emergency contact to Supabase.
 * Supports #emergency hash to auto-scroll to emergency section.
 * Has RiderTabBar at bottom.
 */

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Check } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { saveSession, getToken } from '@/utils/storage';
import RiderTabBar from '@/components/layout/rider-tab-bar';

const GENDERS = ['male', 'female', 'other'] as const;
type Gender = typeof GENDERS[number];

export default function EditProfilePage() {
  const router = useRouter();
  const { user, communities, driverProfile, setSession } = useAuth();
  const supabase = createSupabaseBrowserClient();
  const emergencyRef = useRef<HTMLElement>(null);

  const [name,    setName]    = useState(user?.name   ?? '');
  const [gender,  setGender]  = useState<Gender>((user?.gender as Gender) ?? 'other');
  const [phone,   setPhone]   = useState(user?.phone  ?? '');
  const [ecName,  setEcName]  = useState(user?.emergency_contact_name  ?? '');
  const [ecPhone, setEcPhone] = useState(user?.emergency_contact_phone ?? '');
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState('');
  const [saved,   setSaved]   = useState(false);

  // Sync state when user loads from context
  useEffect(() => {
    if (user) {
      setName(user.name ?? '');
      setGender((user.gender as Gender) ?? 'other');
      setPhone(user.phone ?? '');
      setEcName(user.emergency_contact_name ?? '');
      setEcPhone(user.emergency_contact_phone ?? '');
    }
  }, [user?.id]);

  // Auto-scroll if #emergency in URL
  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.hash === '#emergency') {
      setTimeout(() => emergencyRef.current?.scrollIntoView({ behavior: 'smooth' }), 200);
    }
  }, []);

  const initials = (name || 'U')
    .split(' ')
   .map((w: string) => w[0] ?? '')
    .join('')
    .toUpperCase()
    .slice(0, 2);

  async function handleSave() {
    setError('');
    setSaved(false);
    if (!name.trim()) { setError('Name is required.'); return; }
    if (!user?.id)    { setError('Session not found — please log in again.'); return; }

    setSaving(true);
    try {
      const updates: Record<string, string | null> = {
        name:                    name.trim(),
        gender,
        emergency_contact_name:  ecName.trim()  || null,
        emergency_contact_phone: ecPhone.trim() || null,
      };
      if (phone.trim() && phone.trim() !== user.phone) {
        updates.phone = phone.trim();
      }

      const { data, error: sbErr } = await supabase
        .from('users')
        .update(updates)
        .eq('id', user.id)
        .select('*')
        .single();

      if (sbErr) throw sbErr;

      const updatedUser = { ...user, ...data };
      setSession(updatedUser, communities, driverProfile);
      saveSession(getToken() ?? '', updatedUser, communities, driverProfile);

      setSaved(true);
      setTimeout(() => router.back(), 1200);
    } catch (e: unknown) {
      const msg = (e as { message?: string })?.message ?? 'Something went wrong.';
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 md:pl-20">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="text-[#7F77DD] flex items-center gap-0.5 font-semibold hover:opacity-70 transition"
        >
          <ChevronLeft className="h-5 w-5" />
          Back
        </button>
        <h1 className="flex-1 text-center font-bold text-gray-900 pr-16">Edit Profile</h1>
      </header>

      <div className="max-w-lg mx-auto px-4 pb-32 pt-6 space-y-4">

        {/* Avatar */}
        <div className="flex justify-center mb-2">
          <div className="w-20 h-20 rounded-full bg-[#7F77DD] flex items-center justify-center shadow-md">
            <span className="text-3xl font-extrabold text-white leading-none">{initials}</span>
          </div>
        </div>

        {/* Basic info */}
        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
          <p className="text-[10px] font-extrabold text-gray-400 tracking-widest uppercase">
            Basic Info
          </p>

          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">Full name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your full name"
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900
                         focus:outline-none focus:border-[#7F77DD] focus:ring-1 focus:ring-[#7F77DD]/30 transition"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-2">Gender</label>
            <div className="flex gap-2">
              {GENDERS.map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setGender(g)}
                  className={[
                    'flex-1 py-2 rounded-xl border-2 text-sm font-medium transition',
                    gender === g
                      ? 'bg-[#F9F7FF] border-[#7F77DD] text-[#3C3489] font-bold'
                      : 'bg-gray-50 border-gray-200 text-gray-500 hover:border-gray-300',
                  ].join(' ')}
                >
                  {g.charAt(0).toUpperCase() + g.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">Phone number</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+91 9XXXXXXXXX"
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900
                         focus:outline-none focus:border-[#7F77DD] focus:ring-1 focus:ring-[#7F77DD]/30 transition"
            />
          </div>
        </section>

        {/* Emergency contact */}
        <section ref={emergencyRef} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
          <div>
            <p className="text-[10px] font-extrabold text-gray-400 tracking-widest uppercase">
              Emergency Contact
            </p>
            <p className="text-xs text-gray-400 mt-1 leading-relaxed">
              This person will be notified if you trigger an SOS alert.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">Contact name</label>
            <input
              type="text"
              value={ecName}
              onChange={(e) => setEcName(e.target.value)}
              placeholder="e.g. Mom, Dad, Partner"
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900
                         focus:outline-none focus:border-[#7F77DD] focus:ring-1 focus:ring-[#7F77DD]/30 transition"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">Contact phone</label>
            <input
              type="tel"
              value={ecPhone}
              onChange={(e) => setEcPhone(e.target.value)}
              placeholder="+91 9XXXXXXXXX"
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900
                         focus:outline-none focus:border-[#7F77DD] focus:ring-1 focus:ring-[#7F77DD]/30 transition"
            />
          </div>
        </section>

        {/* Feedback */}
        {error && (
          <p className="text-sm text-red-500 text-center bg-red-50 rounded-xl py-2 px-4">{error}</p>
        )}
        {saved && (
          <div className="flex items-center justify-center gap-2 text-sm text-emerald-600 font-semibold bg-emerald-50 rounded-xl py-2 px-4">
            <Check className="w-4 h-4" />
            Profile saved!
          </div>
        )}

        {/* Save button */}
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="w-full bg-[#7F77DD] text-white font-bold py-4 rounded-2xl
                     hover:bg-[#534AB7] active:scale-[0.98] transition-all disabled:opacity-60 shadow-sm"
        >
          {saving ? 'Saving…' : 'Save changes'}
        </button>
      </div>

      <RiderTabBar />
    </div>
  );
}
