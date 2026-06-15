/**
 * api.ts — thin fetch wrapper for Next.js web client.
 * Automatically attaches the stored token as Bearer header.
 */

import { getToken } from '../utils/storage';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

export async function apiFetch<T = any>(
  path: string,
  options: RequestInit & { headers?: Record<string, string> } = {},
): Promise<T> {
  const token = getToken();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers ?? {}),
  };

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  const data = await res.json();

  if (!res.ok) {
    const message =
      typeof data?.detail === 'string'
        ? data.detail
        : data?.message ?? `Request failed (${res.status})`;
    throw new Error(message);
  }

  return data as T;
}
