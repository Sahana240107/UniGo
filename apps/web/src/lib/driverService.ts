/**
 * driverService.ts — Web (Next.js) version.
 */

import { apiFetch } from './api';
import { getToken } from '../utils/storage';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

export interface VehicleInfo {
  vehicle_number: string;
  vehicle_make: string;
  vehicle_model: string;
  vehicle_color: string;
  vehicle_type: 'car' | 'bike' | 'auto';
  seats_available_default: number;
  license_number?: string;
}

export interface DriverSetupPayload {
  full_name?: string;
  vehicle?: Partial<VehicleInfo>;
}

export async function saveDriverSetup(payload: DriverSetupPayload): Promise<any> {
  const data = await apiFetch<{ driver_profile: any }>('/driver/setup', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return data.driver_profile;
}

export async function checkVehicleNumber(
  vehicle_number: string,
): Promise<{ valid: boolean; taken: boolean; message?: string }> {
  return apiFetch('/driver/check-vehicle', {
    method: 'POST',
    body: JSON.stringify({ vehicle_number }),
  });
}

/** Upload a document using a File object from <input type="file"> */
export async function uploadDriverDocument(params: {
  doc_type: 'license' | 'rc' | 'insurance' | 'puc';
  file: File;
}): Promise<{ driver_profile: any }> {
  const token = getToken();

  const formData = new FormData();
  formData.append('file', params.file);
  formData.append('doc_type', params.doc_type);

  const res = await fetch(`${API_BASE}/driver/upload-document`, {
    method: 'POST',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail ?? 'Upload failed');
  }
  return res.json();
}

export async function submitDriverForReview(): Promise<{ driver_profile: any }> {
  return apiFetch('/driver/submit-review', {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export async function getDriverProfile(): Promise<any> {
  return apiFetch('/driver/profile');
}

export async function reuploadDocument(
  doc_type: 'license' | 'rc' | 'insurance' | 'puc',
  file: File,
): Promise<{ driver_profile: any }> {
  return uploadDriverDocument({ doc_type, file });
}
