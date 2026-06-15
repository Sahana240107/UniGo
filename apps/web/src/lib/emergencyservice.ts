/**
 * src/lib/emergencyService.ts
 *
 * Thin typed wrappers around the /emergency/* FastAPI endpoints.
 * Replaces the mobile emergencyService.ts stub.
 *
 * All calls go through apiFetch() which automatically attaches
 * the Bearer token from localStorage.
 */

import { apiFetch } from '@/lib/api';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SOSTriggerPayload {
  user_id: string;
  ride_id?: string;
  lat: number;
  lng: number;
}

export interface SOSTriggerResult {
  log_id: string;
  off_code: string;
  message: string;
}

export interface SOSLocationUpdatePayload {
  log_id: string;
  user_id: string;
  lat: number;
  lng: number;
}

export interface SOSDeactivatePayload {
  log_id: string;
  user_id: string;
  off_code: string;
}

export interface ActiveSOSResult {
  active: boolean;
  log: {
    id: string;
    lat: number;
    lng: number;
    triggered_at: string;
    off_code: string;
  } | null;
}

// ─── API calls ────────────────────────────────────────────────────────────────

/** Trigger SOS — inserts log, notifies emergency contact, returns off_code */
export function triggerSOS(payload: SOSTriggerPayload): Promise<SOSTriggerResult> {
  return apiFetch<SOSTriggerResult>('/emergency/trigger', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/** Push updated lat/lng to backend while SOS is active (call every ~30 s) */
export function updateSOSLocation(payload: SOSLocationUpdatePayload): Promise<{ success: boolean; maps_url: string }> {
  return apiFetch('/emergency/location-update', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/** Validate off_code and mark the SOS log inactive */
export function deactivateSOS(payload: SOSDeactivatePayload): Promise<{ success: boolean; message: string }> {
  return apiFetch('/emergency/deactivate', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/** Check if the user has an active SOS session (used on page reload) */
export function getActiveSOS(userId: string): Promise<ActiveSOSResult> {
  return apiFetch<ActiveSOSResult>(`/emergency/active/${userId}`);
}