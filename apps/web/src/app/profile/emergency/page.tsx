'use client';

import { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft, Phone, Bell, Trash2, Plus,
  ChevronDown, Check, AlertTriangle, Loader2,
  ShieldCheck, Pencil, X,
} from 'lucide-react';
import {
  useEmergencyContact,
  RELATIONSHIPS,
  SavedContact,
} from '@/hooks/useEmergencyContact';

type Mode = 'idle' | 'adding' | 'view' | 'editing';

interface Props {
  userId: string | null;
  onBack: () => void;
}

function getInitials(name: string) {
  return name.trim().split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

interface FormErrors { name?: string; phone?: string; rel?: string }

function validateForm(name: string, phone: string, rel: string, custom: string): FormErrors {
  const e: FormErrors = {};
  if (!name.trim()) e.name = 'Name is required';
  else if (name.trim().length < 2) e.name = 'Enter a valid full name';

  const digits = phone.replace(/\D/g, '');
  if (!digits) e.phone = 'Phone number is required';
  else if (digits.length !== 10) e.phone = 'Enter a valid 10-digit number';

  const finalRel = rel === 'Other' ? custom : rel;
  if (!finalRel.trim()) e.rel = 'Please select or enter a relationship';
  return e;
}

export default function EmergencyContactSection({ userId, onBack }: Props) {
  const {
    loading, saving, removing,
    saved, saveError,
    saveContact, removeContact,
  } = useEmergencyContact(userId);

  const initialised = useRef(false);
  const [mode, setMode] = useState<Mode>('idle');

  useEffect(() => {
    if (!loading && !initialised.current) {
      initialised.current = true;
      setMode(saved ? 'view' : 'idle');
    }
  }, [loading, saved]);

  const [name,       setName]       = useState('');
  const [phone,      setPhone]      = useState('');
  const [rel,        setRel]        = useState('');
  const [customRel,  setCustomRel]  = useState('');
  const [errors,     setErrors]     = useState<FormErrors>({});
  const [showPicker, setShowPicker] = useState(false);
  const [showRemove, setShowRemove] = useState(false);

  const finalRel = rel === 'Other' ? customRel : rel;
  const isFormMode = mode === 'adding' || mode === 'editing';

  function openAdd() {
    setName(''); setPhone(''); setRel(''); setCustomRel('');
    setErrors({});
    setMode('adding');
  }

  function openEdit(contact: SavedContact) {
    setName(contact.name);
    setPhone(contact.phone);
    if (RELATIONSHIPS.includes(contact.relationship)) {
      setRel(contact.relationship);
      setCustomRel('');
    } else {
      setRel('Other');
      setCustomRel(contact.relationship);
    }
    setErrors({});
    setMode('editing');
  }

  function cancelForm() {
    setName(''); setPhone(''); setRel(''); setCustomRel('');
    setErrors({});
    setMode(saved ? 'view' : 'idle');
  }

  async function handleSave() {
    const errs = validateForm(name, phone, rel, customRel);
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setErrors({});
    const finalRelationship = rel === 'Other' ? customRel.trim() : rel;
    const ok = await saveContact(name.trim(), phone, finalRelationship);
    if (ok) {
      setName(''); setPhone(''); setRel(''); setCustomRel('');
      setMode('view');
    }
  }

  async function handleRemove() {
    const ok = await removeContact();
    if (ok) {
      setShowRemove(false);
      setMode('idle');
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#EEEDFE', borderTopColor: '#7F77DD' }} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">

      {/* ── Header ── */}
      <div className="bg-white px-4 pt-12 pb-4" style={{ borderBottom: '0.5px solid #E5E5E0' }}>
        <div className="flex items-center gap-3 max-w-lg mx-auto">
          <button
            onClick={onBack}
            className="flex-shrink-0 transition-colors"
            style={{ color: '#7F77DD' }}
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div className="flex-1 min-w-0">
            <h1 className="text-base font-semibold text-gray-900">Emergency Contact</h1>
            <p className="text-xs text-gray-400 mt-0.5">Notified during SOS or missed check-in</p>
          </div>

          {mode === 'view' && saved && (
            <button
              onClick={() => openEdit(saved)}
              className="flex-shrink-0 flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full transition-colors"
              style={{ background: '#EEEDFE', color: '#7F77DD', border: '0.5px solid #AFA9EC' }}
            >
              <Pencil className="w-3 h-3" />
              Edit
            </button>
          )}
        </div>
      </div>

      {/* ── Body ── */}
      <div className="max-w-lg mx-auto px-4 pt-4 pb-20 space-y-3">

        {saveError && (
          <div className="flex gap-3 items-start rounded-2xl p-4" style={{ background: '#FCEBEB', border: '0.5px solid #F09595' }}>
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#A32D2D' }} />
            <p className="text-sm font-medium" style={{ color: '#791F1F' }}>{saveError}</p>
          </div>
        )}

        {/* ── IDLE ── */}
        {mode === 'idle' && (
          <>
            {/* Warning card */}
            <div className="rounded-2xl p-5 flex gap-4 items-start" style={{ background: '#FCEBEB', border: '0.5px solid #F09595' }}>
              <div className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center" style={{ background: '#F7C1C1' }}>
                <X className="w-5 h-5" style={{ color: '#A32D2D' }} />
              </div>
              <div>
                <p className="text-sm font-semibold mb-1" style={{ color: '#791F1F' }}>
                  No emergency contact set
                </p>
                <p className="text-xs leading-relaxed" style={{ color: '#A32D2D' }}>
                  If you trigger SOS or miss a ride check-in, nobody will be alerted. Add a trusted contact now.
                </p>
              </div>
            </div>

            <button
              onClick={openAdd}
              className="w-full text-white font-semibold text-sm rounded-2xl py-4 flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
              style={{ background: '#7F77DD' }}
            >
              <Plus className="w-4 h-4" />
              Add emergency contact
            </button>
          </>
        )}

        {/* ── VIEW ── */}
        {mode === 'view' && saved && (
          <>
            {/* Active banner */}
            <div className="rounded-2xl p-4 flex gap-3 items-center" style={{ background: '#E1F5EE', border: '0.5px solid #5DCAA5' }}>
              <ShieldCheck className="w-5 h-5 flex-shrink-0" style={{ color: '#1D9E75' }} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold" style={{ color: '#085041' }}>Emergency contact active</p>
                <p className="text-xs mt-0.5 truncate" style={{ color: '#0F6E56' }}>
                  {saved.name} will be notified instantly
                </p>
              </div>
              <span className="relative flex-shrink-0 flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ background: '#1D9E75' }} />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5" style={{ background: '#1D9E75' }} />
              </span>
            </div>

            {/* Contact card */}
            <div className="bg-white rounded-2xl overflow-hidden" style={{ border: '0.5px solid #E5E5E0' }}>
              <div className="p-4 flex items-center gap-3" style={{ borderBottom: '0.5px solid #F1EFE8' }}>
                <div className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: '#FCEBEB', border: '1.5px solid #F7C1C1' }}>
                  <span className="text-base font-bold" style={{ color: '#A32D2D' }}>
                    {getInitials(saved.name)}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{saved.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{saved.relationship || 'Emergency contact'}</p>
                </div>
                <span className="flex-shrink-0 flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: '#E1F5EE', color: '#085041', border: '0.5px solid #5DCAA5' }}>
                  <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: '#1D9E75' }} />
                  Active
                </span>
              </div>

              <div className="px-4 py-1">
                <div className="flex justify-between items-center py-3" style={{ borderBottom: '0.5px solid #F1EFE8' }}>
                  <span className="text-xs text-gray-400 flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5" />
                    Phone
                  </span>
                  <span className="text-xs font-semibold text-gray-900">+91 {saved.phone}</span>
                </div>
                <div className="flex justify-between items-center py-3">
                  <span className="text-xs text-gray-400 flex items-center gap-2">
                    <Bell className="w-3.5 h-3.5" />
                    SOS alerts sent
                  </span>
                  <span className="text-xs font-semibold" style={{ color: saved.alertCount > 0 ? '#A32D2D' : '#444441' }}>
                    {saved.alertCount > 0
                      ? `${saved.alertCount} alert${saved.alertCount > 1 ? 's' : ''}`
                      : 'None so far'}
                  </span>
                </div>
              </div>
            </div>

            {/* When notified */}
            <div className="rounded-2xl p-4" style={{ background: '#EEEDFE', border: '0.5px solid #AFA9EC' }}>
              <p className="text-[11px] font-semibold uppercase tracking-widest mb-3" style={{ color: '#534AB7' }}>
                When will they be notified?
              </p>
              {[
                'You trigger the SOS button during a ride',
                'You miss a ride check-in (no-show)',
                'Your ride is cancelled without your confirmation',
              ].map((text, i) => (
                <div key={i} className="flex gap-2.5 items-start mb-2 last:mb-0">
                  <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5" style={{ background: '#7F77DD' }} />
                  <p className="text-xs leading-5" style={{ color: '#3C3489' }}>{text}</p>
                </div>
              ))}
            </div>

            {/* Remove */}
            <button
              onClick={() => setShowRemove(true)}
              disabled={removing}
              className="w-full text-sm font-medium rounded-2xl py-3.5 flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
              style={{ border: '0.5px solid #F09595', color: '#A32D2D', background: 'white' }}
            >
              {removing
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <Trash2 className="w-4 h-4" />}
              Remove contact
            </button>
          </>
        )}

        {/* ── FORM (adding / editing) ── */}
        {isFormMode && (
          <div className="bg-white rounded-2xl p-5" style={{ border: '0.5px solid #E5E5E0' }}>
            <p className="text-sm font-semibold text-gray-900 mb-5">
              {mode === 'editing' ? 'Edit contact' : 'Add emergency contact'}
            </p>

            {/* Full name */}
            <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-1.5">
              Full name <span style={{ color: '#A32D2D' }}>*</span>
            </label>
            <input
              className="w-full rounded-xl px-4 py-3 text-sm text-gray-900 placeholder-gray-300 outline-none transition-all"
              style={{
                background: errors.name ? '#FCEBEB' : '#F8F8F6',
                border: `0.5px solid ${errors.name ? '#F09595' : '#E5E5E0'}`,
              }}
              placeholder="e.g. Amma, Dad, Priya..."
              value={name}
              onChange={e => { setName(e.target.value); setErrors(p => ({ ...p, name: undefined })); }}
              autoComplete="name"
              autoFocus
            />
            {errors.name && (
              <p className="text-[11px] font-medium mt-1.5" style={{ color: '#A32D2D' }}>{errors.name}</p>
            )}

            {/* Phone */}
            <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-1.5 mt-5">
              Mobile number <span style={{ color: '#A32D2D' }}>*</span>
            </label>
            <div className="flex gap-2">
              <div className="flex items-center gap-1.5 rounded-xl px-3 py-3 text-sm font-medium flex-shrink-0 select-none" style={{ background: '#F8F8F6', border: '0.5px solid #E5E5E0', color: '#444441' }}>
                🇮🇳 +91
              </div>
              <input
                className="flex-1 rounded-xl px-4 py-3 text-sm text-gray-900 placeholder-gray-300 outline-none transition-all"
                style={{
                  background: errors.phone ? '#FCEBEB' : '#F8F8F6',
                  border: `0.5px solid ${errors.phone ? '#F09595' : '#E5E5E0'}`,
                }}
                placeholder="10-digit number"
                inputMode="numeric"
                maxLength={10}
                value={phone}
                onChange={e => { setPhone(e.target.value.replace(/\D/g, '')); setErrors(p => ({ ...p, phone: undefined })); }}
              />
            </div>
            {errors.phone && (
              <p className="text-[11px] font-medium mt-1.5" style={{ color: '#A32D2D' }}>{errors.phone}</p>
            )}

            {/* Relationship */}
            <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-1.5 mt-5">
              Relationship <span style={{ color: '#A32D2D' }}>*</span>
            </label>
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowPicker(v => !v)}
                className="w-full rounded-xl px-4 py-3 text-sm text-left flex items-center justify-between outline-none transition-all"
                style={{
                  background: errors.rel ? '#FCEBEB' : '#F8F8F6',
                  border: `0.5px solid ${showPicker ? '#7F77DD' : errors.rel ? '#F09595' : '#E5E5E0'}`,
                }}
              >
                <span style={{ color: rel ? '#1A1A2E' : '#D1D5DB' }}>
                  {rel || 'Select relationship'}
                </span>
                <ChevronDown
                  className="w-4 h-4 text-gray-400 transition-transform duration-200"
                  style={{ transform: showPicker ? 'rotate(180deg)' : 'none' }}
                />
              </button>

              {showPicker && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowPicker(false)} />
                  <div className="absolute z-20 top-[calc(100%+4px)] left-0 right-0 bg-white rounded-2xl overflow-hidden" style={{ border: '0.5px solid #E5E5E0', boxShadow: '0 8px 24px rgba(0,0,0,0.08)' }}>
                    {RELATIONSHIPS.map(r => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => {
                          setRel(r);
                          setErrors(p => ({ ...p, rel: undefined }));
                          if (r !== 'Other') setCustomRel('');
                          setShowPicker(false);
                        }}
                        className="w-full flex items-center justify-between px-4 py-3 text-sm text-left transition-colors"
                        style={{
                          background: rel === r ? '#EEEDFE' : 'white',
                          color: rel === r ? '#534AB7' : '#1A1A2E',
                          borderBottom: '0.5px solid #F1EFE8',
                          fontWeight: rel === r ? 600 : 400,
                        }}
                      >
                        {r}
                        {rel === r && <Check className="w-4 h-4" style={{ color: '#7F77DD' }} />}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
            {errors.rel && (
              <p className="text-[11px] font-medium mt-1.5" style={{ color: '#A32D2D' }}>{errors.rel}</p>
            )}

            {rel === 'Other' && (
              <>
                <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-1.5 mt-5">
                  Specify <span style={{ color: '#A32D2D' }}>*</span>
                </label>
                <input
                  className="w-full rounded-xl px-4 py-3 text-sm text-gray-900 placeholder-gray-300 outline-none"
                  style={{
                    background: errors.rel && !customRel ? '#FCEBEB' : '#F8F8F6',
                    border: `0.5px solid ${errors.rel && !customRel ? '#F09595' : '#E5E5E0'}`,
                  }}
                  placeholder="e.g. Aunt, Roommate, Cousin..."
                  value={customRel}
                  onChange={e => { setCustomRel(e.target.value); setErrors(p => ({ ...p, rel: undefined })); }}
                />
              </>
            )}

            {/* Live preview */}
            {name.trim() && phone.trim() && finalRel.trim() && (
              <div className="mt-4 rounded-xl px-3.5 py-2.5 flex items-center gap-2" style={{ background: '#E1F5EE', border: '0.5px solid #5DCAA5' }}>
                <Check className="w-4 h-4 flex-shrink-0" style={{ color: '#1D9E75' }} />
                <p className="text-xs font-medium truncate" style={{ color: '#085041' }}>
                  {name.trim()} · {finalRel} · +91 {phone}
                </p>
              </div>
            )}

            {/* Save */}
            <button
              onClick={handleSave}
              disabled={saving}
              className="mt-5 w-full text-white font-semibold text-sm rounded-2xl py-4 flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-60"
              style={{ background: '#7F77DD' }}
            >
              {saving ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
              ) : (
                mode === 'editing' ? 'Update contact' : 'Save contact'
              )}
            </button>

            {/* Cancel */}
            <button
              onClick={cancelForm}
              disabled={saving}
              className="mt-2 w-full text-sm font-medium rounded-2xl py-3.5 transition-colors disabled:opacity-50"
              style={{ border: '0.5px solid #E5E5E0', color: '#888780', background: 'white' }}
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      {/* ── Remove confirm modal ── */}
      {showRemove && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div
            className="absolute inset-0"
            style={{ background: 'rgba(0,0,0,0.3)' }}
            onClick={() => !removing && setShowRemove(false)}
          />
          <div className="relative bg-white rounded-3xl p-6 w-full max-w-sm" style={{ border: '0.5px solid #E5E5E0' }}>
            <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: '#FCEBEB' }}>
              <Trash2 className="w-6 h-6" style={{ color: '#A32D2D' }} />
            </div>
            <h3 className="text-base font-semibold text-gray-900 text-center mb-2">Remove contact?</h3>
            <p className="text-sm text-gray-400 text-center leading-5 mb-6">
              <span className="font-semibold text-gray-700">{saved?.name}</span> won't receive SOS alerts anymore.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowRemove(false)}
                disabled={removing}
                className="flex-1 text-sm font-medium rounded-2xl py-3 transition-colors disabled:opacity-50"
                style={{ border: '0.5px solid #E5E5E0', color: '#888780' }}
              >
                Cancel
              </button>
              <button
                onClick={handleRemove}
                disabled={removing}
                className="flex-1 text-white text-sm font-semibold rounded-2xl py-3 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                style={{ background: '#E24B4A' }}
              >
                {removing
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Removing…</>
                  : 'Remove'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}