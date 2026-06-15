'use client';

/**
 * src/app/safety/page.tsx
 *
 * Full SOS flow (web port of SOSScreen.tsx):
 *  1. User clicks big red SOS button → POST /emergency/trigger → off_code returned
 *  2. Browser Geolocation polled every 30 s → POST /emergency/location-update
 *  3. "Stop SOS" opens modal → user enters 6-digit off_code → POST /emergency/deactivate
 *  4. On page reload, GET /emergency/active/:userId restores active state
 *
 * Replaces:  SOSScreen.tsx  (Expo / React Native)
 * Stack:     Next.js 14 App Router + Tailwind CSS
 * Auth:      useAuth() from src/context/AuthContext.tsx (already web-ready)
 * API:       apiFetch() from src/lib/api.ts (already web-ready)
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { AlertTriangle, MapPin, Phone, Shield, X } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { apiFetch } from '@/lib/api';

// ─── Types ────────────────────────────────────────────────────────────────────

interface SOSState {
  active: boolean;
  logId: string | null;
  offCode: string | null;
  lat: number | null;
  lng: number | null;
  lastUpdate: Date | null;
}

const EMPTY: SOSState = {
  active: false,
  logId: null,
  offCode: null,
  lat: null,
  lng: null,
  lastUpdate: null,
};

const LOCATION_INTERVAL_MS = 30_000;

// ─── Component ────────────────────────────────────────────────────────────────

export default function SafetyPage() {
  const { user } = useAuth();

  const [sos, setSos]               = useState<SOSState>(EMPTY);
  const [triggering, setTriggering] = useState(false);
  const [deactivating, setDeactivating] = useState(false);
  const [showModal, setShowModal]   = useState(false);
  const [enteredCode, setEnteredCode] = useState('');
  const [codeError, setCodeError]   = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [geoAllowed, setGeoAllowed] = useState(false);
  const [banner, setBanner]         = useState<string | null>(null);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Check geolocation permission ─────────────────────────────────────────
  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.permissions?.query({ name: 'geolocation' }).then((r) => {
      setGeoAllowed(r.state === 'granted');
      r.onchange = () => setGeoAllowed(r.state === 'granted');
    });
  }, []);

  // ── Resume active SOS on mount (page reload recovery) ────────────────────
  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      try {
        const data = await apiFetch<{ active: boolean; log: any }>(`/emergency/active/${user.id}`);
        if (data.active && data.log) {
          const pos = await getCurrentLocation().catch(() => null);
          setSos({
            active: true,
            logId: data.log.id,
            offCode: data.log.off_code,
            lat: pos?.coords.latitude  ?? data.log.lat,
            lng: pos?.coords.longitude ?? data.log.lng,
            lastUpdate: new Date(),
          });
        }
      } catch {
        // Fresh state is fine
      }
    })();
  }, [user?.id]);

  // ── Start / stop location polling ─────────────────────────────────────────
  useEffect(() => {
    if (sos.active && sos.logId) startTracking();
    else stopTracking();
    return stopTracking;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sos.active, sos.logId]);

  // ── Helpers ───────────────────────────────────────────────────────────────

  const getCurrentLocation = (): Promise<GeolocationPosition> =>
    new Promise((resolve, reject) =>
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 10_000,
      }),
    );

  const startTracking = useCallback(() => {
    if (intervalRef.current) return; // already running
    intervalRef.current = setInterval(async () => {
      if (!sos.logId || !user?.id) return;
      try {
        const pos = await getCurrentLocation();
        const { latitude, longitude } = pos.coords;
        setSos((prev) => ({ ...prev, lat: latitude, lng: longitude, lastUpdate: new Date() }));
        await apiFetch('/emergency/location-update', {
          method: 'POST',
          body: JSON.stringify({ log_id: sos.logId, user_id: user.id, lat: latitude, lng: longitude }),
        });
      } catch {
        console.warn('[SOS] location-update failed');
      }
    }, LOCATION_INTERVAL_MS);
  }, [sos.logId, user?.id]);

  const stopTracking = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  const showBanner = (msg: string) => {
    setBanner(msg);
    setTimeout(() => setBanner(null), 4000);
  };

  // ── Trigger SOS ───────────────────────────────────────────────────────────

  const doTriggerSOS = async () => {
    setConfirmOpen(false);
    setTriggering(true);
    try {
      let pos: GeolocationPosition | null = null;
      try { pos = await getCurrentLocation(); } catch { /* no location */ }
      if (!pos) {
        showBanner('Could not get your location. Please allow location access and try again.');
        return;
      }
      const { latitude, longitude } = pos.coords;
      const data = await apiFetch<{ log_id: string; off_code: string; message: string }>(
        '/emergency/trigger',
        {
          method: 'POST',
          body: JSON.stringify({ user_id: user!.id, lat: latitude, lng: longitude }),
        },
      );
      setSos({ active: true, logId: data.log_id, offCode: data.off_code, lat: latitude, lng: longitude, lastUpdate: new Date() });
    } catch (e: any) {
      showBanner(e?.message ?? 'Could not activate SOS. Please try again.');
    } finally {
      setTriggering(false);
    }
  };

  // ── Deactivate SOS ────────────────────────────────────────────────────────

  const handleDeactivate = async () => {
    if (enteredCode.length !== 6) { setCodeError('Enter the full 6-digit code.'); return; }
    if (enteredCode !== sos.offCode) { setCodeError('Incorrect code. Check the code shown when SOS was activated.'); return; }

    setDeactivating(true);
    try {
      await apiFetch('/emergency/deactivate', {
        method: 'POST',
        body: JSON.stringify({ log_id: sos.logId, user_id: user!.id, off_code: enteredCode }),
      });
      setShowModal(false);
      setSos(EMPTY);
      showBanner('✅ SOS stopped. Your emergency contact has been notified you are safe.');
    } catch (e: any) {
      setCodeError(e?.message ?? 'Deactivation failed. Please try again.');
    } finally {
      setDeactivating(false);
    }
  };

  // ── Derived ───────────────────────────────────────────────────────────────

  const hasContact = !!user?.emergency_contact_name && !!user?.emergency_contact_phone;
  const contactInitial = (user?.emergency_contact_name ?? 'E').charAt(0).toUpperCase();
  const mapsUrl = sos.lat && sos.lng ? `https://maps.google.com/?q=${sos.lat},${sos.lng}` : null;

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-red-50">

      {/* Toast banner */}
      {banner && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white text-sm px-5 py-3 rounded-2xl shadow-lg max-w-sm text-center">
          {banner}
        </div>
      )}

      {/* Header */}
      <div className="bg-[#1A1A2E] px-6 pt-10 pb-6">
        <div className="flex items-center gap-2 mb-1">
          <AlertTriangle className="text-red-400 h-5 w-5" />
          <h1 className="text-2xl font-bold text-white">Emergency SOS</h1>
        </div>
        <p className="text-sm text-white/60 mt-1">
          {sos.active
            ? 'Live location is being shared with your emergency contact'
            : 'Press SOS to alert your emergency contact instantly'}
        </p>
      </div>

      <div className="max-w-lg mx-auto px-4 pb-20 pt-4 space-y-4">

        {/* ── Active SOS card ────────────────────────────────────────────── */}
        {sos.active && (
          <div className="bg-white rounded-2xl p-5 border-l-4 border-red-600 shadow-md">
            <div className="flex items-center gap-2 mb-3">
              <span className="w-2.5 h-2.5 rounded-full bg-red-600 animate-pulse" />
              <span className="font-bold text-red-600">SOS IS ACTIVE</span>
            </div>
            <p className="text-sm text-gray-600 mb-1">📡 Sharing live location every 30 seconds</p>
            {sos.lastUpdate && (
              <p className="text-xs text-gray-400 mb-1">
                Last update: {sos.lastUpdate.toLocaleTimeString()}
              </p>
            )}
            {sos.lat !== null && sos.lng !== null && (
              <div className="flex items-center gap-1 text-xs text-gray-400 mb-4">
                <MapPin className="h-3 w-3" />
                <span>{sos.lat.toFixed(5)}, {sos.lng.toFixed(5)}</span>
                {mapsUrl && (
                  <a href={mapsUrl} target="_blank" rel="noreferrer"
                     className="ml-2 underline text-blue-500">Open in Maps</a>
                )}
              </div>
            )}

            {/* Deactivation code box */}
            <div className="bg-red-50 rounded-xl p-4 text-center">
              <p className="text-[10px] font-bold text-gray-400 tracking-widest uppercase mb-2">
                Your deactivation code
              </p>
              <p className="text-4xl font-bold text-red-600 tracking-[0.45em]">{sos.offCode}</p>
              <p className="text-xs text-gray-400 mt-2">You'll need this to stop the SOS alert</p>
            </div>
          </div>
        )}

        {/* ── No contact warning ────────────────────────────────────────── */}
        {!hasContact && !sos.active && (
          <div className="flex gap-3 bg-amber-50 border border-amber-200 rounded-2xl p-4">
            <span className="text-xl">⚠️</span>
            <div>
              <p className="text-sm font-bold text-amber-800 mb-1">No emergency contact saved</p>
              <p className="text-xs text-amber-700">
                Go to{' '}
                <Link href="/profile/edit" className="underline font-medium">
                  Profile → Edit Profile
                </Link>{' '}
                to add one before using SOS.
              </p>
            </div>
          </div>
        )}

        {/* ── Contact preview ───────────────────────────────────────────── */}
        {hasContact && !sos.active && (
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <p className="text-[10px] font-bold text-gray-400 tracking-widest uppercase mb-3">
              SOS will alert
            </p>
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <span className="text-lg font-bold text-red-600">{contactInitial}</span>
              </div>
              <div>
                <p className="font-semibold text-gray-900">{user!.emergency_contact_name}</p>
                <p className="text-sm text-gray-400 flex items-center gap-1">
                  <Phone className="h-3 w-3" />
                  {user!.emergency_contact_phone}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ── Big SOS button / Stop button ─────────────────────────────── */}
        <div className="flex justify-center py-6">
          {!sos.active ? (
            <button
              onClick={() => {
                if (!user?.id) { showBanner('Please log in to use SOS.'); return; }
                if (!geoAllowed) { showBanner('Please allow location access in your browser to use SOS.'); return; }
                setConfirmOpen(true);
              }}
              disabled={!hasContact || triggering}
              className={[
                'w-44 h-44 rounded-full flex flex-col items-center justify-center',
                'shadow-[0_0_48px_rgba(211,47,47,0.4)] transition-all duration-200',
                (!hasContact || triggering)
                  ? 'bg-red-300 cursor-not-allowed'
                  : 'bg-red-600 hover:scale-105 active:scale-95 cursor-pointer',
              ].join(' ')}
            >
              {triggering ? (
                <span className="text-white text-sm animate-pulse">Activating…</span>
              ) : (
                <>
                  <AlertTriangle className="text-white h-10 w-10 mb-1" />
                  <span className="text-3xl font-black text-white">SOS</span>
                  <span className="text-[11px] text-white/70 mt-1">Click to activate</span>
                </>
              )}
            </button>
          ) : (
            <button
              onClick={() => { setEnteredCode(''); setCodeError(''); setShowModal(true); }}
              className="bg-gray-800 text-white rounded-2xl px-12 py-5 text-center hover:bg-gray-700 transition"
            >
              <p className="text-lg font-bold mb-1">⏹ Stop SOS</p>
              <p className="text-xs text-white/50">Enter your code to deactivate</p>
            </button>
          )}
        </div>

        {/* ── Inline confirm banner ─────────────────────────────────────── */}
        {confirmOpen && (
          <div className="bg-red-600 text-white rounded-2xl p-5 space-y-3">
            <p className="font-bold text-base">🚨 Activate SOS?</p>
            <p className="text-sm text-white/80 leading-relaxed">
              Your emergency contact will receive your live location until you enter the deactivation code.
            </p>
            <div className="flex gap-3">
              <button
                onClick={doTriggerSOS}
                className="flex-1 bg-white text-red-600 font-bold py-2.5 rounded-xl hover:bg-red-50 transition text-sm"
              >
                YES, SEND SOS
              </button>
              <button
                onClick={() => setConfirmOpen(false)}
                className="flex-1 border border-white/40 py-2.5 rounded-xl text-sm hover:bg-red-700 transition"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* ── How it works ──────────────────────────────────────────────── */}
        {!sos.active && (
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <p className="font-bold text-[#1A1A2E] text-sm mb-4">How SOS works</p>
            {[
              ['🔴', 'Click the SOS button above'],
              ['📡', 'Your live location is sent to your emergency contact every 30 s'],
              ['🔔', 'They receive a notification with a Google Maps link'],
              ['🛑', 'To stop: click "Stop SOS" and enter the 6-digit code shown on this screen'],
              ['✅', 'Your contact is notified once you are safe'],
            ].map(([icon, text], i) => (
              <div key={i} className="flex gap-3 mb-3 last:mb-0 items-start">
                <span className="text-base w-5 flex-shrink-0">{icon}</span>
                <p className="text-sm text-gray-600 leading-relaxed">{text}</p>
              </div>
            ))}
          </div>
        )}

        {/* ── Safety link ───────────────────────────────────────────────── */}
        <div className="flex items-center gap-2 justify-center text-xs text-gray-400 pt-2">
          <Shield className="h-3 w-3" />
          <span>Your location data is only shared with your saved emergency contact</span>
        </div>
      </div>

      {/* ── Deactivation modal ────────────────────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-end justify-center z-50 p-0">
          <div className="bg-white w-full max-w-lg rounded-t-3xl p-6 pb-10 animate-in slide-in-from-bottom">
            <div className="w-9 h-1 bg-gray-200 rounded-full mx-auto mb-5" />

            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xl font-bold text-[#1A1A2E]">🛑 Stop SOS</h2>
              <button onClick={() => setShowModal(false)}
                      className="text-gray-400 hover:text-gray-600 transition">
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="text-sm text-gray-500 mb-6 leading-relaxed">
              Enter the 6-digit deactivation code that was shown when SOS was activated.
            </p>

            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={enteredCode}
              onChange={(e) => { setEnteredCode(e.target.value.replace(/\D/g, '')); setCodeError(''); }}
              placeholder="——————"
              autoFocus
              className={[
                'w-full border-2 rounded-xl px-4 py-4 text-3xl font-bold text-center',
                'tracking-[0.5em] text-[#1A1A2E] focus:outline-none transition',
                codeError ? 'border-red-500' : 'border-gray-200 focus:border-red-500',
              ].join(' ')}
            />
            {codeError && (
              <p className="text-xs text-red-500 text-center mt-2">{codeError}</p>
            )}

            <button
              onClick={handleDeactivate}
              disabled={deactivating}
              className="w-full mt-4 bg-[#1A1A2E] text-white font-bold py-4 rounded-xl hover:bg-gray-800 transition disabled:opacity-60"
            >
              {deactivating ? 'Deactivating…' : 'Deactivate SOS'}
            </button>
            <button
              onClick={() => setShowModal(false)}
              className="w-full mt-2 py-3 text-sm text-gray-400 hover:text-gray-600 transition"
            >
              Cancel (keep SOS active)
            </button>
          </div>
        </div>
      )}
    </div>
  );
}