'use client';

/**
 * src/app/(auth)/driver/email/page.tsx
 * DriverEmailEntryScreen — sends driver verification email.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { sendDriverEmailVerification } from '@/lib/authService';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function DriverEmailPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isValid = EMAIL_RE.test(email.trim());

  const handleSend = async () => {
    if (!isValid) return;
    setLoading(true);
    setError('');
    try {
      await sendDriverEmailVerification(email.trim().toLowerCase());
      router.push(`/driver/verify-email?email=${encodeURIComponent(email.trim().toLowerCase())}`);
    } catch (err: any) {
      setError(err?.message ?? 'Failed to send verification email.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#F8F7FF] flex flex-col px-6 py-8">
      <Link href="/login" className="text-[#6C63FF] font-semibold text-[17px] mb-10 self-start">
        ‹ Back
      </Link>

      <div className="flex flex-col items-center mb-10">
        <span className="text-6xl mb-4">🏎️</span>
        <h1 className="text-2xl font-extrabold text-[#1A1A2E] mb-2">Continue as Driver</h1>
        <p className="text-[15px] text-[#6B6B8A] text-center">Enter your email to get started</p>
      </div>

      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && handleSend()}
        placeholder="you@example.com"
        autoFocus
        className="w-full bg-white border-[1.5px] border-[#E5E4F0] rounded-xl px-4 py-4 text-[16px] text-[#1A1A2E] placeholder-[#A0A0B8] focus:outline-none focus:border-[#6C63FF] mb-6"
      />

      {error && <p className="text-[#EF4444] text-[13px] mb-4">{error}</p>}

      <button
        onClick={handleSend}
        disabled={!isValid || loading}
        className="w-full bg-[#6C63FF] text-white font-bold py-4 rounded-xl disabled:opacity-50 hover:bg-[#4B44CC] transition-colors"
      >
        {loading ? 'Sending…' : 'Send Verification Email'}
      </button>

      <p className="text-center text-[13px] text-[#A0A0B8] mt-5 leading-relaxed">
        We'll send a verification link to your email. No SMS charges.
      </p>
    </main>
  );
}
