'use client';

/**
 * src/app/(auth)/rider/verify-email/page.tsx
 * RiderEmailVerifyWaiting — polls backend every 4s for email_verified.
 *
 * On success:
 *   existing user with communities  → /pulse   (dashboard)
 *   existing user without community → /community
 *   new user                        → /rider/profile (profile setup)
 */

import { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { checkRiderEmailVerified, resendRiderEmailVerification } from '@/lib/authService';
import { useAuth } from '@/context/AuthContext';

const POLL_MS = 4000;

function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get('email') ?? '';
  const { setSession } = useAuth();

  const [checking, setChecking] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [error, setError] = useState('');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mounted = useRef(true);

  const stopPolling = () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  };

  const handleVerified = useCallback(
    (result: {
      is_new_user: boolean;
      user: any;
      communities: any[];
      driver_profile: any;
      idToken: string;
      firebase_uid: string;
    }) => {
      stopPolling();
      if (!result.is_new_user && result.user) {
        setSession(result.user, result.communities, result.driver_profile);
        // Existing rider: go to dashboard if they have communities, else community setup
        if (result.communities && result.communities.length > 0) {
          router.push('/pulse');
        } else {
          router.push('/community');
        }
      } else {
        // New user → profile setup
        router.push(
          `/rider/profile?idToken=${encodeURIComponent(result.idToken)}&uid=${encodeURIComponent(result.firebase_uid)}&email=${encodeURIComponent(email)}`,
        );
      }
    },
    [email, router, setSession],
  );

  const poll = useCallback(async () => {
    if (!mounted.current) return;
    try {
      const result = await checkRiderEmailVerified(email);
      if (result.verified && mounted.current) handleVerified(result);
    } catch { /* keep polling */ }
  }, [email, handleVerified]);

  useEffect(() => {
    mounted.current = true;
    pollRef.current = setInterval(poll, POLL_MS);
    return () => { mounted.current = false; stopPolling(); };
  }, [poll]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const handleManualCheck = async () => {
    setChecking(true);
    setError('');
    try {
      const result = await checkRiderEmailVerified(email);
      if (result.verified) { handleVerified(result); }
      else { setError('Not verified yet — please click the link in your email.'); }
    } catch (err: any) {
      setError(err?.message ?? 'Could not check verification status.');
    } finally { if (mounted.current) setChecking(false); }
  };

  const handleResend = async () => {
    setResending(true);
    try {
      await resendRiderEmailVerification(email);
      setCooldown(30);
    } catch (err: any) {
      setError(err?.message ?? 'Failed to resend email.');
    } finally { if (mounted.current) setResending(false); }
  };

  return (
    <main className="min-h-screen bg-[#F8F7FF] flex flex-col px-6 py-8">
      <button onClick={() => { stopPolling(); router.back(); }} className="text-[#6C63FF] font-semibold text-[17px] mb-10 self-start">
        ‹ Back
      </button>

      <div className="flex flex-col items-center mb-10">
        <span className="text-6xl mb-4">📧</span>
        <h1 className="text-2xl font-extrabold text-[#1A1A2E] mb-3">Check your email</h1>
        <p className="text-[15px] text-[#6B6B8A] text-center leading-relaxed">
          We sent a verification link to<br />
          <span className="font-bold text-[#1A1A2E]">{email}</span>
        </p>
      </div>

      <div className="flex flex-col gap-4 mb-8">
        {[
          { n: 1, text: 'Open the email we sent you' },
          { n: 2, text: <span>Tap the <strong>Verify Email</strong> link</span> },
          { n: 3, text: "Come back here — we'll log you in automatically" },
        ].map(({ n, text }) => (
          <div key={n} className="flex items-center gap-4">
            <div className="w-7 h-7 rounded-full bg-[#6C63FF] flex items-center justify-center shrink-0">
              <span className="text-white font-bold text-sm">{n}</span>
            </div>
            <p className="text-[15px] text-[#1A1A2E]">{text}</p>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-center gap-2 mb-8">
        <div className="w-4 h-4 rounded-full border-2 border-[#6C63FF] border-t-transparent animate-spin" />
        <span className="text-[13px] text-[#6B6B8A]">Waiting for verification…</span>
      </div>

      {error && <p className="text-[#EF4444] text-[13px] mb-4 text-center">{error}</p>}

      <button
        onClick={handleManualCheck}
        disabled={checking}
        className="w-full bg-[#6C63FF] text-white font-bold py-4 rounded-xl disabled:opacity-50 hover:bg-[#4B44CC] transition-colors mb-4"
      >
        {checking ? 'Checking…' : "I've verified my email"}
      </button>

      <button
        onClick={handleResend}
        disabled={resending || cooldown > 0}
        className="w-full text-[#6C63FF] font-semibold py-3 disabled:opacity-45"
      >
        {resending ? 'Sending…' : cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend verification email'}
      </button>

      <p className="text-center text-[12px] text-[#A0A0B8] mt-5">
        Check your spam folder if you don't see the email.
      </p>
    </main>
  );
}

export default function RiderVerifyEmailPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#F8F7FF] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-[#6C63FF] border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <VerifyEmailContent />
    </Suspense>
  );
}