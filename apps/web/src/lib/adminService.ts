/**
 * adminService.ts — Web (Next.js) version.
 */

import { apiFetch } from './api';

export interface PendingDriver {
  user_id: string;
  name: string;
  phone: string;
  email?: string;
  vehicle_number: string;
  vehicle_make?: string;
  vehicle_model?: string;
  vehicle_color?: string;
  vehicle_type?: string;
  seats_available_default?: number;
  license_verified: boolean | null;
  rc_verified: boolean | null;
  insurance_verified: boolean | null;
  puc_verified: boolean | null;
  license_url?: string;
  rc_url?: string;
  insurance_url?: string;
  puc_url?: string;
  submission_state: string;
  created_at: string;
}

export async function getPendingDrivers(): Promise<PendingDriver[]> {
  const res = await apiFetch<{ drivers: PendingDriver[] }>('/admin/pending-drivers');
  return res.drivers;
}

export async function getDriverDetail(user_id: string): Promise<PendingDriver> {
  const res = await apiFetch<{ driver: PendingDriver }>(`/admin/driver/${user_id}`);
  return res.driver;
}

export async function reviewDocument(params: {
  driver_user_id: string;
  doc_type: 'license' | 'rc' | 'insurance' | 'puc';
  approved: boolean;
  rejection_note?: string;
}): Promise<{ driver_profile: any; is_active: boolean }> {
  return apiFetch('/admin/review-document', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export async function setDriverActive(driver_user_id: string, is_active: boolean): Promise<void> {
  await apiFetch('/admin/set-driver-active', {
    method: 'POST',
    body: JSON.stringify({ driver_user_id, is_active }),
  });
}
