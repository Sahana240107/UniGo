'use client';

/**
 * src/app/(auth)/admin/login/page.tsx
 * AdminSignInScreen — email + password login.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { adminLogin } from '@/lib/authService';
import { useAuth } from '@/context/AuthContext';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function AdminLoginPage() {
  const router = useRouter();
  const { setSession } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isValid = EMAIL_RE.test(email.trim()) && password.length > 0;

  const handleLogin = async () => {
    if (!isValid) return;
    setLoading(true);
    setError('');
    try {
      const result = await adminLogin(email.trim().toLowerCase(), password);
      if (!result.is_admin || !result.user) {
        setError('This account is not an admin.');
        return;
      }
      setSession(result.user, result.communities, result.driver_profile);
      router.push('/admin/dashboard');
    } catch (err: any) {
      setError(err?.message ?? 'Invalid email or password.');
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
        <div className="w-[72px] h-[72px] rounded-full bg-[#1A1A2E] flex items-center justify-center mb-4">
          <span className="text-3xl">🔐</span>
        </div>
        <h1 className="text-2xl font-extrabold text-[#1A1A2E] mb-2">Admin Sign In</h1>
        <p className="text-[14px] text-[#6B6B8A] text-center">Restricted access. Sign in with your admin credentials.</p>
      </div>

      <label className="text-[12px] font-semibold text-[#6B6B8A] uppercase tracking-wide mb-2">Email</label>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
        placeholder="admin@unigo.app"
        autoFocus
        autoComplete="username"
        className="w-full bg-white border-[1.5px] border-[#E5E4F0] rounded-xl px-4 py-4 text-[16px] text-[#1A1A2E] placeholder-[#A0A0B8] focus:outline-none focus:border-[#1A1A2E] mb-5"
      />

      <label className="text-[12px] font-semibold text-[#6B6B8A] uppercase tracking-wide mb-2">Password</label>
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
        placeholder="••••••••"
        autoComplete="current-password"
        className="w-full bg-white border-[1.5px] border-[#E5E4F0] rounded-xl px-4 py-4 text-[16px] text-[#1A1A2E] placeholder-[#A0A0B8] focus:outline-none focus:border-[#1A1A2E] mb-6"
      />

      {error && <p className="text-[#EF4444] text-[13px] mb-4">{error}</p>}

      <button
        onClick={handleLogin}
        disabled={!isValid || loading}
        className="w-full bg-[#1A1A2E] text-white font-bold py-4 rounded-xl disabled:opacity-50 hover:bg-[#2D2D45] transition-colors mb-auto"
      >
        {loading ? 'Signing in…' : 'Sign In'}
      </button>

      <div className="mt-auto bg-[#FFF9E6] border border-[#F59E0B] rounded-xl p-3">
        <p className="text-[12px] text-[#B45309] text-center font-semibold">
          ⚠️ Unauthorized access attempts are logged.
        </p>
      </div>
    </main>
  );
}
