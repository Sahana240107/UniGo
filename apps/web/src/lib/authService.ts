/**
 * authService.ts — Web (Next.js) version.
 *
 * All auth is handled server-side. No Firebase client SDK.
 *
 * Flows:
 *  RIDER:  sendRiderEmailVerification → checkRiderEmailVerified (poll)
 *          → completeRiderProfile
 *  DRIVER: sendDriverEmailVerification → checkDriverEmailVerified (poll)
 *          → DriverSetup (createDriverAccount via /auth/verify)
 *  ADMIN:  adminLogin (email + password from DB)
 */

import { apiFetch } from './api';
import { saveSession, getToken, clearSession } from '../utils/storage';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

// ─── Rider email verification ─────────────────────────────────────────────────

export async function sendRiderEmailVerification(email: string): Promise<void> {
  await apiFetch('/auth/rider/send-email-verification', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export interface RiderEmailVerifyResult {
  verified: boolean;
  is_new_user: boolean;
  idToken: string;
  firebase_uid: string;
  user: any | null;
  communities: any[];
  driver_profile: any | null;
}

export async function checkRiderEmailVerified(email: string): Promise<RiderEmailVerifyResult> {
  const res = await apiFetch('/auth/rider/check-email-verified', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });

  const idToken: string = res.custom_token ?? res.idToken ?? '';
  const firebase_uid: string = res.firebase_uid ?? '';

  const result: RiderEmailVerifyResult = {
    verified: res.verified,
    is_new_user: res.is_new_user,
    idToken,
    firebase_uid,
    user: res.user ?? null,
    communities: res.communities ?? [],
    driver_profile: res.driver_profile ?? null,
  };

  if (result.verified && !result.is_new_user && result.user) {
    saveSession(idToken, result.user, result.communities, result.driver_profile);
  }

  return result;
}

export async function resendRiderEmailVerification(email: string): Promise<void> {
  await apiFetch('/auth/rider/send-email-verification', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

// ─── Rider profile setup ──────────────────────────────────────────────────────

export async function completeRiderProfile(params: {
  idToken: string;
  firebase_uid: string;
  name: string;
  email: string;
  gender: string;
}): Promise<{ user: any; communities: any[] }> {
  saveSession(params.idToken, {}, [], null);

  const data = await apiFetch('/auth/rider/complete-profile', {
    method: 'POST',
    body: JSON.stringify({
      firebase_uid: params.firebase_uid,
      custom_token: params.idToken,
      name: params.name,
      email: params.email,
      gender: params.gender,
    }),
  });

  saveSession(params.idToken, data.user, data.communities, null);
  return data;
}

// ─── Driver email verification ────────────────────────────────────────────────

export async function sendDriverEmailVerification(email: string): Promise<void> {
  await apiFetch('/auth/driver/send-email-verification', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export interface DriverEmailVerifyResult {
  verified: boolean;
  is_new_user: boolean;
  idToken: string;
  firebase_uid: string;
  user: any | null;
  communities: any[];
  driver_profile: any | null;
}

export async function checkDriverEmailVerified(email: string): Promise<DriverEmailVerifyResult> {
  const res = await apiFetch('/auth/driver/check-email-verified', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });

  const idToken: string = res.custom_token ?? res.idToken ?? '';
  const firebase_uid: string = res.firebase_uid ?? '';

  const result: DriverEmailVerifyResult = {
    verified: res.verified,
    is_new_user: res.is_new_user,
    idToken,
    firebase_uid,
    user: res.user ?? null,
    communities: res.communities ?? [],
    driver_profile: res.driver_profile ?? null,
  };

  if (result.verified && !result.is_new_user && result.user) {
    saveSession(idToken, result.user, result.communities, result.driver_profile);
  }

  return result;
}

export async function resendDriverEmailVerification(email: string): Promise<void> {
  await apiFetch('/auth/driver/send-email-verification', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

// ─── Driver account creation ──────────────────────────────────────────────────

export async function createDriverAccount(params: {
  idToken: string;
  firebase_uid: string;
  name: string;
  gender: string;
  email: string;
  phone?: string;
}): Promise<{ user: any; communities: any[]; driver_profile: any }> {
  saveSession(params.idToken, {}, [], null);

  const data = await apiFetch('/auth/verify', {
    method: 'POST',
    headers: { Authorization: `Bearer ${params.idToken}` },
    body: JSON.stringify({
      firebase_uid: params.firebase_uid,
      name: params.name,
      gender: params.gender,
      email: params.email,
      phone: params.phone,
      role: 'driver',
    }),
  });

  saveSession(params.idToken, data.user, data.communities, data.driver_profile);
  return data;
}

// ─── Admin email + password login ─────────────────────────────────────────────

export interface AdminLoginResult {
  idToken: string;
  firebase_uid?: string;
  is_new_user: boolean;
  user: any;
  communities: any[];
  driver_profile: any | null;
  is_admin: boolean;
}

export async function adminLogin(email: string, password: string): Promise<AdminLoginResult> {
  const res = await apiFetch('/auth/admin/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });

  const idToken: string = res.custom_token ?? res.idToken ?? '';

  if (res.user) {
    saveSession(idToken, res.user, res.communities ?? [], res.driver_profile ?? null);
  }

  return {
    idToken,
    firebase_uid: res.user?.firebase_uid,
    is_new_user: res.is_new_user ?? false,
    user: res.user,
    communities: res.communities ?? [],
    driver_profile: res.driver_profile ?? null,
    is_admin: res.is_admin ?? false,
  };
}

// ─── Session restore ──────────────────────────────────────────────────────────

export async function restoreSession(): Promise<{
  user: any;
  communities: any[];
  driverProfile: any | null;
} | null> {
  const token = getToken();
  if (!token) return null;
  try {
    const data = await apiFetch('/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
    });
    saveSession(token, data.user, data.communities, data.driver_profile ?? null);
    return { user: data.user, communities: data.communities, driverProfile: data.driver_profile };
  } catch {
    clearSession();
    return null;
  }
}

// ─── Sign out ─────────────────────────────────────────────────────────────────

export function signOut(): void {
  clearSession();
}
