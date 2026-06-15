'use client';

/**
 * src/app/(auth)/driver/setup/page.tsx
 * DriverSetupScreen — Account + Vehicle + Documents.
 * Web version: file input instead of ImagePicker.
 */

import { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createDriverAccount } from '@/lib/authService';
import { saveDriverSetup, checkVehicleNumber, uploadDriverDocument, submitDriverForReview } from '@/lib/driverService';
import { useAuth } from '@/context/AuthContext';

const INDIAN_VEHICLE_RE = /^[A-Z]{2}[0-9]{2}[A-Z]{1,3}[0-9]{4}$/;

function validateVehicle(raw: string): { valid: boolean; message?: string } {
  const n = raw.trim().toUpperCase().replace(/[\s-]/g, '');
  if (!n) return { valid: false, message: 'Vehicle number is required' };
  if (n.length < 7 || n.length > 10) return { valid: false, message: 'Must be 7–10 characters (e.g. MH12AB1234)' };
  if (!INDIAN_VEHICLE_RE.test(n)) return { valid: false, message: 'Invalid format. Use MH12AB1234 style' };
  return { valid: true };
}

const GENDERS = ['male', 'female', 'other'];
const VEHICLE_TYPES = [
  { value: 'car', label: 'Car', icon: '🚗' },
  { value: 'bike', label: 'Bike', icon: '🏍️' },
  { value: 'auto', label: 'Auto', icon: '🛺' },
] as const;
type VehicleType = 'car' | 'bike' | 'auto';

const DOCS = [
  { key: 'license' as const, label: 'Driving License', icon: '🪪' },
  { key: 'rc' as const, label: 'RC Book', icon: '📄' },
  { key: 'insurance' as const, label: 'Insurance', icon: '🛡️' },
  { key: 'puc' as const, label: 'PUC Certificate', icon: '🌿' },
];
type DocKey = 'license' | 'rc' | 'insurance' | 'puc';
type DocStatus = 'none' | 'uploading' | 'uploaded' | 'error';

function DriverSetupContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const idToken = searchParams.get('idToken') ?? '';
  const firebase_uid = searchParams.get('uid') ?? '';
  const email = searchParams.get('email') ?? '';
  const { setSession, setDriverProfile } = useAuth();

  // Account
  const [name, setName] = useState('');
  const [gender, setGender] = useState('');

  // Vehicle
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [vNumStatus, setVNumStatus] = useState<'idle' | 'checking' | 'ok' | 'error'>('idle');
  const [vNumError, setVNumError] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [color, setColor] = useState('');
  const [vehicleType, setVehicleType] = useState<VehicleType>('car');
  const [seats, setSeats] = useState('4');

  // Documents
  const [docs, setDocs] = useState<Record<DocKey, DocStatus>>({ license: 'none', rc: 'none', insurance: 'none', puc: 'none' });
  const [docErrors, setDocErrors] = useState<Record<DocKey, string>>({ license: '', rc: '', insurance: '', puc: '' });
  const fileRefs = { license: useRef<HTMLInputElement>(null), rc: useRef<HTMLInputElement>(null), insurance: useRef<HTMLInputElement>(null), puc: useRef<HTMLInputElement>(null) };

  // State flags
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [accountCreated, setAccountCreated] = useState(false);
  const [vehicleSaved, setVehicleSaved] = useState(false);
  const [error, setError] = useState('');

  const docsUploaded = Object.values(docs).filter((v) => v === 'uploaded').length;
  const progress = (accountCreated ? 33 : 0) + (vehicleSaved ? 33 : 0) + Math.round((docsUploaded / 4) * 34);

  // Vehicle number debounced check
  const checkVehicle = useCallback(async (num: string) => {
    const cleaned = num.trim().toUpperCase().replace(/[\s-]/g, '');
    if (!cleaned) { setVNumStatus('idle'); return; }
    const local = validateVehicle(cleaned);
    if (!local.valid) { setVNumStatus('error'); setVNumError(local.message ?? 'Invalid'); return; }
    setVNumStatus('checking');
    try {
      const res = await checkVehicleNumber(cleaned);
      if (res.taken) { setVNumStatus('error'); setVNumError('This vehicle number is already registered'); }
      else { setVNumStatus('ok'); setVNumError(''); }
    } catch { setVNumStatus('ok'); setVNumError(''); }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => checkVehicle(vehicleNumber), 600);
    return () => clearTimeout(t);
  }, [vehicleNumber, checkVehicle]);

  // Step 1: Create account
  const ensureAccount = async (): Promise<boolean> => {
    if (accountCreated) return true;
    if (!name.trim()) { setError('Full name is required.'); return false; }
    if (!gender) { setError('Please select your gender.'); return false; }
    try {
      setSaving(true); setError('');
      const result = await createDriverAccount({ idToken, firebase_uid, name: name.trim(), gender, email });
      setSession(result.user, result.communities, result.driver_profile);
      setAccountCreated(true);
      return true;
    } catch (err: any) { setError(err?.message ?? 'Account creation failed.'); return false; }
    finally { setSaving(false); }
  };

  // Step 2: Save vehicle
  const handleSaveVehicle = async () => {
    const ok = await ensureAccount();
    if (!ok) return;
    if (vNumStatus !== 'ok') { setError(vNumError || 'Enter a valid vehicle number.'); return; }
    if (!licenseNumber.trim()) { setError('License number is required.'); return; }
    if (!make.trim() || !model.trim() || !color.trim()) { setError('Fill in make, model, and color.'); return; }
    const parsedSeats = parseInt(seats, 10);
    if (isNaN(parsedSeats) || parsedSeats < 1 || parsedSeats > 8) { setError('Seats must be 1–8.'); return; }
    try {
      setSaving(true); setError('');
      const dp = await saveDriverSetup({
        vehicle: {
          vehicle_number: vehicleNumber.toUpperCase().replace(/[\s-]/g, ''),
          license_number: licenseNumber.trim().toUpperCase(),
          vehicle_make: make.trim(),
          vehicle_model: model.trim(),
          vehicle_color: color.trim(),
          vehicle_type: vehicleType,
          seats_available_default: parsedSeats,
        },
      });
      setDriverProfile(dp);
      setVehicleSaved(true);
    } catch (err: any) { setError(err?.message ?? 'Could not save vehicle info.'); }
    finally { setSaving(false); }
  };

  // Step 3: Upload doc
  const handleFileChange = async (docKey: DocKey, file: File | undefined) => {
    if (!file) return;
    setDocs((p) => ({ ...p, [docKey]: 'uploading' }));
    setDocErrors((p) => ({ ...p, [docKey]: '' }));
    try {
      await uploadDriverDocument({ doc_type: docKey, file });
      setDocs((p) => ({ ...p, [docKey]: 'uploaded' }));
    } catch (err: any) {
      setDocs((p) => ({ ...p, [docKey]: 'error' }));
      setDocErrors((p) => ({ ...p, [docKey]: err?.message ?? 'Upload failed. Try again.' }));
    }
  };

  const canSubmit = accountCreated && vehicleSaved && vNumStatus === 'ok' && docsUploaded === 4;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    try {
      setSubmitting(true);
      const { driver_profile } = await submitDriverForReview();
      setDriverProfile(driver_profile);
      router.push('/driver/pending');
    } catch (err: any) { setError(err?.message ?? 'Submission failed.'); }
    finally { setSubmitting(false); }
  };

  const docIcon = (s: DocStatus) => s === 'uploaded' ? '✅' : s === 'uploading' ? '⏳' : s === 'error' ? '❌' : '📎';

  return (
    <main className="min-h-screen bg-[#F8F7FF] px-5 py-6">
      {/* Progress */}
      <div className="w-full h-1 bg-[#E5E4F0] rounded-full mb-1">
        <div className="h-1 bg-[#6C63FF] rounded-full transition-all" style={{ width: `${progress}%` }} />
      </div>
      <p className="text-[12px] text-[#A0A0B8] text-right mb-6">
        {!accountCreated ? 'Step 1 of 3 — Account info' : !vehicleSaved ? 'Step 2 of 3 — Vehicle info' : `${docsUploaded} of 4 documents uploaded`}
      </p>

      {error && <p className="text-[#EF4444] text-[13px] mb-4 bg-red-50 border border-red-200 rounded-xl px-4 py-3">{error}</p>}

      {/* ── ACCOUNT ── */}
      <div className="bg-white border border-[#E5E4F0] rounded-2xl p-5 mb-5">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-[17px] font-bold text-[#1A1A2E]">👤 Account</h2>
          {accountCreated && <span className="text-[13px] font-bold text-[#22C55E]">✓ Done</span>}
        </div>
        <div className="flex items-center gap-2 bg-[#EAE8FF] rounded-xl px-4 py-3 mb-4">
          <span>✅</span>
          <span className="text-[13px] text-[#6C63FF] font-semibold">{email}</span>
        </div>
        <label className="text-[12px] font-semibold text-[#6B6B8A] uppercase tracking-wide mb-2 block">Full name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your full name"
          disabled={accountCreated}
          className="w-full bg-[#F8F7FF] border-[1.5px] border-[#E5E4F0] rounded-xl px-4 py-3 text-[15px] text-[#1A1A2E] placeholder-[#A0A0B8] focus:outline-none focus:border-[#6C63FF] mb-4 disabled:opacity-60"
        />
        <label className="text-[12px] font-semibold text-[#6B6B8A] uppercase tracking-wide mb-2 block">Gender</label>
        <div className="flex gap-2">
          {GENDERS.map((g) => (
            <button
              key={g}
              onClick={() => !accountCreated && setGender(g)}
              disabled={accountCreated}
              className={`flex-1 py-3 rounded-xl border-[1.5px] font-semibold text-[13px] capitalize transition-colors ${
                gender === g ? 'border-[#6C63FF] bg-[#EAE8FF] text-[#6C63FF]' : 'border-[#E5E4F0] bg-[#F8F7FF] text-[#6B6B8A]'
              } disabled:opacity-60`}
            >
              {g}
            </button>
          ))}
        </div>
      </div>

      {/* ── VEHICLE ── */}
      <div className="bg-white border border-[#E5E4F0] rounded-2xl p-5 mb-5">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-[17px] font-bold text-[#1A1A2E]">🚘 Vehicle</h2>
          {vehicleSaved && <span className="text-[13px] font-bold text-[#22C55E]">✓ Done</span>}
        </div>

        <label className="text-[12px] font-semibold text-[#6B6B8A] uppercase tracking-wide mb-2 block">Vehicle Number</label>
        <div className="flex items-center gap-2 mb-1">
          <input
            type="text"
            value={vehicleNumber}
            onChange={(e) => setVehicleNumber(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
            placeholder="MH12AB1234"
            maxLength={10}
            className={`flex-1 bg-[#F8F7FF] border-[1.5px] rounded-xl px-4 py-3 text-[15px] font-bold tracking-widest text-[#1A1A2E] placeholder-[#A0A0B8] focus:outline-none ${
              vNumStatus === 'ok' ? 'border-[#22C55E]' : vNumStatus === 'error' ? 'border-[#EF4444]' : 'border-[#E5E4F0] focus:border-[#6C63FF]'
            }`}
          />
          {vNumStatus === 'checking' && <div className="w-5 h-5 border-2 border-[#6C63FF] border-t-transparent rounded-full animate-spin" />}
          {vNumStatus === 'ok' && <span className="text-[#22C55E] font-bold">✓</span>}
          {vNumStatus === 'error' && <span className="text-[#EF4444] font-bold">✗</span>}
        </div>
        {vNumStatus === 'error' && <p className="text-[#EF4444] text-[12px] mb-2">{vNumError}</p>}
        <p className="text-[11px] text-[#A0A0B8] mb-4">Format: MH12AB1234 (state + RTO + series + number)</p>

        <label className="text-[12px] font-semibold text-[#6B6B8A] uppercase tracking-wide mb-2 block">License Number</label>
        <input type="text" value={licenseNumber} onChange={(e) => setLicenseNumber(e.target.value.toUpperCase())} placeholder="MH1234567890123" maxLength={16}
          className="w-full bg-[#F8F7FF] border-[1.5px] border-[#E5E4F0] rounded-xl px-4 py-3 text-[15px] text-[#1A1A2E] placeholder-[#A0A0B8] focus:outline-none focus:border-[#6C63FF] mb-4" />

        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <label className="text-[12px] font-semibold text-[#6B6B8A] uppercase tracking-wide mb-2 block">Make</label>
            <input type="text" value={make} onChange={(e) => setMake(e.target.value)} placeholder="Maruti"
              className="w-full bg-[#F8F7FF] border-[1.5px] border-[#E5E4F0] rounded-xl px-4 py-3 text-[15px] text-[#1A1A2E] placeholder-[#A0A0B8] focus:outline-none focus:border-[#6C63FF]" />
          </div>
          <div>
            <label className="text-[12px] font-semibold text-[#6B6B8A] uppercase tracking-wide mb-2 block">Model</label>
            <input type="text" value={model} onChange={(e) => setModel(e.target.value)} placeholder="Swift"
              className="w-full bg-[#F8F7FF] border-[1.5px] border-[#E5E4F0] rounded-xl px-4 py-3 text-[15px] text-[#1A1A2E] placeholder-[#A0A0B8] focus:outline-none focus:border-[#6C63FF]" />
          </div>
          <div>
            <label className="text-[12px] font-semibold text-[#6B6B8A] uppercase tracking-wide mb-2 block">Color</label>
            <input type="text" value={color} onChange={(e) => setColor(e.target.value)} placeholder="White"
              className="w-full bg-[#F8F7FF] border-[1.5px] border-[#E5E4F0] rounded-xl px-4 py-3 text-[15px] text-[#1A1A2E] placeholder-[#A0A0B8] focus:outline-none focus:border-[#6C63FF]" />
          </div>
          <div>
            <label className="text-[12px] font-semibold text-[#6B6B8A] uppercase tracking-wide mb-2 block">Seats</label>
            <input type="number" value={seats} onChange={(e) => setSeats(e.target.value)} placeholder="4" min={1} max={8}
              className="w-full bg-[#F8F7FF] border-[1.5px] border-[#E5E4F0] rounded-xl px-4 py-3 text-[15px] text-[#1A1A2E] placeholder-[#A0A0B8] focus:outline-none focus:border-[#6C63FF]" />
          </div>
        </div>

        <label className="text-[12px] font-semibold text-[#6B6B8A] uppercase tracking-wide mb-2 block">Vehicle Type</label>
        <div className="flex gap-2 mb-5">
          {VEHICLE_TYPES.map((vt) => (
            <button key={vt.value} onClick={() => setVehicleType(vt.value)}
              className={`flex-1 flex flex-col items-center py-3 rounded-xl border-[1.5px] transition-colors ${
                vehicleType === vt.value ? 'border-[#6C63FF] bg-[#EAE8FF]' : 'border-[#E5E4F0] bg-[#F8F7FF] hover:border-[#6C63FF]/50'
              }`}>
              <span className="text-2xl">{vt.icon}</span>
              <span className={`text-[12px] font-semibold mt-1 ${vehicleType === vt.value ? 'text-[#6C63FF]' : 'text-[#6B6B8A]'}`}>{vt.label}</span>
            </button>
          ))}
        </div>

        <button
          onClick={handleSaveVehicle}
          disabled={saving || vehicleSaved}
          className="w-full bg-[#EAE8FF] border-[1.5px] border-[#6C63FF] text-[#6C63FF] font-bold py-3 rounded-xl disabled:opacity-50 hover:bg-[#6C63FF] hover:text-white transition-colors"
        >
          {saving ? 'Saving…' : vehicleSaved ? '✓ Vehicle info saved' : 'Save vehicle info'}
        </button>
      </div>

      {/* ── DOCUMENTS ── */}
      <div className="bg-white border border-[#E5E4F0] rounded-2xl p-5 mb-5">
        <h2 className="text-[17px] font-bold text-[#1A1A2E] mb-2">📋 Documents</h2>
        <p className="text-[13px] text-[#A0A0B8] mb-4">Upload clear photos (JPG/PNG). All 4 are required before submitting.</p>

        {DOCS.map((doc) => (
          <div key={doc.key}>
            <button
              onClick={() => docs[doc.key] !== 'uploading' && fileRefs[doc.key].current?.click()}
              disabled={docs[doc.key] === 'uploading'}
              className={`w-full flex items-center gap-3 rounded-xl p-4 mb-1 border transition-colors text-left ${
                docs[doc.key] === 'uploaded' ? 'border-[#22C55E] bg-[#F0FDF4]' :
                docs[doc.key] === 'error' ? 'border-[#EF4444] bg-[#FFF1F2]' :
                'border-[#E5E4F0] bg-[#F8F7FF] hover:border-[#6C63FF]/50'
              }`}
            >
              <span className="text-2xl">{doc.icon}</span>
              <div className="flex-1">
                <p className="text-[14px] font-semibold text-[#1A1A2E]">{doc.label}</p>
                <p className="text-[12px] text-[#A0A0B8] mt-0.5">
                  {docs[doc.key] === 'uploaded' ? 'Uploaded — click to replace' :
                   docs[doc.key] === 'uploading' ? 'Uploading…' :
                   docs[doc.key] === 'error' ? 'Failed — click to retry' : 'Click to upload'}
                </p>
              </div>
              {docs[doc.key] === 'uploading'
                ? <div className="w-5 h-5 border-2 border-[#6C63FF] border-t-transparent rounded-full animate-spin" />
                : <span className="text-xl">{docIcon(docs[doc.key])}</span>}
            </button>
            {docErrors[doc.key] && <p className="text-[#EF4444] text-[12px] mb-2 px-1">{docErrors[doc.key]}</p>}
            <input
              ref={fileRefs[doc.key]}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handleFileChange(doc.key, e.target.files?.[0])}
            />
          </div>
        ))}
      </div>

      {/* ── SUBMIT ── */}
      <button
        onClick={handleSubmit}
        disabled={!canSubmit || submitting}
        className="w-full bg-[#6C63FF] text-white font-bold py-4 rounded-xl disabled:opacity-45 hover:bg-[#4B44CC] transition-colors mb-3"
      >
        {submitting ? 'Submitting…' : 'Submit for review'}
      </button>
      {!canSubmit && (
        <p className="text-center text-[12px] text-[#A0A0B8]">
          {!accountCreated ? 'Save your account info first.' :
           !vehicleSaved ? 'Save your vehicle info next.' :
           `Upload all 4 documents (${docsUploaded}/4 done).`}
        </p>
      )}
    </main>
  );
}

export default function DriverSetupPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#F8F7FF] flex items-center justify-center"><div className="w-6 h-6 border-2 border-[#6C63FF] border-t-transparent rounded-full animate-spin" /></div>}>
      <DriverSetupContent />
    </Suspense>
  );
}
