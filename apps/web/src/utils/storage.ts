/**
 * storage.ts — Web session helpers using localStorage.
 * Mirrors the mobile Storage util but synchronous (no AsyncStorage).
 */

const TOKEN_KEY = 'unigo_token';
const USER_KEY = 'unigo_user';
const COMMUNITIES_KEY = 'unigo_communities';
const DRIVER_PROFILE_KEY = 'unigo_driver_profile';

export function saveSession(
  token: string,
  user: any,
  communities: any[],
  driverProfile: any | null,
): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  localStorage.setItem(COMMUNITIES_KEY, JSON.stringify(communities));
  localStorage.setItem(DRIVER_PROFILE_KEY, JSON.stringify(driverProfile));
}

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function getUser(): any | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export function getCommunities(): any[] {
  if (typeof window === 'undefined') return [];
  const raw = localStorage.getItem(COMMUNITIES_KEY);
  if (!raw) return [];
  try { return JSON.parse(raw); } catch { return []; }
}

export function getDriverProfile(): any | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(DRIVER_PROFILE_KEY);
  if (!raw || raw === 'null') return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export function clearSession(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(COMMUNITIES_KEY);
  localStorage.removeItem(DRIVER_PROFILE_KEY);
}
