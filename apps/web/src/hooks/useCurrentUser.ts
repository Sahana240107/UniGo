'use client';

import { useState, useEffect, useCallback } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

const supabase = createSupabaseBrowserClient();

export const RELATIONSHIPS = [
  'Mother', 'Father', 'Sister', 'Brother',
  'Friend', 'Spouse', 'Roommate', 'Other',
];

const SEPARATOR = '||';

export function encodeContact(name: string, relationship: string) {
  return `${name.trim()}${SEPARATOR}${relationship.trim()}`;
}

export function decodeContact(raw: string): { name: string; relationship: string } {
  if (raw.includes(SEPARATOR)) {
    const idx = raw.indexOf(SEPARATOR);
    return { name: raw.slice(0, idx), relationship: raw.slice(idx + SEPARATOR.length) };
  }
  return { name: raw, relationship: '' };
}

export interface SavedContact {
  name: string;
  phone: string;
  relationship: string;
  alertCount: number;
}

export function useEmergencyContact(userId: string | null) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [saved, setSaved] = useState<SavedContact | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const fetchContact = useCallback(async () => {
    if (!userId) { setLoading(false); return; }
    try {
      const { data, error: fetchErr } = await supabase
        .from('users')
        .select('emergency_contact_name, emergency_contact_phone')
        .eq('id', userId)
        .single();

      if (fetchErr) throw fetchErr;

      if (data?.emergency_contact_name && data?.emergency_contact_phone) {
        const { name: n, relationship: r } = decodeContact(data.emergency_contact_name);

        // Fetch alert count separately
        const { count } = await supabase
          .from('emergency_logs')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId);

        setSaved({
          name: n,
          phone: data.emergency_contact_phone,
          relationship: r,
          alertCount: count ?? 0,
        });
      } else {
        setSaved(null);
      }
    } catch (err) {
      console.error('EmergencyContact fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { fetchContact(); }, [fetchContact]);

  // Supabase Realtime — auto-refresh on DB changes
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`ec_${userId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'emergency_logs',
        filter: `user_id=eq.${userId}`,
      }, fetchContact)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'users',
        filter: `id=eq.${userId}`,
      }, fetchContact)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [userId, fetchContact]);

  /** Returns true on success, false on failure */
  const saveContact = useCallback(async (
    name: string,
    phone: string,
    relationship: string,
  ): Promise<boolean> => {
    if (!userId) { setSaveError('Not logged in'); return false; }
    setSaving(true);
    setSaveError(null);
    try {
      const storeName = encodeContact(name, relationship);
      const { error: saveErr } = await supabase
        .from('users')
        .update({
          emergency_contact_name: storeName,
          emergency_contact_phone: phone.replace(/\D/g, ''),
        })
        .eq('id', userId);

      if (saveErr) throw saveErr;

      // Optimistic update — realtime will confirm
      setSaved({
        name: name.trim(),
        phone: phone.replace(/\D/g, ''),
        relationship: relationship.trim(),
        alertCount: saved?.alertCount ?? 0,
      });
      // Also re-fetch to be sure
      fetchContact();
      return true;
    } catch (err: any) {
      setSaveError(err?.message ?? 'Could not save. Please try again.');
      return false;
    } finally {
      setSaving(false);
    }
  }, [userId, saved?.alertCount, fetchContact]);

  const removeContact = useCallback(async (): Promise<boolean> => {
    if (!userId) return false;
    setRemoving(true);
    setSaveError(null);
    try {
      const { error: removeErr } = await supabase
        .from('users')
        .update({ emergency_contact_name: null, emergency_contact_phone: null })
        .eq('id', userId);

      if (removeErr) throw removeErr;
      setSaved(null);
      return true;
    } catch (err: any) {
      setSaveError(err?.message ?? 'Could not remove. Try again.');
      return false;
    } finally {
      setRemoving(false);
    }
  }, [userId]);

  return {
    loading,
    saving,
    removing,
    saved,
    saveError,
    fetchContact,
    saveContact,
    removeContact,
  };
}